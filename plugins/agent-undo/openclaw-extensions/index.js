/**
 * agent-undo-hook — OpenClaw 插件
 * 
 * 功能：通过 au hook pre/post 标准协议，将 agent 文件变更归因到 openclaw session，
 *       让 au daemon 能准确追踪和撤销 agent 操作。
 * 
 * 核心机制：
 *   before_tool_call  → 检测写入操作 → au hook pre 归因
 *   before_prompt_build → 清理闲置 daemon
 *   before_message_write → 追加未初始化 au 项目提醒（用户可见）
 *   llm_output → au hook post + au session end（关闭归因窗口 + 写入 metadata）
 * 
 * 提供 /undo 和 /au 命令。
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

// ═══════════════════════════════════════════════════════════════
// 常量定义
// ═══════════════════════════════════════════════════════════════

// 只读工具不追踪
const SKIP_TRACK_TOOLS = new Set([
  "read", "web_fetch", "memory_search", "memory_get",
  // context-mode 只读工具
  "context-mode__ctx_doctor",
  "context-mode__ctx_insight",
  "context-mode__ctx_purge",
  "context-mode__ctx_search",
  "context-mode__ctx_stats",
  "context-mode__ctx_upgrade",
  "context-mode__ctx_fetch_and_index",
  "context-mode__ctx_index",
  // 系统工具（无文件写入）
  "canvas", "nodes", "cron", "message", "gateway", "agents_list",
  "sessions_list", "sessions_history", "sessions_send", "sessions_spawn",
  "sessions_yield", "subagents", "session_status", "tts",
]);

// 工具路径提取规则（声明式，新增工具只加一行配置）
// 项目根缓存文件（避免每次遍历目录树找 .agent-undo）
const CACHE_FILE = path.join(__dirname, "project-roots.json");

// 残留 marker 超时阈值（超过此时间的 marker 视为残留，启动时清理）
const STALE_THRESHOLD_MS = 30_000;

// prompt 清洗规则（按顺序应用，新增规则只需加一行）
const PROMPT_FILTERS = [
  [/^Sender \(untrusted metadata\):\s*```[^\n]*\n[\s\S]*?```\n*/, ""],  // 飞书/webchat 元数据块（匹配开闭 ``` 对）
  [/^\[OPENCLAW_DESKTOP_CONTEXT\][\s\S]*?\[\/OPENCLAW_DESKTOP_CONTEXT\]\s*/, ""], // Desktop 客户端注入的能力描述块
  [/^\s*\[[A-Z][a-z]{2} \d{4}-\d{2}-\d{2} \d{2}:\d{2} GMT[+-]\d{1,2}\]\s*/, ""], // 时间戳（允许前导空白）
];

// ═══════════════════════════════════════════════════════════════
// 状态变量
// ═══════════════════════════════════════════════════════════════

// 已知项目根列表（从 project-roots.json 加载，持久化）
let roots = [];

// au session 管理：projectRoot → { sessionId, channel }（会话级，不持久化）
let auSessions = new Map();

let auAvailable = false; // au 命令是否可用（register 时检测一次）




// 未初始化提醒：通过 project-roots.json 的 uninitRemindDate + uninitRemindCount 字段去重
let uninitRemindDailyLimit = 3; // 每天最多提醒次数，0 表示关闭提醒
let uninitRemindIntervalMin = 5; // 同一项目两次提醒的最小间隔（分钟），0 表示不限
let uninitRemindIgnorePaths = []; // 忽略「未初始化 au」提醒的路径前缀列表

// 未初始化 au 的项目提醒：before_tool_call 记录，before_message_write 输出
let uninitNoticeQueue = [];

// 项目标记文件（用于无 .git 时启发式发现项目根）
const PROJECT_MARKERS = [
  "package.json", "pyproject.toml", "setup.py", "requirements.txt",
  "Cargo.toml", "go.mod", "pom.xml", "build.gradle", "Gemfile",
  "composer.json", "mix.exs", "Makefile", "CMakeLists.txt",
  "Dockerfile", "docker-compose.yml","main.py"
];

// 项目容器目录（其直接子目录视为候选项目）
const PROJECT_CONTAINER_DIRS = new Set([
  "Desktop", "Documents", "Projects", "Workspace", "Code", "Repos", "dev", "work",
]);

// 未初始化提醒：每天提醒一次

// 自动停止闲置 daemon 的时间（分钟），默认 120 分钟，0 表示关闭自动停止
let autostopIdleMinutes = 120;

// 自动 pin 间隔天数，默认 1 天，0 表示关闭自动 pin
let autoPinGapDays = 1;

// prompt/prompt_output 截断长度（可配置）
let promptTruncLen = 200;
let outputTruncLen = 200;

// 每轮对话数据暂存（prompt, model, promptOutput）
let turnDataMap = new Map(); // sessionKey → { prompt, model, promptOutput }

// ═══════════════════════════════════════════════════════════════
// 配置加载（从 openclaw.json 读取插件配置）
// ═══════════════════════════════════════════════════════════════



// ═══════════════════════════════════════════════════════════════
// 缓存管理（project-roots.json）
// ═══════════════════════════════════════════════════════════════

/** 返回北京时间 ISO 字符串 */
function nowISO() {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Shanghai", hour12: false }).replace(" ", "T") + "+08:00";
}

/** 从 project-roots.json 加载项目列表 */
function loadCache() {
  try {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    if (!Array.isArray(data)) { roots = []; return; }
    // 兼容旧格式（纯字符串数组）
    roots = data.map(item => {
      if (typeof item === "string") return { path: item, lastUsed: "" };
      return item;
    });
    // 按 lastUsed 降序（最近使用的排前面）
    roots.sort((a, b) => (b.lastUsed || "").localeCompare(a.lastUsed || ""));
  } catch { roots = []; }
}

/** 保存项目列表到 project-roots.json */
function saveCache() {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(roots, null, 2)); } catch {}
}

/**
 * 添加或更新项目根记录
 * @param {string} root - 项目根路径
 * @param {boolean} updateLastUsed - 是否更新 lastUsed 时间
 * @param {object} opts - 可选字段 { uninitRemindCount, uninitRemindDate, initialized }
 */

/** 初始化项目 */ 
function initRoot(rootPath) {
  const realRoot = fs.realpathSync(rootPath);
  // 移除父路径条目（当前路径已 init，父路径 uninit 条目多余）
  roots = roots.filter(r => !realRoot.startsWith(r.path + "/"));
  const existing = roots.find(r => r.path === realRoot);
  if (existing) {
    existing.initialized = true;
    delete existing.uninitRemindCount;
    delete existing.uninitRemindDate;
  } else {
    roots.push({ path: realRoot, initialized: true, lastUsed: "", createdAt: nowISO() });
  }
  saveCache();
}

/** 更新项目提醒次数 */
function remindRoot(rootPath, count, date, filePath) {
  const realRoot = fs.realpathSync(rootPath);
  const existing = roots.find(r => r.path === realRoot);
  if (existing) {
    existing.initialized = false;
    existing.uninitRemindCount = count;
    existing.uninitRemindDate = date;
    existing.lastRemindedAt = nowISO();
    if (filePath) {
      if (!existing.triggerFiles) existing.triggerFiles = [];
      if (!existing.triggerFiles.includes(filePath)) existing.triggerFiles.push(filePath);
    }
  } else {
    roots.push({
      path: realRoot, initialized: false, uninitRemindCount: count, uninitRemindDate: date, lastRemindedAt: nowISO(), lastUsed: "", createdAt: nowISO(),
      ...(filePath ? { triggerFiles: [filePath] } : {}),
    });
  }
  saveCache();
}

/** 更新项目的 lastUsed 时间 */
function updateRootLastUsed(rootPath) {
  const realRoot = fs.realpathSync(rootPath);
  const existing = roots.find(r => r.path === realRoot);
  if (existing) {
    existing.lastUsed = nowISO();
    roots.sort((a, b) => (b.lastUsed || "").localeCompare(a.lastUsed || ""));
    saveCache();
  }
}

/** 从项目列表中移除指定项目 */
function removeRoot(root) {
  const realRoot = fs.realpathSync(root);
  const before = roots.length;
  // 只移除已初始化项目（.agent-undo 被删除）；未初始化项目保留
  roots = roots.filter(r => r.path !== realRoot || !r.initialized);
  if (roots.length !== before) saveCache();
}

// ═══════════════════════════════════════════════════════════════
// 项目根查找与处理
// ═══════════════════════════════════════════════════════════════

/**
 * 从目录查找项目根（一次遍历，同时检查 .agent-undo / .git / PROJECT_MARKERS）
 * @param {string} dir - 起始目录
 * @returns {{ root: string|null, initialized: boolean }}
 *   root: 项目根路径
 *   initialized: true = 有 .agent-undo，false = 有 .git 或 PROJECT_MARKERS 但无 .agent-undo
 */
function findRootFromDir(dir) {
  try {
    const realDir = fs.realpathSync(path.resolve(dir));
    // 查缓存：initialized 条目都查（加速用）
    for (const root of roots) {
      if (realDir === root.path || realDir.startsWith(root.path + "/")) {
        if (root.initialized) {
          if (fs.existsSync(path.join(root.path, ".agent-undo"))) {
            return { root: root.path, initialized: true };
          } else {
            // .agent-undo 已被删除，缓存失效
            removeRoot(root.path);
          }
        }
        // initialized: false → 继续遍历，可能还有更精确的匹配
      }
    }
    // 向上遍历：.agent-undo 优先（从下往上），.git / PROJECT_MARKERS 其次（从上往下）
    let cur = realDir;
    const fsRoot = path.parse(cur).root;
    // 收集路径层级
    const homeDir = os.homedir();
    const ancestors = [];
    cur = realDir;
    while (cur !== fsRoot) {
      ancestors.push(cur);
      const parent = path.dirname(cur);
      if (parent === cur || parent === homeDir) break;
      cur = parent;
    }
    // 第 1 遍：从下往上找 .agent-undo（最高优先级）
    for (const dir of ancestors) {
      if (fs.existsSync(path.join(dir, ".agent-undo"))) {
        initRoot(dir);
        return { root: dir, initialized: true };
      }
    }
    // 第 2 遍：从上往下找 .git / PROJECT_MARKERS（最近的项目根）
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const dir = ancestors[i];
      const hasGit = fs.existsSync(path.join(dir, ".git"));
      const hasMarker = PROJECT_MARKERS.some(m => fs.existsSync(path.join(dir, m)));
      if (hasGit || hasMarker) {
        return { root: dir, initialized: false };
      }
    }
  } catch {}
  return { root: null, initialized: false };
}

// 不需要提醒"未初始化 au"的路径（用户主动 au init 后仍可追踪）
const SKIP_REMIND_PATHS = [
  "/tmp", "/var", "/usr", "/bin", "/sbin", "/etc", "/System", "/opt",
  "/Applications", "/Library", "/Network",
  path.join(os.homedir(), "bin"),
  path.join(os.homedir(), ".local/bin"),
  path.join(os.homedir(), ".cache"),
  path.join(os.homedir(), ".npm"),
  path.join(os.homedir(), ".cargo"),
  path.join(os.homedir(), ".rustup"),
];

/** 判断路径是否不需要"未初始化"提醒 */
function shouldSkipRemind(filePath, sessionKey) {
  if (sessionKey && (sessionKey.includes(":cron:") || sessionKey.includes(":subagent:"))) return true;
  if (!filePath) return false;
  const resolved = path.resolve(filePath);
  return SKIP_REMIND_PATHS.some(p => resolved.startsWith(p))
      || uninitRemindIgnorePaths.some(p => resolved.startsWith(p));
}

/** 处理未初始化 au 的项目（有 .git 或 PROJECT_MARKERS 但无 .agent-undo）：记录到缓存 + 加入提醒队列 */
function handleUninitProject(rootPath, filePath, sessionKey) {
  if (!rootPath) return;
  if (shouldSkipRemind(filePath, sessionKey)) return;
  if (!shouldRemindUninit(rootPath)) return;
  const fileLine = filePath ? `涉及修改 ${filePath}\n` : "";
  uninitNoticeQueue.push({ rootPath, filePath, text: `${fileLine}⚠️ 该文件所在的项目 ${path.basename(rootPath)}（${rootPath}）未初始化 au\n启用：au init && au serve --daemon` });
}

/** 处理无项目标识的文件：启发式发现候选项目根，提醒用户自行初始化 */
function handleCandidateRoots(filePath, sessionKey) {
  if (shouldSkipRemind(filePath, sessionKey)) return;
  const cands = findCandidateRoots(filePath);
  if (cands.length === 0) return;
  const lines = cands.map((c, i) => `${i + 1}. ${path.basename(c)}（${c}）`).join("\n");
  uninitNoticeQueue.push(`涉及修改 ${filePath}\n⚠️ 该文件所在目录未发现项目标识，发现候选项目：\n${lines}\n初始化：cd 项目目录 && au init && au serve --daemon`);
}

/**
 * 追踪写入路径：查找项目根 → 追踪/提醒/启发式发现
 * @param {string} targetPath - 写入目标文件路径或目录路径
 * @param {string} toolName - 工具名
 * @param {string} sessionKey - 会话标识
 * @param {boolean} [isDir] - targetPath 是否为目录（workdir/cd 场景）
 * @returns {boolean} 是否找到已初始化项目（用于 workdir 的 early return）
 */
function trackWritePath(targetPath, toolName, sessionKey, isDir) {
  const resolvedPath = path.resolve(targetPath);
  const dir = isDir ? resolvedPath : path.dirname(resolvedPath);
  const { root, initialized } = findRootFromDir(dir);
  if (root && initialized) {
    ensureSessionAndHookPre(root, targetPath, toolName, sessionKey, isDir);
    return true;
  } else if (root) {
    handleUninitProject(root, targetPath, sessionKey);
  } else if (!isDir) {
    handleCandidateRoots(targetPath, sessionKey);
  }
  return false;
}

/** 检查项目今天是否需要提醒未初始化 au（每日上限控制） */
function shouldRemindUninit(rootPath) {
  if (uninitRemindDailyLimit === 0) return false;
  const existing = roots.find(r => r.path === rootPath);
  if (!existing) return true;
  // 间隔检查
  if (uninitRemindIntervalMin > 0 && existing.lastRemindedAt) {
    const elapsed = Date.now() - new Date(existing.lastRemindedAt).getTime();
    if (!isNaN(elapsed) && elapsed < uninitRemindIntervalMin * 60 * 1000) return false;
  }
  const today = nowISO().slice(0, 10);
  if (existing.uninitRemindDate !== today) return true;
  return (existing.uninitRemindCount || 0) < uninitRemindDailyLimit;
}

/** 标记项目今天已提醒过 */
function markReminded(rootPath, filePath) {
  const today = nowISO().slice(0, 10);
  const existing = roots.find(r => r.path === rootPath);
  const count = (existing?.uninitRemindDate === today) ? (existing.uninitRemindCount || 0) + 1 : 1;
  remindRoot(rootPath, count, today, filePath);
}


// ═══════════════════════════════════════════════════════════════
// 启动时初始化
// ═══════════════════════════════════════════════════════════════


/** 清理超过 STALE_THRESHOLD_MS 的残留 marker */
function cleanStaleMarkers() {
  const now = Date.now();
  for (const root of roots) {
    const markerPath = path.join(root.path, ".agent-undo", "active-session.json");
    try {
      if (!fs.existsSync(markerPath)) continue;
      const content = JSON.parse(fs.readFileSync(markerPath, "utf8"));
      if (content.agent !== "openclaw" && !content.agent?.startsWith("openclaw/")) continue;
      const ageMs = now - (content.started_at_ns / 1e6);
      if (ageMs > STALE_THRESHOLD_MS) fs.unlinkSync(markerPath);
    } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════
// au Session + Daemon + Hook 管理
// ═══════════════════════════════════════════════════════════════

/** 从 sessionKey 提取渠道名，拼接为 openclaw/{channel} */
function extractChannel(sessionKey) {
  if (!sessionKey || sessionKey === "unknown") return "openclaw";
  const parts = sessionKey.split(":").filter(Boolean);
  // 格式: agent:{agentName}:{channelInfo...}
  // parts[0]=agent, parts[1]=main, parts[2+]=channel
  if (parts.includes("cron")) return "openclaw/cron";
  if (parts.includes("subagent")) return "openclaw/subagent";
  const ch = parts[2] || parts[1] || "";
  if (ch.startsWith("feishu")) return "openclaw/feishu";
  if (ch.startsWith("desktop")) return "openclaw/desktop";
  if (ch.startsWith("webchat")) return "openclaw/webchat";
  if (ch === "main") return "openclaw/webchat";
  if (ch) return ch.includes('/') ? ch : `openclaw/${ch}`;
  return sessionKey;
}

/** 自动 pin：距上次操作超过 autoPinGapDays 天时自动打书签 */
function autoPinIfNeeded(projectRoot) {
  if (autoPinGapDays <= 0) return;
  const existing = roots.find(r => r.path === projectRoot);
  if (!existing?.lastUsed) return;
  // 同一天已 pin 过，跳过
  const today = nowISO().slice(0, 10);
  if (existing.autoPinLastAt && existing.autoPinLastAt.slice(0, 10) === today) return;
  const lastUsedMs = new Date(existing.lastUsed).getTime();
  if (isNaN(lastUsedMs)) return;
  const gapMs = Date.now() - lastUsedMs;
  if (gapMs > autoPinGapDays * 86400000) {
    const ts = nowISO().slice(0, 16).replace("T", "_");
    const label = `auto-openclaw-${ts}`;
    try {
      execSync(`au pin "${label}"`, { cwd: projectRoot, timeout: 5000 });
      existing.autoPinLastAt = nowISO();
      if (!existing.autoPinList) existing.autoPinList = [];
      existing.autoPinList.push(label);
      if (existing.autoPinList.length > 30) existing.autoPinList.shift();
      saveCache();
    } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════
// 路径提取（从工具参数/代码中提取写入目标路径）
// ═══════════════════════════════════════════════════════════════

/** 从工具参数中提取所有本地文件/文件夹路径（不区分读写，au daemon 只监控实际变更） */
function extractAllPaths(toolName, params) {
  if (!params || typeof params !== "object") return [];
  const results = [];
  const seen = new Set();

  function addPath(p, isDir) {
    if (!p || typeof p !== "string") return;
    // 过滤飞书 ID（非本地路径）
    if (/^(ou_|oc_|om_|fldcn_|doxcn|sheetcn|wikicn|bitablecn)/.test(p)) return;
    // 过滤 URL
    if (/^https?:\/\//.test(p)) return;
    // 过滤 base64
    if (/^[A-Za-z0-9+/=]{50,}$/.test(p)) return;
    // 过滤正则误匹配：包含正则元字符的不是合法文件路径
    if (/[|*+?(){}[\]\\^$]/.test(p)) return;
    // ~ 展开
    if (p.startsWith("~")) p = path.join(os.homedir(), p.slice(1));
    // 跳过重复
    if (seen.has(p)) return;
    seen.add(p);
    results.push({ path: p, isDir });
  }

  // 1. 从直接字段提取
  const fileFields = ["path", "file_path", "filePath", "dest", "target", "output_path"];
  const dirFields = ["workdir", "cwd", "folder_token", "folder"];
  for (const f of fileFields) addPath(params[f], false);
  for (const f of dirFields) addPath(params[f], true);

  // 2. 从 code/command 字段提取路径
  const codeFields = ["code", "command"];
  for (const f of codeFields) {
    const v = params[f];
    if (!v || typeof v !== "string") continue;
    // 绝对路径（黑名单模式：匹配 / 开头，到分隔符为止）
    for (const m of v.matchAll(/['"]?(\/[^\s'"`,;|&<>]+)['"]?/g)) {
      const p = m[1];
      if (!/^(\/dev\/|\/proc\/|\/sys\/|\/usr\/|\/bin\/|\/sbin\/|\/lib\/|\/etc\/)/.test(p)) {
        addPath(p, p.endsWith("/") || !path.extname(p));
      }
    }
    // ~/ 路径
    for (const m of v.matchAll(/['"]?~(\/[^\s'"`,;|&<>]+)['"]?/g)) {
      addPath(path.join(os.homedir(), m[1]), false);
    }
    // cd 目标
    for (const m of v.matchAll(/cd\s+['"]?(\/[^\s'"`;|&<>]+)['"]?/g)) {
      addPath(m[1], true);
    }
  }

  // 3. 从 commands 数组提取（ctx_batch_execute）
  if (Array.isArray(params.commands)) {
    for (const item of params.commands) {
      const cmd = item?.command;
      if (!cmd || typeof cmd !== "string") continue;
      for (const m of cmd.matchAll(/['"]?(\/[^\s'"`,;|&<>]+)['"]?/g)) {
        const p = m[1];
        if (!/^(\/dev\/|\/proc\/|\/sys\/|\/usr\/|\/bin\/|\/sbin\/|\/lib\/|\/etc\/)/.test(p)) {
          addPath(p, p.endsWith("/") || !path.extname(p));
        }
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// au Session + Daemon 管理
// ═══════════════════════════════════════════════════════════════

/** 确保 au session 已启动，返回 { sessionId, channel } */
function ensureAuSession(projectRoot, channel, sessionKey) {
  const mapKey = `${projectRoot}::${sessionKey}`;
  // 每次 hook 前都确保 daemon 存活（防止 daemon 挂后缓存命中跳过检查）
  if (!isDaemonAlive(projectRoot)) {
    startAuDaemon(projectRoot);
  }
  if (auSessions.has(mapKey)) return auSessions.get(mapKey);

  try {
    const result = execSync(`au session start --agent ${channel}`, {
      cwd: projectRoot, timeout: 5000, encoding: "utf8",
    }).trim();
    if (result.startsWith("session-")) {
      const entry = { sessionId: result, channel };
      auSessions.set(mapKey, entry);
      return entry;
    }
    console.warn(`[agent-undo-hook] au session start unexpected: ${result}`);
  } catch (e) {
    console.warn(`[agent-undo-hook] au session start failed: ${e.message}`);
  }
  return null;
}

/** 执行 au hook pre，返回是否成功 */
function hookPre(projectRoot, sessionEntry, filePath, toolName) {
  try {
    execSync('au hook pre', {
      cwd: projectRoot, timeout: 5000,
      input: JSON.stringify({
        session_id: sessionEntry.sessionId,
        tool_name: toolName,
        agent: sessionEntry.channel,
        tool_input: filePath ? { file_path: filePath } : {},
        tool_response: null,
      }),
    });
    return true;
  } catch { return false; }
}


/** 启发式发现候选项目根（无 .git / .agent-undo / PROJECT_MARKERS 时使用） */
function findCandidateRoots(filePath) {
  const candidates = [];
  let cur = fs.realpathSync(path.resolve(path.dirname(filePath)));
  let level = 0;

  while (cur !== "/" && level < 5) {
    level++;
    const basename = path.basename(cur);

    // 跳过已在 roots 中的项目
    if (roots.some(r => r.path === cur)) { cur = path.dirname(cur); continue; }

    // 精确层：标记文件
    for (const marker of PROJECT_MARKERS) {
      if (fs.existsSync(path.join(cur, marker))) {
        return [cur]; // 高置信度，直接返回
      }
    }


    // 中等层：目录结构特征（≥2 个项目子目录）
    try {
      const entries = fs.readdirSync(cur, { withFileTypes: true });
      const subdirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      const projectSubdirs = ["src", "lib", "bin", "config", "docs", "scripts", "tests", "test", "spec", "data", "models"];
      const matchCount = subdirs.filter(d => projectSubdirs.includes(d)).length;
      if (matchCount >= 2) {
        candidates.push(cur);
        cur = path.dirname(cur);
        continue;
      }
    } catch {}

    // 宽松层：容器目录的直接子目录
    const parent = path.dirname(cur);
    const parentBasename = path.basename(parent);
    if (PROJECT_CONTAINER_DIRS.has(parentBasename) && basename !== ".openclaw") {
      candidates.push(cur);
    }

    cur = path.dirname(cur);
  }

  // 去重 + 最多3个
  return [...new Set(candidates)].slice(0, 3);
}

/** 检查 au daemon 是否存活（实时检查，不依赖缓存） */
function isDaemonAlive(projectRoot) {
  const pidPath = path.join(projectRoot, ".agent-undo", "daemon.pid");
  if (!fs.existsSync(pidPath)) return false;
  try {
    const pid = parseInt(fs.readFileSync(pidPath, "utf8").trim());
    process.kill(pid, 0);
    return true;
  } catch { return false; }
}

/** 启动项目的 au daemon */
function startAuDaemon(projectRoot) {
  try {
    execSync("au serve --daemon", { cwd: projectRoot, timeout: 10000, encoding: "utf8" });
    return true;
  } catch { return false; }
}

/** 停止项目的 au daemon */
function stopAuDaemon(projectRoot) {
  try { execSync("au stop", { cwd: projectRoot, timeout: 5000, encoding: "utf8" }); } catch {}
}

/** 关闭所有 au hook post（归因窗口），不结束 session */
/** 对指定 sessionKey 执行 au hook post（关闭归因窗口） */
function postSessionHooks(sessionKey) {
  for (const [mapKey, entry] of auSessions) {
    if (!mapKey.endsWith(`::${sessionKey}`)) continue;
    const projectRoot = mapKey.split("::").slice(0, -1).join("::");
    try {
      execSync('au hook post', {
        cwd: projectRoot,
        timeout: 5000,
        input: JSON.stringify({
          session_id: entry.sessionId,
          tool_name: "",
          agent: entry.channel,
          tool_input: {},
          tool_response: null,
        }),
      });
    } catch {}
  }
}

/** 结束指定 sessionKey 的 au session 并写入 metadata */
function endSession(sessionKey) {
  for (const [mapKey, entry] of auSessions) {
    if (!mapKey.endsWith(`::${sessionKey}`)) continue;
    const projectRoot = mapKey.split("::").slice(0, -1).join("::");
    const td = turnDataMap.get(sessionKey) || {};

    // 确保 daemon 存活再 end
    if (!isDaemonAlive(projectRoot)) {
      startAuDaemon(projectRoot);
    }

    try {
      const metadata = JSON.stringify({
        prompt: td.prompt,
        model: td.model,
        prompt_output: td.promptOutput,
      });
      execSync(`au session end ${entry.sessionId} --metadata '${escapeShell(metadata)}'`, { cwd: projectRoot, timeout: 5000 });
      auSessions.delete(mapKey);  // 只有成功才删
    } catch (e) {
      // 失败不删 Map，下次重试
      console.warn(`[agent-undo-hook] au session end failed: ${e.message}`);
    }
  }
  turnDataMap.delete(sessionKey);
}

/** 兜底：结束所有残留 au session（Gateway 关闭等场景） */
function endAllAuSessions() {
  for (const [mapKey, entry] of auSessions) {
    const projectRoot = mapKey.split("::").slice(0, -1).join("::");
    const sk = mapKey.split("::").pop();
    const td = turnDataMap.get(sk) || {};
    try {
      const metadata = JSON.stringify({ prompt: td.prompt, model: td.model, prompt_output: td.promptOutput });
      execSync(`au session end ${entry.sessionId} --metadata '${escapeShell(metadata)}'`, { cwd: projectRoot, timeout: 5000 });
    } catch {}
  }
  auSessions.clear();
  turnDataMap.clear();
}

/** 组合：校验 daemon + auto-pin + 启动 session + au hook pre */
function ensureSessionAndHookPre(projectRoot, targetPath, toolName, sessionKey, isDir) {
  const channel = extractChannel(sessionKey);
  const sessionEntry = ensureAuSession(projectRoot, channel, sessionKey);
  if (!sessionEntry) return;

  autoPinIfNeeded(projectRoot);

  const filePath = isDir ? null : targetPath;
  hookPre(projectRoot, sessionEntry, filePath, toolName);
}

// ═══════════════════════════════════════════════════════════════
// /undo 和 /au 命令辅助
// ═══════════════════════════════════════════════════════════════

/** 执行 au 命令，返回 { ok, stdout, stderr } */
function execAu(args, cwd) {
  try {
    const stdout = execSync(`au ${args}`, { cwd, timeout: 10000, encoding: "utf8" });
    return { ok: true, stdout: stdout.trim(), stderr: "" };
  } catch (e) {
    return { ok: false, stdout: e.stdout?.toString().trim() || "", stderr: e.stderr?.toString().trim() || e.message };
  }
}

/** Shell 转义：单引号内嵌入单引号 */
function escapeShell(str) {
  return String(str || "").replace(/'/g, "'\\''");
}

/**
 * 解析项目选择参数：@N 或 @项目名
 * @param {string|null} arg - 用户输入的项目选择参数
 * @returns {string|null} 项目根路径
 */
function resolveProjectRoot(arg) {
  if (roots.length === 0) return null;
  if (!arg) return roots[0].path; // 默认第1个

  // @数字 → 第 N 个
  const numMatch = arg.match(/^@(\d+)$/);
  if (numMatch) {
    const idx = parseInt(numMatch[1]) - 1;
    return roots[idx]?.path || null;
  }

  // @字符串 → 模糊匹配目录名
  const nameMatch = arg.match(/^@(.+)$/);
  if (nameMatch) {
    const query = nameMatch[1].toLowerCase();
    for (const r of roots) {
      const dirName = path.basename(r.path).toLowerCase();
      if (dirName.includes(query)) return r.path;
    }
    return null;
  }

  // 不带 @ → 默认第1个
  return roots[0].path;
}

/** 格式化项目列表（前3个，用于命令输出） */
function formatProjectList() {
  const initialized = roots.filter(r => r.initialized);
  if (initialized.length === 0) return "（无已初始化项目）";
  const items = initialized.slice(0, 5).map((r, i) => {
    const dirName = path.basename(r.path);
    const daemon = isDaemonAlive(r.path) ? "🟢" : "🔴";
    return `${i + 1}. ${dirName} ${daemon}`;
  });
  return items.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// 插件注册
// ═══════════════════════════════════════════════════════════════

module.exports = {
  id: "agent-undo-hook",
  name: "Agent Undo Hook",
  register(api) {
    loadCache();
    // 从 api.pluginConfig 读取配置（OpenClaw 框架注入，已校验）
    const cfg = api.pluginConfig || {};
    if (cfg.uninitRemindDailyLimit !== undefined) uninitRemindDailyLimit = cfg.uninitRemindDailyLimit;
    if (cfg.uninitRemindIntervalMin !== undefined) uninitRemindIntervalMin = cfg.uninitRemindIntervalMin;
    if (cfg.autostopIdleMinutes !== undefined) autostopIdleMinutes = cfg.autostopIdleMinutes;
    if (cfg.autoPinGapDays !== undefined) autoPinGapDays = cfg.autoPinGapDays;
    if (cfg.promptTruncLen !== undefined) promptTruncLen = cfg.promptTruncLen;
    if (cfg.outputTruncLen !== undefined) outputTruncLen = cfg.outputTruncLen;
    if (Array.isArray(cfg.uninitRemindIgnorePaths)) {
      uninitRemindIgnorePaths = cfg.uninitRemindIgnorePaths.map(p =>
        p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p
      );
    }
    cleanStaleMarkers();

    // 检测 au 命令是否可用
    try { execSync("which au", { timeout: 3000, encoding: "utf8" }); auAvailable = true; } catch {}
    if (!auAvailable) {
      uninitNoticeQueue.push(
        "⚠️ 未检测到 au 命令，文件变更追踪不可用（/undo 不可用）。\n" +
        "安装：curl -fsSL https://agent-undo.com/install.sh | sh\n" +
        "详见：https://github.com/peaktwilight/agent-undo"
      );
    }

    /** 追加文本到消息末尾（飞书只写 __ocCardAppend，其他渠道只写 msg.content） */
    function appendToMessage(msg, text, sk) {
      const suffix = "\n\n---\n\n" + text;
      const isFeishuChannel = sk?.includes("feishu");
      // 飞书渠道：追加到 __ocCardAppend
      if (isFeishuChannel) {
        if (!global.__ocCardAppend) global.__ocCardAppend = new Map();
        const existing = global.__ocCardAppend.get(sk) || "";
        global.__ocCardAppend.set(sk, existing + suffix);
        if (!global.__ocCardAppendReady) global.__ocCardAppendReady = new Map();
        const ready = global.__ocCardAppendReady.get(sk);
        if (ready) ready(text);
        return;  // 飞书到此结束，不写 msg.content
      }
      // 所有渠道：写 msg.content
      if (typeof msg.content === "string") {
        msg.content += suffix;
      } else if (Array.isArray(msg.content)) {
        const last = msg.content[msg.content.length - 1];
        if (last?.type === "text" && typeof last.text === "string") {
          last.text += suffix;
        } else {
          msg.content.push({ type: "text", text: suffix });
        }
      }
    }


    // ─── Hook 1: before_prompt_build — 清理闲置 daemon ───
    api.on("before_prompt_build", (event, ctx) => {
      const sk = ctx?.sessionKey;
      // 安全网：llm_output 未触发时（异常），清理当前 sk 的残留 au session
      if (sk && auSessions.size > 0) {
        endSession(sk);
      }
      // 每轮开始清空当前 sk 的 turnData，防止上一轮残留
      turnDataMap.delete(sk);
      // 暂存用户 prompt
      if (!sk) return;
      let p = typeof event.prompt === "string" ? event.prompt : undefined;
      if (p) { for (const [re, rep] of PROMPT_FILTERS) p = p.replace(re, rep); p = p.trim(); }
      let td = turnDataMap.get(sk) || {};
      td.prompt = p ? p.slice(0, promptTruncLen) : undefined;
      turnDataMap.set(sk, td);

      // 停止闲置 daemon（实时检查存活状态）
      if (autostopIdleMinutes > 0) {
        const cutoff = Date.now() - autostopIdleMinutes * 60 * 1000;
        for (const r of roots) {
          if (!r.initialized ) continue;
          if (new Date(r.lastUsed).getTime() < cutoff && isDaemonAlive(r.path)) {
            stopAuDaemon(r.path);
          }
        }
      }

      return undefined;
    }, { priority: 10 });

    // ─── Hook 2: before_tool_call — 工具调用追踪 ───
    // 在 agent 调用写入工具前，写入 marker 让 au daemon 归因
    api.on("before_tool_call", (event, ctx) => {
      try {
        const toolName = event.toolName;
        const sessionKey = ctx?.sessionKey;

        if (!sessionKey) {
          console.warn("[agent-undo-hook] before_tool_call: ctx.sessionKey is missing");
        }
        const resolvedKey = sessionKey || "unknown";
        if (SKIP_TRACK_TOOLS.has(toolName)) return;

        const paths = extractAllPaths(toolName, event.params);
        for (const p of paths) {
          trackWritePath(p.path, toolName, resolvedKey, p.isDir);
        }
      } catch (e) {
        console.error(`[agent-undo-hook] before_tool_call error: tool=${event?.toolName} error=${e?.message}`, e?.stack);
      }
    });

    // ─── Hook 3: before_message_write — 未初始化 au 项目提醒（用户可见）───
    api.on("before_message_write", (event, ctx) => {
      const msg = event.message;
      if (!msg || msg.role !== "assistant") return;
      if (msg.stopReason !== "stop" && msg.stopReason !== "end_turn") return;
      const sk = ctx?.sessionKey;
      if (!sk) return;

      if (uninitNoticeQueue.length === 0) return;

      // 消费时按项目去重输出（同一项目只输出一条提醒）
      const reminded = new Set();
      const seen = new Set();
      const texts = [];

      for (const item of uninitNoticeQueue) {
        const key = typeof item === 'string' ? item : item.rootPath;
        if (seen.has(key)) continue;
        seen.add(key);
        if (item.rootPath && !reminded.has(item.rootPath)) {
          markReminded(item.rootPath, item.filePath);
          reminded.add(item.rootPath);
        }
        texts.push(typeof item === 'string' ? item : item.text);
      }
      uninitNoticeQueue = [];

      appendToMessage(msg, texts.join("\n\n"), sk);
    });

    // ─── Hook 4: llm_output — 暂存 model + prompt_output，关闭归因并结束 au session ───
    api.on("llm_output", (event, ctx) => {
      const sk = ctx?.sessionKey;
      if (!sk) return;
      let td = turnDataMap.get(sk) || {};
      if (event.model) td.model = event.model;
      const texts = event.assistantTexts;
      if (texts?.length) {
        td.promptOutput = texts[texts.length - 1].slice(0, outputTruncLen);
      }
      turnDataMap.set(sk, td);
      // llm_output 时统一更新 lastUsed（避免 before_tool_call 每次都写）
      for (const [mapKey, entry] of auSessions) {
        if (mapKey.endsWith(`::${sk}`)) {
          const projectRoot = mapKey.split("::").slice(0, -1).join("::");
          updateRootLastUsed(projectRoot);
        }
      }
      postSessionHooks(sk);
      endSession(sk);
    });

    // ─── 命令：/undo ───
    api.registerCommand({
      name: "undo",
      description: "撤销最近一波 agent 文件操作（au oops）",
      acceptsArgs: true,
      requireAuth: false,
      async handler(ctx) {
        if (!auAvailable) {
          return { text: "⚠️ au 命令未安装，/undo 不可用。\n安装：curl -fsSL https://agent-undo.com/install.sh | sh\n详见：https://github.com/peaktwilight/agent-undo" };
        }
        const args = (ctx.args || "").trim().split(/\s+/);

        // /undo confirm → 执行撤销
        if (args[0] === "confirm") {
          const projectArg = args[1] ? `@${args[1]}` : null;
          const projectRoot = resolveProjectRoot(projectArg);
          if (!projectRoot) {
            return { text: `❌ 没有已追踪的 au 项目\n\n已追踪项目：\n${formatProjectList()}` };
          }
          const result = execAu("oops --confirm", projectRoot);
          if (result.ok) return { text: `✅ ${result.stdout}` };
          return { text: `❌ 撤销失败：${result.stderr || result.stdout}` };
        }

        // /undo [项目选择] → 预览
        const projectArg = args[0] ? `@${args[0]}` : null;
        const projectRoot = resolveProjectRoot(projectArg);
        if (!projectRoot) {
          return { text: `❌ 没有已追踪的 au 项目\n\n已追踪项目：\n${formatProjectList()}` };
        }

        // 检查 daemon 是否运行
        const status = execAu("status", projectRoot);
        if (!status.ok) {
          return { text: `❌ au daemon 未运行，请先在项目目录执行：\ncd ${projectRoot} && au serve --daemon` };
        }

        // 预览撤销内容
        const preview = execAu("oops", projectRoot);
        if (!preview.ok && !preview.stdout) {
          return { text: `❌ 预览失败：${preview.stderr}` };
        }
        const dirName = path.basename(projectRoot);
        return { text: `${preview.stdout || preview.stderr}\n\n📋 项目：${dirName}\n确认撤销？回复 /undo confirm` };
      },
    });

    // ─── 命令：/au ───
    api.registerCommand({
      name: "au",
      description: "Agent Undo 操作（子命令：log, status, blame, diff, sessions）",
      acceptsArgs: true,
      requireAuth: false,
      async handler(ctx) {
        if (!auAvailable) {
          return { text: "⚠️ au 命令未安装，/au 不可用。\n安装：curl -fsSL https://agent-undo.com/install.sh | sh\n详见：https://github.com/peaktwilight/agent-undo" };
        }
        const rawArgs = (ctx.args || "").trim();
        const parts = rawArgs.split(/\s+/);

        // 解析项目选择：第一个参数以 @ 开头
        let projectArg = null;
        let subArgs = parts;
        if (parts[0]?.startsWith("@")) {
          projectArg = parts[0];
          subArgs = parts.slice(1);
        }

        const projectRoot = resolveProjectRoot(projectArg);
        if (!projectRoot && subArgs[0] !== "help") {
          return { text: `❌ 没有已追踪的 au 项目\n\n已追踪项目：\n${formatProjectList()}` };
        }

        const sub = subArgs[0] || "help";
        const dirName = projectRoot ? path.basename(projectRoot) : "";

        switch (sub) {
          case "log": {
            const limit = subArgs[1] && !isNaN(subArgs[1]) ? subArgs[1] : "10";
            const result = execAu(`log --limit ${limit}`, projectRoot);
            if (!result.ok) return `❌ ${result.stderr}`;
            return { text: `📋 ${dirName} 最近 ${limit} 条操作：\n${result.stdout}` };
          }

          case "status": {
            const result = execAu("status", projectRoot);
            if (!result.ok) return `❌ au daemon 未运行\n\n启动：cd ${projectRoot} && au serve --daemon`;
            return { text: `✅ ${result.stdout}` };
          }

          case "blame": {
            const file = subArgs[1];
            if (!file) return "❌ 用法：/au blame <文件路径>";
            const absFile = path.isAbsolute(file) ? file : path.join(projectRoot, file);
            const relFile = path.relative(projectRoot, absFile);
            const result = execAu(`blame "${relFile}"`, projectRoot);
            if (!result.ok) return `❌ ${result.stderr}`;
            return { text: `📝 ${relFile} 归属：\n${result.stdout}` };
          }

          case "diff": {
            const eventId = subArgs[1];
            if (!eventId) return "❌ 用法：/au diff <事件ID>（先用 /au log 查看）";
            const result = execAu(`diff ${eventId}`, projectRoot);
            if (!result.ok) return `❌ ${result.stderr}`;
            return { text: `📊 事件 #${eventId} 改动：\n${result.stdout}` };
          }

          case "sessions": {
            const result = execAu("sessions", projectRoot);
            if (!result.ok) return `❌ ${result.stderr}`;
            return { text: `📋 au sessions：\n${result.stdout}` };
          }

          default:
            return { text: `🔍 /au 用法：
/au log [N]          - 查看最近 N 条操作（默认10）
/au status           - 查看 daemon 状态
/au blame <file>     - 查看文件每行归属
/au diff <event>     - 查看某次事件改动
/au sessions         - 查看 session 列表

项目选择（加在子命令前）：
/au @2 log           - 第2个项目的 log
/au @项目名 log      - 模糊匹配项目名

已追踪项目：
${formatProjectList()}` };
        }
      },
    });
  },
};

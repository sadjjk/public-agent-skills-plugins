"use strict";

const fs = require("fs");
const path = require("path");

// ─── Config ────────────────────────────────────────────────
let pluginConfig = { mode: "detailed" };
const STATS_MARKER = "\n\n---\n\n📊"; // 统计块起始标记

// ─── Token 格式化（K 单位）────────────────────────────────
function formatTokenK(n) {
  if (!n || n === 0) return "0K";
  const k = n / 1000;
  if (k >= 100) return k.toFixed(0) + "K";
  if (k >= 10) return k.toFixed(1) + "K";
  if (k >= 0.05) return k.toFixed(1) + "K";
  if (k > 0) return "0.1K";
  return "0K";
}

// ─── 耗时格式化（≥60s 显示 XmYs）──────────────────────────
function formatDuration(ms) {
  if (!ms || ms <= 0) return null;
  const s = ms / 1000;
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const rem = Math.round(s % 60);
    return rem > 0 ? `${m}m${rem}s` : `${m}m`;
  }
  return s >= 10 ? s.toFixed(1) + "s" : s.toFixed(2) + "s";
}

// ─── 价格加载（从 openclaw.json 读取）──────────────────────
let pricingCache = {};
let modelContextMap = {}; // modelId → { contextTokens, contextWindow }
let configPath = null;
let watcher = null;

function loadPricing() {
  try {
    const home = process.env.HOME || process.env.USERPROFILE || "/root";
    configPath = path.join(home, ".openclaw", "openclaw.json");
    const raw = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(raw);
    const pricing = {};
    const providers = config?.models?.providers || {};
    for (const [provKey, provider] of Object.entries(providers)) {
      for (const model of provider.models || []) {
        const cost = model.cost;
        if (
          cost &&
          (cost.input || cost.output || cost.cacheRead || cost.cacheWrite)
        ) {
          const hasNonZero =
            cost.input > 0 ||
            cost.output > 0 ||
            (cost.cacheRead ?? 0) > 0 ||
            (cost.cacheWrite ?? 0) > 0;
          if (hasNonZero) {
            const entry = {
              input: cost.input || 0,
              output: cost.output || 0,
              cacheRead: cost.cacheRead || 0,
              cacheWrite: cost.cacheWrite || 0,
            };
            pricing[model.id] = entry;
            // 同时注册 provider/modelId 格式（event.model 带 provider 前缀）
            pricing[`${provKey}/${model.id}`] = entry;
          }
        }
      }
    }
    pricingCache = pricing;

    // 同时构建 model→contextTokens 映射（同样注册两种 key）
    const ctxMap = {};
    for (const [provKey, prov] of Object.entries(providers)) {
      for (const model of prov.models || []) {
        const entry = {
          contextTokens: model.contextTokens || model.contextWindow || 0,
          contextWindow: model.contextWindow || 0,
        };
        ctxMap[model.id] = entry;
        ctxMap[`${provKey}/${model.id}`] = entry;
      }
    }
    modelContextMap = ctxMap;
  } catch {
    pricingCache = {};
    modelContextMap = {};
  }
}

function startConfigWatcher() {
  if (watcher) return;
  if (!configPath) {
    const home = process.env.HOME || process.env.USERPROFILE || "/root";
    configPath = path.join(home, ".openclaw", "openclaw.json");
  }
  try {
    watcher = fs.watch(configPath, { persistent: false }, (eventType) => {
      if (eventType === "change") {
        setTimeout(() => {
          loadPricing();
        }, 500);
      }
    });
    watcher.on("error", () => {});
  } catch {
    // watch 失败不影响功能
  }
}

// ─── 费用计算 ─────────────────────────────────────────────
// input 扣除 cacheRead 部分，分别按不同价格计费
function calcCost(usage, modelId) {
  const price = pricingCache[modelId];
  if (!price) return { cost: null, reason: "未知模型" };
  const input = usage.input || 0;
  const output = usage.output || 0;
  const cacheRead = usage.cacheRead || 0;
  const cacheWrite = usage.cacheWrite || 0;
  // 适配两种上报模式：input>cacheRead（包含式）→ 扣除；input<=cacheRead（分离式）→ 直接用 input
  const nonCached = input > cacheRead ? input - cacheRead : input;
  const total =
    nonCached * price.input +
    output * price.output +
    cacheRead * price.cacheRead +
    cacheWrite * price.cacheWrite;
  const result = total / 1e6;
  if (result === 0) return { cost: null, reason: "价格未配置" };
  return { cost: result, reason: null };
}

function formatCost(costVal, reason) {
  if (costVal === null || costVal === undefined) {
    return reason ? `N/A(${reason})` : "N/A";
  }
  if (costVal < 0.0001) return "$" + costVal.toFixed(6);
  if (costVal < 0.01) return "$" + costVal.toFixed(4);
  return "$" + costVal.toFixed(2);
}

// ─── 轮次统计累积器 ────────────────────────────────────────
const turnStats = new Map();

function getStats(sessionKey) {
  if (!turnStats.has(sessionKey)) {
    turnStats.set(sessionKey, {
      llmCalls: 0,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      lastRawInput: 0,
      model: null,
      provider: null,
      agentId: null,
      toolCalls: [],
      promptBuildMs: null,
      agentEndDurationMs: null,
      agentEndReached: false,
      outputWritten: false,
      toolRounds: 0,
      lastToolCallTs: 0,
      skillsUsed: new Map(),
    });
  }
  return turnStats.get(sessionKey);
}

function clearStats(sessionKey) {
  turnStats.delete(sessionKey);
}

// ─── 工具分类（detailed 模式用）───────────────────────────
const TOOL_CATEGORIES = [
  {
    emoji: "⚙️",
    label: "系统文件",
    match: (n) => /^(exec|read|write|edit|process|gateway|cron)$/.test(n),
  },
  {
    emoji: "🌐",
    label: "网络搜索",
    match: (n) =>
      /^(web_fetch|context-mode__ctx_execute|context-mode__ctx_execute_file|context-mode__ctx_fetch_and_index|context-mode__ctx_search|context-mode__ctx_batch_execute)$/.test(
        n,
      ),
  },
  {
    emoji: "🧠",
    label: "记忆上下文",
    match: (n) =>
      /^(memory_|context-mode__ctx_index|context-mode__ctx_stats|context-mode__ctx_doctor|context-mode__ctx_insight|context-mode__ctx_purge|context-mode__ctx_upgrade|lcm_)/.test(
        n,
      ),
  },
  { emoji: "🪶", label: "飞书", match: (n) => /^(feishu_|message)/.test(n) },
  {
    emoji: "🤝",
    label: "会话代理",
    match: (n) => /^(sessions_|subagents)/.test(n),
  },
  {
    emoji: "🖼️",
    label: "媒体输出",
    match: (n) => /^(tts|canvas|nodes)$/.test(n),
  },
];

const SKILL_CATEGORIES = [
  {
    emoji: "🛠",
    label: "开发",
    match: (n) =>
      /^(skill-creator|skill-vetter|session-cleanup|md-viewer|github|gh-issues|taskflow|mcporter|coding-agent)/.test(
        n,
      ),
  },
  {
    emoji: "🌐",
    label: "集成",
    match: (n) =>
      /^(weather|healthcheck|node-connect|1password|notion|slack|discord|trello|obsidian|canvas|voice-call)/.test(
        n,
      ),
  },
];

function categorizeSkill(filePath) {
  const match = filePath.match(/\/skills\/([^/]+)\//);
  const skillName = match ? match[1] : "";
  for (const cat of SKILL_CATEGORIES) {
    if (cat.match(skillName)) return { emoji: cat.emoji, label: cat.label };
  }
  return { emoji: "📦", label: "其他" };
}

function categorizeTool(name) {
  for (const cat of TOOL_CATEGORIES) {
    if (cat.match(name)) return { emoji: cat.emoji, label: cat.label };
  }
  return { emoji: "🔧", label: "其他" };
}

function abbreviateLongName(name, maxLen = 24) {
  if (name.length <= maxLen) return name;
  const clean = name.replace(/^context-mode__/, "ctx_");
  if (clean.length <= maxLen) return clean;
  const half = Math.floor((maxLen - 1) / 2);
  return clean.slice(0, half) + "…" + clean.slice(-half);
}

function buildDetailedToolSummary(toolCalls) {
  const counts = {};
  for (const tc of toolCalls) {
    const cat = categorizeTool(tc.name);
    const key = cat.emoji;
    if (!counts[key])
      counts[key] = { emoji: cat.emoji, label: cat.label, tools: {} };
    const displayName = abbreviateLongName(tc.name);
    counts[key].tools[displayName] = (counts[key].tools[displayName] || 0) + 1;
  }
  const categoryOrder = TOOL_CATEGORIES.map((c) => c.emoji).concat(["🔧"]);
  const lines = [];
  for (const emoji of categoryOrder) {
    const cat = counts[emoji];
    if (!cat) continue;
    const toolParts = Object.entries(cat.tools)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => (count > 1 ? `${name}×${count}` : name))
      .join(" | ");
    lines.push(`${cat.emoji} ${toolParts}`);
  }
  return lines.join("  \n");
}

// ─── API 调用数推算 ────────────────────────────────────────
// 工具轮次通过 after_tool_call 时间窗口分组（100ms 内 = 同一轮）
// API 调用数 = 工具轮次 + 1（最终回复轮）
const TOOL_ROUND_GROUP_MS = 100;

function estimateApiCalls(stats) {
  return stats.toolRounds === 0 ? 1 : stats.toolRounds + 1;
}

// ─── 统计块格式化 ──────────────────────────────────────────

// compact: 📊2.4K·📏26%·🔁3·💰$0.002·⏱12s·🛠4·📖2
function buildCompactBlock(stats) {
  const parts = [];
  if (stats.usage.total > 0) {
    const estMark = stats._estimated ? "≈" : "";
    parts.push("📊" + estMark + formatTokenK(stats.usage.total));
  }
  // 📏 Context 占比
  if (stats.lastRawInput > 0 && stats.model) {
    const ctxInfo = modelContextMap[stats.model];
    if (ctxInfo && ctxInfo.contextTokens > 0) {
      const pct = Math.round(
        (stats.lastRawInput / ctxInfo.contextTokens) * 100,
      );
      parts.push("📏" + pct + "%");
    }
  }
  const apiCalls = estimateApiCalls(stats);
  if (apiCalls > 0) {
    parts.push("🔁~" + apiCalls);
  }
  if (stats.usage.total > 0 && stats.model) {
    const { cost: costVal } = calcCost(stats.usage, stats.model);
    if (costVal !== null) {
      parts.push("💰" + formatCost(costVal));
    }
  }
  const totalDur = stats.promptBuildMs
    ? formatDuration(Date.now() - stats.promptBuildMs)
    : null;
  if (totalDur) {
    parts.push("⏱" + totalDur);
  }
  if (stats.toolCalls.length > 0) {
    const uniqueTools = new Set(stats.toolCalls.map((tc) => tc.name)).size;
    parts.push("🛠" + uniqueTools);
  }
  if (stats.skillsUsed.size > 0) {
    parts.push("📖" + stats.skillsUsed.size);
  }
  return parts.join("·");
}

// detailed: markdown 格式化
function buildDetailedBlock(stats) {
  const lines = [];
  const agentId =
    (stats.agentId || "main").charAt(0).toUpperCase() +
    (stats.agentId || "main").slice(1);
  const model = stats.model || "?";
  const provider = stats.provider || "?";
  const usage = stats.usage;

  // usage：精确值不加 ≈，估算值加 ≈
  const estMark = stats._estimated ? "≈" : "";
  const inK = estMark + formatTokenK(usage.input);
  const outK = estMark + formatTokenK(usage.output);
  const totK = estMark + formatTokenK(usage.total);
  const cacheParts = [];
  if (usage.cacheRead > 0) cacheParts.push(formatTokenK(usage.cacheRead));
  if (usage.cacheWrite > 0) cacheParts.push(formatTokenK(usage.cacheWrite));
  const cacheStr =
    cacheParts.length > 0 ? ` | cache:${cacheParts.join("+")}` : "";

  lines.push(`📊 **Token** ${inK}→${outK}${cacheStr} | **${totK}**`);

  // 📏 Context 占比
  if (stats.lastRawInput > 0 && stats.model) {
    const ctxInfo = modelContextMap[stats.model];
    if (ctxInfo && ctxInfo.contextTokens > 0) {
      const usedK = formatTokenK(stats.lastRawInput);
      const totalK = formatTokenK(ctxInfo.contextTokens);
      const pct = Math.round(
        (stats.lastRawInput / ctxInfo.contextTokens) * 100,
      );
      lines.push(`📏 **Context** ${usedK} / ${totalK} ${pct}%`);
    }
  }

  const apiParts = [];
  apiParts.push(`🔁 **Rounds: ≈${estimateApiCalls(stats)}**`);
  if (usage.total > 0 && stats.model) {
    const { cost: costVal, reason } = calcCost(usage, stats.model);
    const costMark = stats._estimated ? "≈" : "";
    apiParts.push(`💰 ${costMark}${formatCost(costVal, reason)}`);
  }
  lines.push(apiParts.join(" | "));
  lines.push(`🤖 **${agentId}** | ${provider} | ${model}`);

  const totalDur = stats.promptBuildMs
    ? formatDuration(Date.now() - stats.promptBuildMs)
    : null;
  if (totalDur) {
    lines.push("⏱️ **Time** " + totalDur);
  }

  if (stats.toolCalls.length > 0) {
    const totalTools = stats.toolCalls.length;
    const uniqueTools = new Set(stats.toolCalls.map((tc) => tc.name)).size;
    const toolLines = buildDetailedToolSummary(stats.toolCalls);
    lines.push(`🛠️ **Tools** ${uniqueTools}个 ${totalTools}次:`);
    lines.push("\u2003" + toolLines.replace(/\n/g, "\n\u2003"));
  }

  if (stats.skillsUsed.size > 0) {
    const skillTotal = [...stats.skillsUsed.values()].reduce(
      (a, v) => a + v.count,
      0,
    );
    const catGroups = {};
    for (const [name, info] of stats.skillsUsed.entries()) {
      const key = info.category.emoji;
      if (!catGroups[key])
        catGroups[key] = {
          emoji: info.category.emoji,
          label: info.category.label,
          skills: {},
        };
      catGroups[key].skills[name] = info.count;
    }
    const skillLines = [];
    for (const [, group] of Object.entries(catGroups)) {
      const parts = Object.entries(group.skills)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => (count > 1 ? `${name}×${count}` : name))
        .join(" | ");
      skillLines.push(`${group.emoji} ${parts}`);
    }
    lines.push(`📖 **Skills** ${stats.skillsUsed.size}个 ${skillTotal}次:`);
    lines.push("\u2003" + skillLines.join("  \n\u2003"));
  }

  return lines.join("  \n");
}

function buildStatsBlock(stats) {
  return pluginConfig.mode === "detailed"
    ? buildDetailedBlock(stats)
    : buildCompactBlock(stats);
}

// ─── 插件注册 ──────────────────────────────────────────────
module.exports = {
  id: "usage-stats-hook",
  name: "Usage Stats",
  register(api) {
    loadPricing();
    // 从 api.pluginConfig 读取插件配置（框架已合并 configSchema default + 用户配置）
    if (api.pluginConfig) {
      pluginConfig = { ...pluginConfig, ...api.pluginConfig };
    }
    startConfigWatcher();

    // ── llm_output: 记录模型/工具调用元数据，清理上一轮状态 ──
    // 注意：llm_output 在 before_message_write 之后触发，无法用于当轮 usage 统计
    api.on("llm_output", (event, ctx) => {
      const sk = ctx?.sessionKey;
      if (!sk || sk.includes(":subagent:") || sk.includes(":cron:")) return;

      // 上一轮已输出 → 清理后开始新一轮
      const prevStats = turnStats.get(sk);
      let clearedPreviousTurn = false;
      if (prevStats && prevStats.outputWritten) {
        clearStats(sk);
        clearedPreviousTurn = true;
      }

      const stats = getStats(sk);
      stats.llmCalls++;
      if (event.model) stats.model = event.model;
      if (event.provider) stats.provider = event.provider;
      if (ctx?.agentId) stats.agentId = ctx.agentId;
      if (!stats.promptBuildMs) stats.promptBuildMs = Date.now();

      // 从 lastAssistant 提取工具调用（补充 after_tool_call 未触发的情况）
      if (event.lastAssistant && event.lastAssistant.stopReason === "toolUse") {
        const toolUseBlocks = (event.lastAssistant.content || []).filter(
          (b) => b.type === "tool_use",
        );
        if (toolUseBlocks.length > 0) {
          for (const block of toolUseBlocks) {
            const alreadyRecorded = stats.toolCalls.some(
              (tc) =>
                tc.name === block.name && tc._source === "after_tool_call",
            );
            if (!alreadyRecorded) {
              stats.toolCalls.push({
                name: block.name,
                durationMs: null,
                _source: "llm_output",
              });
            }
          }
        }
      }
    });

    // ── before_tool_call: 检测 skill 文件读取 ──
    api.on("before_tool_call", (event, ctx) => {
      if (
        !["read", "context-mode__ctx_execute_file", "edit"].includes(
          event.toolName,
        )
      )
        return;
      const filePath = event.params?.path;
      if (!filePath || typeof filePath !== "string") return;

      const sk = ctx?.sessionKey;
      if (!sk || sk.includes(":subagent:") || sk.includes(":cron:")) return;

      const match = filePath.match(/\/skills\/([^/]+)\//);
      if (match) {
        const stats = getStats(sk);
        const skillName = match[1];
        const category = categorizeSkill(filePath);
        const existing = stats.skillsUsed.get(skillName);
        if (existing) {
          existing.count++;
        } else {
          stats.skillsUsed.set(skillName, { count: 1, category });
        }
      }
    });

    // ── after_tool_call: 累积工具调用 + 推算轮次 ──
    api.on("after_tool_call", (event, ctx) => {
      const sk = ctx?.sessionKey;
      if (!sk || sk.includes(":subagent:") || sk.includes(":cron:")) return;

      const stats = getStats(sk);
      const now = Date.now();

      // 首次创建 stats 时记录起始时间（首轮 llm_output 尚未触发）
      if (!stats.promptBuildMs) stats.promptBuildMs = now;

      // 100ms 内的 after_tool_call 视为同一轮（并行调用）
      if (now - stats.lastToolCallTs > TOOL_ROUND_GROUP_MS) {
        stats.toolRounds++;
      }
      stats.lastToolCallTs = now;

      stats.toolCalls.push({
        name: event.toolName || "unknown",
        durationMs: event.durationMs || null,
        _source: "after_tool_call",
      });
    });

    // ─── session → channel 映射 ──

    // ── before_prompt_build: 记录单轮起始时间 + 渠道 ──
    api.on("before_prompt_build", (event, ctx) => {
      const sk = ctx?.sessionKey;
      if (!sk || sk.includes(":subagent:") || sk.includes(":cron:")) return;

      const stats = getStats(sk);
      stats.promptBuildMs = Date.now();

      // 记录渠道，供 before_message_write 判断写入路径
      if (ctx?.channelId) {
      }
    });

    // ── agent_end: 记录总耗时 ──
    api.on("agent_end", (event, ctx) => {
      const sk = ctx?.sessionKey;
      if (!sk || sk.includes(":subagent:") || sk.includes(":cron:")) return;

      const stats = getStats(sk);
      stats.agentEndReached = true;
    });

    /** 追加文本到消息末尾（飞书只写 __ocCardAppend，其他渠道只写 msg.content） */
    function appendToMessage(msg, text, sk, replaceMarker) {
      const suffix = "\n\n---\n\n" + text;
      const isFeishuChannel = sk?.includes("feishu");
      // 飞书渠道：只写 __ocCardAppend（不写 msg.content，避免双渲染）
      if (isFeishuChannel) {
        if (!global.__ocCardAppend) global.__ocCardAppend = new Map();
        let existing = global.__ocCardAppend.get(sk) || "";
        // 去重：删除旧统计块
        const markerIdx = existing.lastIndexOf(STATS_MARKER);
        if (markerIdx !== -1) existing = existing.slice(0, markerIdx);
        global.__ocCardAppend.set(sk, existing + suffix);
        if (!global.__ocCardAppendReady) global.__ocCardAppendReady = new Map();
        const ready = global.__ocCardAppendReady.get(sk);
        if (ready) ready(text);
        return; // 飞书到此结束，不写 msg.content
      }
      // 其他渠道：写 msg.content
      if (typeof msg.content === "string") {
        if (replaceMarker) {
          const idx = msg.content.lastIndexOf(replaceMarker);
          if (idx !== -1) {
            msg.content = msg.content.slice(0, idx) + suffix;
            return;
          }
        }
        msg.content += suffix;
      } else if (Array.isArray(msg.content)) {
        const last = msg.content[msg.content.length - 1];
        if (last?.type === "text" && typeof last.text === "string") {
          if (replaceMarker) {
            const idx = last.text.lastIndexOf(replaceMarker);
            if (idx !== -1) {
              last.text = last.text.slice(0, idx) + suffix;
              return;
            }
          }
          last.text += suffix;
        } else {
          msg.content.push({ type: "text", text: suffix });
        }
      }
    }

    // ── before_message_write: 追加统计到消息末尾 ──
    // usage 主路径：msg.usage（per-call）× turnCount 估算，加 ≈ 标记
    api.on("before_message_write", (event, ctx) => {
      const msg = event.message;
      if (!msg || msg.role !== "assistant" || msg.stopReason !== "stop") return;
      const _ts = Date.now();
      const sk = ctx?.sessionKey;
      if (!sk || sk.includes(":subagent:") || sk.includes(":cron:")) return;

      const stats = getStats(sk);
      if (!stats) return;
      if (stats.llmCalls === 0) return;

      // 从 msg 提取 usage 估算总量
      // input × turnCount：每轮 input 包含之前所有轮的 output（对话历史累积）
      // output 只取最后一次：中间工具调用的 output 已作为下一轮 input 被统计
      if (msg.usage) {
        stats.lastRawInput =
          (msg.usage.input || 0) + (msg.usage.cacheRead || 0); // 上下文实际占用（含缓存）
        const turnCount = estimateApiCalls(stats); // 兜底：llm_output 未触发时至少算 1 轮
        stats.usage.input = (msg.usage.input || 0) * turnCount;
        stats.usage.output = msg.usage.output || 0;
        stats.usage.cacheRead = (msg.usage.cacheRead || 0) * turnCount;
        stats.usage.cacheWrite = (msg.usage.cacheWrite || 0) * turnCount;
        stats.usage.total = stats.usage.input + stats.usage.output;
        stats._estimated = true;
      }
      if (msg.model) stats.model = msg.model;
      if (msg.provider) stats.provider = msg.provider;

      const statsText = buildStatsBlock(stats);
      // STATS_MARKER 已提取为模块级常量

      // 去重：替换已有统计块（同一 turn 里 BMW 可能被调两次）
      const suffix = "\n\n---\n\n" + statsText;
      if (typeof msg.content === "string") {
        const idx = msg.content.lastIndexOf(STATS_MARKER);
        if (idx !== -1) msg.content = msg.content.slice(0, idx);
      } else if (Array.isArray(msg.content)) {
        const last = msg.content[msg.content.length - 1];
        if (last?.type === "text" && typeof last.text === "string") {
          const idx = last.text.lastIndexOf(STATS_MARKER);
          if (idx !== -1) last.text = last.text.slice(0, idx);
        }
      }

      appendToMessage(msg, statsText, sk);

      stats.outputWritten = true;
      stats.promptBuildMs = null;
    });
  },
};

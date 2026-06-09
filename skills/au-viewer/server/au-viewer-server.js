const express = require('express');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();

// ─── 配置 ───────────────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  // 兼容旧格式：projects 是 string[] 时升级为 object[]
  if (config.projects && config.projects.length > 0 && typeof config.projects[0] === 'string') {
    let nextId = 1;
    config.projects = config.projects.map(p => ({
      id: nextId++,
      name: path.basename(p),
      path: p,
      created_at: null,
    }));
    saveConfig();
  }
  // 清理旧 next_id 字段
  if ('next_id' in config) { delete config.next_id; saveConfig(); }
} catch {
  config = { port: 3457, projects: [] };
  saveConfig();
}
const PORT = config.port || 3457;

function saveConfig() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ─── 项目管理 ───────────────────────────────────────────────

/** 打开项目 DB */
function openProject(projectPath) {
  const dbPath = path.join(projectPath, '.agent-undo', 'timeline.db');
  if (!fs.existsSync(dbPath)) return null;
  const db = new Database(dbPath, { readonly: true });
  return { path: projectPath, name: path.basename(projectPath), db };
}

/** 根据 id 查找 config 中的项目 */
function findProject(id) {
  return (config.projects || []).find(p => p.id === id);
}

// ─── SSR 模板 ───────────────────────────────────────────────

function getViewTemplate(currentId) {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const refreshInterval = config.refresh_interval || 30000;
  const cacheBust = Date.now();
  const inject = `<script>
let CURRENT_PROJECT_ID = ${currentId};
const REFRESH_INTERVAL = ${refreshInterval};
const CACHE_BUST = ${cacheBust};
</script>`;
  return html.replace('</head>', inject + '\n</head>');
}

// ─── 路由 ───────────────────────────────────────────────────

// 主路由：/i/:id
app.get('/i/:id', (req, res) => {
  const id = parseInt(req.params.id);
  res.type('html').send(getViewTemplate(id));
});

// 根路径 → 有项目跳第一个，无项目跳欢迎页
app.get('/', (req, res) => {
  if (config.projects && config.projects.length > 0) {
    res.redirect('/i/' + config.projects[0].id);
  } else {
    res.redirect('/i/0');
  }
});

// ─── API ────────────────────────────────────────────────────

// 项目列表
app.get('/api/projects', (req, res) => {
  const projects = (config.projects || []).map(p => {
    let daemonStatus = 'uninit'; // 未初始化
    try {
      if (fs.existsSync(path.join(p.path, '.agent-undo'))) {
        const status = execSync('au status', { cwd: p.path, timeout: 5000, encoding: 'utf8' });
        daemonStatus = status.includes('daemon:   running') ? 'running' : 'stopped';
      }
    } catch { daemonStatus = 'stopped'; }
    return { ...p, daemonStatus };
  });
  res.json(projects);
});

// 启动 daemon
app.post('/api/daemon-start/:id', (req, res) => {
  const proj = findProject(parseInt(req.params.id));
  if (!proj) return res.json({ ok: false, error: '项目不存在' });
  try {
    execSync('au serve --daemon', { cwd: proj.path, timeout: 10000, encoding: 'utf8' });
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message.substring(0, 200) }); }
});

// 停止 daemon
app.post('/api/daemon-stop/:id', (req, res) => {
  const proj = findProject(parseInt(req.params.id));
  if (!proj) return res.json({ ok: false, error: '项目不存在' });
  try {
    execSync('au stop', { cwd: proj.path, timeout: 5000, encoding: 'utf8' });
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message.substring(0, 200) }); }
});

// 选中项目（切换 currentProject，更新 viewed_at）
app.get('/api/select/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const proj = findProject(id);
  if (!proj) return res.json({ ok: false, error: '项目不存在' });
  const opened = openProject(proj.path);
  if (!opened) return res.json({ ok: false, error: '无法打开项目（未初始化 au？）' });
  // 不再更新 created_at
  saveConfig();
  res.json({ ok: true, project: { id: proj.id, name: proj.name, path: proj.path } });
});

// 事件分页
app.get('/api/events', (req, res) => {
  const projectId = parseInt(req.query.projectId);
  const proj = findProject(projectId);
  if (!proj) return res.json({ ok: false, error: '未选择项目' });
  const opened = openProject(proj.path);
  if (!opened) return res.json({ ok: false, error: '无法打开项目' });

  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const agent = req.query.agent || '';
  const action = req.query.action || '';
  const session = req.query.session || '';
  const file = req.query.file || '';
  const since = req.query.since || '';  // hours

  let where = '1=1';
  const params = [];

  if (agent === 'other') {
    // other = 不在 top-N 中的 agent
    const maxAgents = config.agent_display_limit || 3;
    const topAgents = opened.db.prepare(
      `SELECT s.agent FROM sessions s WHERE s.agent IS NOT NULL AND s.agent != '' GROUP BY s.agent ORDER BY MAX(s.started_at_ns) DESC LIMIT ?`
    ).all(maxAgents).map(r => r.agent);
    if (topAgents.length > 0) {
      where += ' AND attribution NOT IN (' + topAgents.map(() => '?').join(',') + ')';
      params.push(...topAgents);
    }
  } else if (agent) { where += ' AND attribution = ?'; params.push(agent); }
  if (session === 'null') { where += ' AND session_id IS NULL'; }
  else if (session) { where += ' AND session_id = ?'; params.push(session); }
  if (file) { where += ' AND path LIKE ?'; params.push(`%${file}%`); }
  if (since) {
    const hours = parseInt(since);
    if (hours > 0) {
      const cutoff = Date.now() * 1e6 - hours * 3600e9;
      where += ' AND ts_ns >= ?';
      params.push(cutoff);
    }
  }
  if (action) {
    if (action === 'create') where += ' AND before_hash IS NULL AND after_hash IS NOT NULL';
    else if (action === 'modify') where += ' AND before_hash IS NOT NULL AND after_hash IS NOT NULL';
    else if (action === 'delete') where += ' AND before_hash IS NOT NULL AND after_hash IS NULL';
  }

  const count = opened.db.prepare(`SELECT COUNT(*) as total FROM events WHERE ${where}`).get(...params).total;
  const rows = opened.db.prepare(
    `SELECT id, ts_ns, path, before_hash, after_hash, size_before, size_after, attribution, session_id, tool_name
     FROM events WHERE ${where}
     ORDER BY ts_ns DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  res.json({ total: count, rows });
});

// agent 列表
app.get('/api/agents', (req, res) => {
  const projectId = parseInt(req.query.projectId);
  const proj = findProject(projectId);
  if (!proj) return res.json([]);
  const opened = openProject(proj.path);
  if (!opened) return res.json([]);
  const maxAgents = config.agent_display_limit || 3;
  // 按 agent 最近使用时间排序，去重取前 N 个
  const rows = opened.db.prepare(
    `SELECT s.agent, MAX(s.started_at_ns) as last_used FROM sessions s
     WHERE s.agent IS NOT NULL AND s.agent != ''
     GROUP BY s.agent ORDER BY last_used DESC LIMIT ?`
  ).all(maxAgents + 1); // 多取1条判断是否还有更多
  const agents = rows.slice(0, maxAgents).map(r => r.agent);
  if (rows.length > maxAgents) agents.push('other');
  res.json(agents);
});

// session 列表（带 event_count + events 详情）
app.get('/api/sessions', (req, res) => {
  const projectId = parseInt(req.query.projectId);
  const proj = findProject(projectId);
  if (!proj) return res.json({ total: 0, rows: [] });
  const opened = openProject(proj.path);
  if (!opened) return res.json({ total: 0, rows: [] });
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const since = req.query.since || '';
  const file = req.query.file || '';
  const action = req.query.action || '';
  const agent = req.query.agent || '';

  // 构建 WHERE 条件
  let where = '1=1';
  const params = [];
  if (since) {
    const hours = parseInt(since);
    if (hours > 0) {
      const cutoff = Date.now() * 1e6 - hours * 3600e9;
      where += ' AND s.started_at_ns >= ?';
      params.push(cutoff);
    }
  }
  if (agent === 'other') {
    const maxAgents = config.agent_display_limit || 3;
    const topAgents = opened.db.prepare(
      `SELECT s.agent FROM sessions s WHERE s.agent IS NOT NULL AND s.agent != '' GROUP BY s.agent ORDER BY MAX(s.started_at_ns) DESC LIMIT ?`
    ).all(maxAgents).map(r => r.agent);
    if (topAgents.length > 0) {
      where += ' AND s.agent NOT IN (' + topAgents.map(() => '?').join(',') + ')';
      params.push(...topAgents);
    }
  } else if (agent) { where += ' AND s.agent = ?'; params.push(agent); }
  // file/action 筛选：只返回包含匹配事件的 session
  if (file || action) {
    let subWhere = '1=1';
    const subParams = [];
    if (file) { subWhere += ' AND e.path LIKE ?'; subParams.push(`%${file}%`); }
    if (action) {
      if (action === 'create') subWhere += ' AND e.before_hash IS NULL AND e.after_hash IS NOT NULL';
      else if (action === 'modify') subWhere += ' AND e.before_hash IS NOT NULL AND e.after_hash IS NOT NULL';
      else if (action === 'delete') subWhere += ' AND e.before_hash IS NOT NULL AND e.after_hash IS NULL';
    }
    where += ` AND s.id IN (SELECT DISTINCT e.session_id FROM events e WHERE ${subWhere})`;
    params.push(...subParams);
  }
  const hasDetail = req.query.has_detail || '';
  if (hasDetail === 'true') {
    where += ' AND s.id IN (SELECT DISTINCT session_id FROM events)';
  }

  // 总数
  const total = opened.db.prepare(
    `SELECT COUNT(*) as c FROM sessions s WHERE ${where}`
  ).get(...params).c;

  // sessions + event_count（LEFT JOIN 聚合）
  const rows = opened.db.prepare(
    `SELECT 
      s.id, s.agent, s.started_at_ns, s.ended_at_ns,
      s.prompt, s.model, s.prompt_output,
      COALESCE(ec.cnt, 0) as event_count
    FROM sessions s
    LEFT JOIN (
      SELECT session_id, COUNT(*) as cnt FROM events GROUP BY session_id
    ) ec ON s.id = ec.session_id
    WHERE ${where}
    ORDER BY s.started_at_ns DESC
    LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  // 批量查 events（按这些 session_id）
  const sessionIds = rows.map(r => r.id);
  let eventsMap = {};
  if (sessionIds.length > 0) {
    const placeholders = sessionIds.map(() => '?').join(',');
    const evRows = opened.db.prepare(
      `SELECT id, session_id, ts_ns, path, before_hash, after_hash, size_before, size_after, attribution, tool_name
       FROM events
       WHERE session_id IN (${placeholders})
       ORDER BY ts_ns DESC`
    ).all(...sessionIds);
    for (const ev of evRows) {
      if (!eventsMap[ev.session_id]) eventsMap[ev.session_id] = [];
      eventsMap[ev.session_id].push(ev);
    }
  }

  // 组装
  const result = rows.map(r => ({
    ...r,
    events: eventsMap[r.id] || [],
  }));

  res.json({ total, rows: result });
});

// 文件列表
app.get('/api/files', (req, res) => {
  const projectId = parseInt(req.query.projectId);
  const proj = findProject(projectId);
  if (!proj) return res.json([]);
  const opened = openProject(proj.path);
  if (!opened) return res.json([]);
  const limit = parseInt(req.query.limit) || 10;
  const q = req.query.q || '';
  const rows = opened.db.prepare(
    `SELECT DISTINCT path FROM events
     WHERE path LIKE ?
     ORDER BY path LIMIT ?`
  ).all(`%${q}%`, limit);
  res.json(rows.map(r => r.path));
});

// diff
function fmtTimeSec(tsNs) {
  const d = new Date(tsNs / 1e6);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

app.get('/api/diff', (req, res) => {
  const projectId = parseInt(req.query.projectId);
  const proj = findProject(projectId);
  if (!proj) return res.json({ ok: false, error: '未选择项目' });
  const eventId = req.query.event;
  const session = req.query.session;
  const contextLines = parseInt(req.query.context) || 3;

  if (!eventId && !session) return res.json({ ok: false, error: '需要 event/session 参数' });

  const opened = openProject(proj.path);
  if (!opened) return res.json({ ok: false, error: '无法打开项目' });

  try {
    // 获取事件信息
    let evRow = null;
    if (eventId) {
      evRow = opened.db.prepare(
        `SELECT id, ts_ns, path, attribution FROM events WHERE id = ?`
      ).get(parseInt(eventId));
    }
    if (!evRow) return res.json({ ok: false, error: '事件不存在' });

    // 执行 au diff
    const diffOut = execSync(`au diff ${evRow.id}`, { cwd: proj.path, timeout: 10000, encoding: 'utf8' });

    // 执行 au blame 获取行归属
    let blameMap = {}; // lineNum -> {agent, time}
    try {
      const blameResp = execSync(`au blame "${evRow.path}"`, { cwd: proj.path, timeout: 10000, encoding: 'utf8' });
      for (const line of blameResp.split('\n').filter(Boolean)) {
        const m = line.match(/^(\S+)\s+(\S+)\s+(\S+\s+\S+)\s+(\d+):/);
        if (m) {
          blameMap[parseInt(m[4])] = { agent: m[1], time: m[3] };
        }
      }
    } catch {} // blame 失败不影响 diff

    const evAgent = evRow.attribution || 'unknown';
    const evTime = fmtTimeSec(evRow.ts_ns);

    // 解析 diff，构建结构化行
    const diffLines = diffOut.split('\n');
    let afterLineNum = 0; // after 版本的行号
    const structuredLines = [];

    for (const line of diffLines) {
      if (line.startsWith('+++') || line.startsWith('---')) continue; // 跳过 meta

      if (line.startsWith('+')) {
        // add 行：用当前事件归属，after 行号递增
        afterLineNum++;
        structuredLines.push({
          type: 'add',
          lineNum: afterLineNum,
          agent: evAgent,
          time: evTime,
          code: line.substring(1)
        });
      } else if (line.startsWith('-')) {
        // del 行：用当前事件归属，after 行号不递增
        structuredLines.push({
          type: 'del',
          lineNum: null,
          agent: evAgent,
          time: evTime,
          code: line.substring(1)
        });
      } else {
        // context 行：去掉 unified diff 的前缀空格（与 +/- 等宽）
        afterLineNum++;
        const blame = blameMap[afterLineNum] || { agent: evAgent, time: evTime };
        structuredLines.push({
          type: 'ctx',
          lineNum: afterLineNum,
          agent: blame.agent,
          time: blame.time,
          code: line.substring(1)
        });
      }
    }

    // 裁剪 context：只保留差异行前后各 contextLines 行
    const diffIndices = [];
    for (let i = 0; i < structuredLines.length; i++) {
      if (structuredLines[i].type === 'add' || structuredLines[i].type === 'del') diffIndices.push(i);
    }

    const keep = new Set();
    for (const idx of diffIndices) {
      for (let j = Math.max(0, idx - contextLines); j <= Math.min(structuredLines.length - 1, idx + contextLines); j++) {
        keep.add(j);
      }
    }

    const result = [];
    let lastKept = -1;
    for (let i = 0; i < structuredLines.length; i++) {
      if (keep.has(i)) {
        if (lastKept < i - 1) {
          result.push({ type: 'skip', count: i - lastKept - 1 });
        }
        result.push(structuredLines[i]);
        lastKept = i;
      }
    }
    if (lastKept < structuredLines.length - 1) {
      result.push({ type: 'skip', count: structuredLines.length - lastKept - 1 });
    }

    res.json({
      ok: true,
      eventId: evRow.id,
      path: evRow.path,
      agent: evAgent,
      time: evTime,
      lines: result
    });
  } catch (e) {
    res.json({ ok: false, error: e.stderr?.toString() || e.message });
  }
});

// ─── 文件类型分类 ─────────────────────────────────────────────
const IMG_EXT = new Set(['png','jpg','jpeg','gif','webp','svg','ico','bmp','tiff','avif']);
const BIN_EXT = new Set(['xlsx','xls','doc','docx','ppt','pptx','pdf','zip','tar','gz','bz2','7z','rar',
  'dmg','pkg','exe','dll','so','dylib','woff','woff2','ttf','eot','otf',
  'mp3','mp4','wav','avi','mov','mkv','flac','ogg','webm',
  'sqlite','db','parquet','npy','npz','pkl','pt','onnx','h5','safetensors','class','jar','war']);

function classifyFile(p) {
  const ext = p.split('.').pop().toLowerCase();
  if (IMG_EXT.has(ext)) return 'image';
  if (BIN_EXT.has(ext)) return 'binary';
  return 'code';
}

// 文件历史 events
app.get('/api/file-events', (req, res) => {
  const projectId = parseInt(req.query.projectId);
  const proj = findProject(projectId);
  if (!proj) return res.json({ ok: false, error: '未选择项目' });
  const opened = openProject(proj.path);
  if (!opened) return res.json({ ok: false, error: '无法打开项目' });
  const filePath = req.query.path || '';
  if (!filePath) return res.json({ ok: false, error: '需要 path 参数' });

  const fileType = classifyFile(filePath);
  const limit = parseInt(req.query.limit) || 5;
  const eventId = req.query.eventId ? parseInt(req.query.eventId) : null;
  const afterEventId = req.query.afterEventId ? parseInt(req.query.afterEventId) : null;
  const beforeEventId = req.query.beforeEventId ? parseInt(req.query.beforeEventId) : null;
  const agent = req.query.agent || null;

  // 构建 WHERE 条件
  const baseWhere = agent ? 'path = ? AND attribution = ?' : 'path = ?';
  const baseParams = agent ? [filePath, agent] : [filePath];

  const total = opened.db.prepare(
    `SELECT COUNT(*) as c FROM events WHERE ${baseWhere}`
  ).get(...baseParams).c;

  let rows;
  let beforeCount = 0;
  let afterCount = 0;

  if (afterEventId) {
    // 向上加载：比 afterEventId 更新的事件
    rows = opened.db.prepare(
      `SELECT id, ts_ns, path, before_hash, after_hash, size_before, size_after, attribution, session_id, tool_name
       FROM events WHERE ${baseWhere} AND ts_ns > (SELECT ts_ns FROM events WHERE id = ?) ORDER BY ts_ns DESC LIMIT ?`
    ).all(...baseParams, afterEventId, limit);
    if (rows.length > 0) {
      beforeCount = opened.db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE ${baseWhere} AND ts_ns > ?`
      ).get(...baseParams, rows[0].ts_ns).c;
    }
    afterCount = opened.db.prepare(
      `SELECT COUNT(*) as c FROM events WHERE ${baseWhere} AND ts_ns < (SELECT ts_ns FROM events WHERE id = ?)`
    ).get(...baseParams, afterEventId).c;
  } else if (beforeEventId) {
    // 向下加载：比 beforeEventId 更旧的事件
    rows = opened.db.prepare(
      `SELECT id, ts_ns, path, before_hash, after_hash, size_before, size_after, attribution, session_id, tool_name
       FROM events WHERE ${baseWhere} AND ts_ns < (SELECT ts_ns FROM events WHERE id = ?) ORDER BY ts_ns DESC LIMIT ?`
    ).all(...baseParams, beforeEventId, limit);
    beforeCount = opened.db.prepare(
      `SELECT COUNT(*) as c FROM events WHERE ${baseWhere} AND ts_ns > (SELECT ts_ns FROM events WHERE id = ?)`
    ).get(...baseParams, beforeEventId).c;
    if (rows.length > 0) {
      afterCount = opened.db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE ${baseWhere} AND ts_ns < ?`
      ).get(...baseParams, rows[rows.length - 1].ts_ns).c;
    }
  } else if (eventId) {
    // 以 eventId 为中心定位
    const evRow = opened.db.prepare(`SELECT ts_ns FROM events WHERE id = ?`).get(eventId);
    if (evRow) {
      const pos = opened.db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE ${baseWhere} AND ts_ns > ?`
      ).get(...baseParams, evRow.ts_ns).c;
      const half = Math.floor((limit - 1) / 2);
      const offset = Math.max(0, pos - half);
      rows = opened.db.prepare(
        `SELECT id, ts_ns, path, before_hash, after_hash, size_before, size_after, attribution, session_id, tool_name
         FROM events WHERE ${baseWhere} ORDER BY ts_ns DESC LIMIT ? OFFSET ?`
      ).all(...baseParams, limit, offset);
      beforeCount = offset;
      afterCount = Math.max(0, total - offset - rows.length);
    } else {
      rows = opened.db.prepare(
        `SELECT id, ts_ns, path, before_hash, after_hash, size_before, size_after, attribution, session_id, tool_name
         FROM events WHERE ${baseWhere} ORDER BY ts_ns DESC LIMIT ?`
      ).all(...baseParams, limit);
      beforeCount = 0;
      afterCount = Math.max(0, total - rows.length);
    }
  } else {
    // fallback: 最新 limit 条
    rows = opened.db.prepare(
      `SELECT id, ts_ns, path, before_hash, after_hash, size_before, size_after, attribution, session_id, tool_name
       FROM events WHERE ${baseWhere} ORDER BY ts_ns DESC LIMIT ?`
    ).all(...baseParams, limit);
    beforeCount = 0;
    afterCount = Math.max(0, total - rows.length);
  }

  // agents 列表：按最新事件时间降序（不受 agent 过滤影响，始终返回全量）
  const agents = opened.db.prepare(
    `SELECT attribution FROM events WHERE path = ? AND attribution IS NOT NULL GROUP BY attribution ORDER BY MAX(ts_ns) DESC`
  ).all(filePath).map(r => r.attribution);

  // lineCount：最新版本行数
  let lineCount = null;
  if (fileType === 'code') {
    try {
      const latest = opened.db.prepare(
        `SELECT id, after_hash FROM events WHERE path = ? AND after_hash IS NOT NULL ORDER BY ts_ns DESC LIMIT 1`
      ).get(filePath);
      if (latest) {
        const out = execSync(`au show ${latest.id} --after`, { cwd: proj.path, timeout: 5000, encoding: 'utf8' });
        lineCount = out.split('\n').length;
      }
    } catch {}
  }

  res.json({
    ok: true,
    fileType,
    path: filePath,
    total,
    agents,
    lineCount,
    beforeCount,
    afterCount,
    events: rows
  });
});

// 文件快照（base64）
app.get('/api/snapshot', (req, res) => {
  const projectId = parseInt(req.query.projectId);
  const proj = findProject(projectId);
  if (!proj) return res.json({ ok: false, error: '未选择项目' });
  const event = req.query.event;
  const when = req.query.when || 'after'; // before | after
  if (!event) return res.json({ ok: false, error: '需要 event 参数' });
  try {
    const flag = when === 'before' ? '--before' : '--after';
    const buf = execSync(`au show ${event} ${flag}`, { cwd: proj.path, timeout: 10000 });
    const b64 = Buffer.from(buf).toString('base64');
    // 猜测 mime
    const ext = (req.query.ext || 'png').toLowerCase();
    const mimeMap = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', svg:'image/svg+xml' };
    const mime = mimeMap[ext] || 'application/octet-stream';
    res.json({ ok: true, base64: b64, mime });
  } catch (e) {
    res.json({ ok: false, error: e.stderr?.toString() || e.message });
  }
});

// blame
app.get('/api/blame', (req, res) => {
  const projectId = parseInt(req.query.projectId);
  const proj = findProject(projectId);
  if (!proj) return res.json({ ok: false, error: '未选择项目' });
  const file = req.query.file;
  if (!file) return res.json({ ok: false, error: '需要 file 参数' });
  try {
    const out = execSync(`au blame "${file}"`, { cwd: proj.path, timeout: 10000, encoding: 'utf8' });
    const lines = [];
    for (const line of out.split('\n').filter(Boolean)) {
      const m = line.match(/^(\S+)\s+(\S+)\s+(\S+\s+\S+)\s+(\d+):\s?(.*)$/);
      if (m) {
        lines.push({ lineNum: parseInt(m[4]), agent: m[1], time: m[3], code: m[5] });
      } else {
        lines.push({ lineNum: 0, agent: '', time: '', code: line });
      }
    }
    res.json({ ok: true, lines });
  } catch (e) {
    res.json({ ok: false, error: e.stderr?.toString() || e.message });
  }
});

// revert (preview)
app.get('/api/revert', (req, res) => {
  const projectId = parseInt(req.query.projectId);
  const proj = findProject(projectId);
  if (!proj) return res.json({ ok: false, error: '未选择项目' });
  const event = req.query.event;
  const session = req.query.session;
  let cmd = 'au revert --no-confirm';
  if (event) cmd += ` --event ${event === 'latest' ? '' : event}`;
  else if (session) cmd += ` --session ${session === 'latest' ? '' : session}`;
  else return res.json({ ok: false, error: '需要 event/session/pin 参数' });
  try {
    const out = execSync(cmd, { cwd: proj.path, timeout: 10000, encoding: 'utf8' });
    res.type('text').send(out);
  } catch (e) {
    res.type('text').send(e.stderr?.toString() || e.message);
  }
});

// 恢复预览（au revert --json，不实际执行，不返回 patch）
app.get('/api/revert/preview', (req, res) => {
  const projectId = parseInt(req.query.projectId);
  const proj = findProject(projectId);
  if (!proj) return res.json({ ok: false, error: '未选择项目' });
  const event = req.query.event;
  const session = req.query.session;
  const pin = req.query.pin;
  let cmd = 'au revert --json';
  if (event) cmd += ` --event ${event === 'latest' ? '' : event}`;
  else if (session) cmd += ` --session ${session === 'latest' ? '' : session}`;
  else if (pin) cmd += ` --pin ${pin}`;
  else return res.json({ ok: false, error: '需要 event/session/pin 参数' });
  try {
    let out = execSync(cmd, { cwd: proj.path, timeout: 15000, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const lastBrace = out.lastIndexOf('}');
    if (lastBrace > 0) out = out.substring(0, lastBrace + 1);
    const result = JSON.parse(out);
    result.after_time = Date.now() * 1e6;
    // 移除 patch 字段，按需加载
    if (result.files) result.files.forEach(f => { delete f.patch; });
    res.json(result);
  } catch (e) {
    res.json({ ok: false, error: e.stderr?.toString() || e.message });
  }
});

// 按需加载单个文件的 patch
app.get('/api/revert/patch', (req, res) => {
  const projectId = parseInt(req.query.projectId);
  const proj = findProject(projectId);
  if (!proj) return res.json({ ok: false, error: '未选择项目' });
  const fileIdx = parseInt(req.query.fileIdx);
  const event = req.query.event;
  const session = req.query.session;
  const pin = req.query.pin;
  let cmd = 'au revert --json';
  if (event) cmd += ` --event ${event === 'latest' ? '' : event}`;
  else if (session) cmd += ` --session ${session === 'latest' ? '' : session}`;
  else if (pin) cmd += ` --pin ${pin}`;
  else return res.json({ ok: false, error: '需要 event/session/pin 参数' });
  try {
    let out = execSync(cmd, { cwd: proj.path, timeout: 15000, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const lastBrace = out.lastIndexOf('}');
    if (lastBrace > 0) out = out.substring(0, lastBrace + 1);
    const result = JSON.parse(out);
    const file = (result.files || [])[fileIdx];
    if (!file) return res.json({ ok: false, error: '文件不存在' });
    res.json({ ok: true, filename: file.filename, patch: file.patch || null });
  } catch (e) {
    res.json({ ok: false, error: e.stderr?.toString() || e.message });
  }
});

// 确认恢复
app.post('/api/revert/confirm', (req, res) => {
  const projectId = parseInt(req.query.projectId);
  const proj = findProject(projectId);
  if (!proj) return res.json({ ok: false, error: '未选择项目' });
  const event = req.query.event;
  const session = req.query.session;
  const pin = req.query.pin;
  let cmd = 'au revert --confirm';
  if (event) cmd += ` --event ${event === 'latest' ? '' : event}`;
  else if (session) cmd += ` --session ${session === 'latest' ? '' : session}`;
  else if (pin) cmd += ` --pin ${pin}`;
  else return res.json({ ok: false, error: '需要 event/session/pin 参数' });
  try {
    const out = execSync(cmd, { cwd: proj.path, timeout: 15000, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    res.json({ ok: true, output: out });
  } catch (e) {
    res.json({ ok: false, error: e.stderr?.toString() || e.message });
  }
});

// pin 列表
app.get('/api/pins', (req, res) => {
  const projectId = parseInt(req.query.projectId);
  const proj = findProject(projectId);
  if (!proj) return res.json({ ok: false, error: '未选择项目' });
  try {
    const opened = openProject(proj.path);
    if (!opened) return res.json({ ok: false, error: '项目未初始化' });
    const pins = opened.db.prepare('SELECT id, event_id, label, created_at_ns FROM pins ORDER BY id DESC').all();
    opened.db.close();
    res.json({ ok: true, pins });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// 新增快照
app.post('/api/pins', (req, res) => {
  const projectId = parseInt(req.query.projectId);
  const proj = findProject(projectId);
  if (!proj) return res.json({ ok: false, error: '未选择项目' });
  const label = (req.query.label || '').trim();
  if (!label) return res.json({ ok: false, error: '需要 label 参数' });
  try {
    execSync(`au pin "${label.replace(/"/g, '\\"')}"`, { cwd: proj.path, timeout: 10000, encoding: 'utf8' });
    const opened = openProject(proj.path);
    if (!opened) return res.json({ ok: false, error: '项目未初始化' });
    const pins = opened.db.prepare('SELECT id, event_id, label, created_at_ns FROM pins ORDER BY id DESC').all();
    opened.db.close();
    res.json({ ok: true, pins });
  } catch (e) {
    res.json({ ok: false, error: e.stderr?.toString() || e.message });
  }
});

// 删除快照
app.delete('/api/pins/:id', (req, res) => {
  const projectId = parseInt(req.query.projectId);
  const proj = findProject(projectId);
  if (!proj) return res.json({ ok: false, error: '未选择项目' });
  const pinId = parseInt(req.params.id);
  if (!pinId) return res.json({ ok: false, error: '需要 pin id' });
  try {
    const dbPath = path.join(proj.path, '.agent-undo', 'timeline.db');
    if (!fs.existsSync(dbPath)) return res.json({ ok: false, error: '项目未初始化' });
    const db = new Database(dbPath);
    const info = db.prepare('DELETE FROM pins WHERE id = ?').run(pinId);
    db.close();
    res.json({ ok: true, deleted: info.changes });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// 删除项目
app.get('/api/remove/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = (config.projects || []).findIndex(p => p.id === id);
  if (idx === -1) return res.json({ ok: false, error: '项目不存在' });
  config.projects.splice(idx, 1);
  saveConfig();
  res.json({ ok: true });
});
app.get('/api/register', (req, res) => {
  const projectPath = decodeURIComponent(req.query.path || '');
  if (!projectPath || !fs.existsSync(path.join(projectPath, '.agent-undo'))) {
    return res.json({ ok: false, error: '项目未初始化 au' });
  }
  // 检查是否已注册
  const existing = (config.projects || []).find(p => p.path === projectPath);
  if (existing) {
    return res.json({ ok: true, project: { id: existing.id, name: existing.name, path: existing.path } });
  }
  // id = max existing + 1（无需 next_id）
  const maxId = (config.projects || []).reduce((max, p) => Math.max(max, p.id || 0), 0);
  const id = maxId + 1;
  const proj = { id, name: path.basename(projectPath), path: projectPath, created_at: new Date().toISOString() };
  config.projects.push(proj);
  saveConfig();
  res.json({ ok: true, project: { id: proj.id, name: proj.name, path: proj.path } });
});

// 初始化项目
app.post('/api/init', (req, res) => {
  const projectPath = decodeURIComponent(req.query.path || '');
  if (!projectPath || !fs.existsSync(projectPath)) {
    return res.json({ ok: false, error: '路径不存在' });
  }
  try {
    execSync('au init', { cwd: projectPath, timeout: 10000, encoding: 'utf8' });
    execSync('au serve --daemon', { cwd: projectPath, timeout: 10000, encoding: 'utf8' });
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// 目录浏览器
app.get('/api/browse', (req, res) => {
  const os = require('os');
  let dir = req.query.dir || os.homedir();
  if (dir === '~') dir = os.homedir();
  dir = path.resolve(dir);
  if (!fs.existsSync(dir)) return res.json({ dir, parent: null, items: [] });
  const parent = path.dirname(dir) !== dir ? path.dirname(dir) : null;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const items = entries
      .filter(d => d.isDirectory() || d.name.endsWith('.agent-undo'))
      .map(d => ({
        name: d.name,
        path: path.join(dir, d.name),
        isDir: d.isDirectory(),
        hasAu: d.isDirectory() && fs.existsSync(path.join(dir, d.name, '.agent-undo')),
      }))
      .sort((a, b) => {
        if (a.hasAu !== b.hasAu) return a.hasAu ? -1 : 1;
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    res.json({ dir, parent, items });
  } catch (e) {
    res.json({ dir, parent, items: [] });
  }
});

// ─── 启动 ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`au-viewer running at http://localhost:${PORT}`);
});

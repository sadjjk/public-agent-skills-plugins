const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const app = express();

// Config — read from manifest, defaults if missing
const MANIFEST_PATH = path.join(__dirname, "..", "config.json");

// Auto-create config.json if missing
if (!fs.existsSync(MANIFEST_PATH)) {
  const defaults = {
    port: 3456,
    refresh_interval: 3000,
    browse_history_limit: 5,
    last_updated: "",
    files: [],
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(defaults, null, 4));
}

function readConfig() {
  try {
    const data = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    return {
      port: data.port || 3456,
      refresh_interval: data.refresh_interval || 3000,
      browse_history_limit: data.browse_history_limit || 5,
    };
  } catch {
    return { port: 3456, refresh_interval: 3000, browse_history_limit: 5 };
  }
}

const PORT = readConfig().port;

function getRefreshInterval() {
  return readConfig().refresh_interval;
}
function getBrowseHistoryLimit() {
  return readConfig().browse_history_limit;
}

function toBeijingISO() {
  return new Date(Date.now() + 8 * 3600000)
    .toISOString()
    .replace("Z", "+08:00");
}

// ===== Manifest helpers =====

function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return {
      files: [],
      auto_refresh: true,
      refresh_interval: getRefreshInterval(),
      last_updated: "",
    };
  }
}

function saveManifest(manifest) {
  manifest.last_updated = toBeijingISO();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function generateHash(absPath) {
  // 6-char hash from absolute path — stable for same file
  return crypto.createHash("sha256").update(absPath).digest("hex").slice(0, 6);
}

function registerFile(absPath) {
  const manifest = loadManifest();
  const hash = generateHash(absPath);

  // Already registered? Return existing entry
  const existing = manifest.files.find((f) => f.hash === hash);
  if (existing) {
    existing.viewed_at = toBeijingISO();
    saveManifest(manifest);
    return existing;
  }

  // New entry — id = max existing id + 1
  const maxId = manifest.files.reduce((max, f) => Math.max(max, f.id || 0), 0);
  const entry = {
    id: maxId + 1,
    hash: hash,
    path: absPath,
    name: path.basename(absPath),
    viewed_at: toBeijingISO(),
  };
  manifest.files.push(entry);
  saveManifest(manifest);
  return entry;
}

function findByHash(hash) {
  const manifest = loadManifest();
  return manifest.files.find((f) => f.hash === hash) || null;
}

// ===== Middleware =====

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

// Static serve md-to-web.js and css.js for browser-side rendering (before express.static to avoid 404)
const MD_TO_WEB_DIR = path.join(__dirname, 'vendor');
app.get('/md-to-web/md-to-web.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  let content = fs.readFileSync(path.join(MD_TO_WEB_DIR, 'md-to-web.js'), 'utf8');
  // 去掉 shebang 行（浏览器不认识 #!）
  if (content.startsWith('#!')) content = content.split('\n').slice(1).join('\n');
  res.send(content);
});
app.get('/md-to-web/css.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(fs.readFileSync(path.join(MD_TO_WEB_DIR, 'css.js'), 'utf8'));
});

app.use(express.static(__dirname));

// ===== API routes =====

// Get manifest (all registered files)
app.get("/api/manifest", (req, res) => {
  res.json(loadManifest());
});

// Get file content
app.get("/api/file", (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: "File path required" });
    if (!fs.existsSync(filePath))
      return res.status(404).json({ error: "File not found" });
    const content = fs.readFileSync(filePath, "utf8");
    res.json({
      path: filePath,
      name: path.basename(filePath),
      content: content,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to read file: " + error.message });
  }
});

// Register a file and return its entry (id + hash)
app.get("/api/register", (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: "File path required" });
    if (!filePath.endsWith(".md"))
      return res.status(403).json({ error: "Only .md files" });
    if (filePath.includes(".."))
      return res.status(403).json({ error: "Invalid path" });
    if (!fs.existsSync(filePath))
      return res.status(404).json({ error: "File not found" });

    const entry = registerFile(filePath);
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: "Failed to register: " + error.message });
  }
});

// Directory browser
app.get("/api/browse", (req, res) => {
  try {
    const os = require("os");
    let dir = req.query.dir || os.homedir();
    if (dir === "~") dir = os.homedir();
    dir = path.resolve(dir);
    if (!fs.existsSync(dir)) return res.json({ dir, items: [] });
    const items = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() || d.name.endsWith(".md"))
      .map((d) => ({
        name: d.name,
        path: path.join(dir, d.name),
        isDir: d.isDirectory(),
        isMd: d.name.endsWith(".md"),
      }))
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    res.json({ dir, parent: path.dirname(dir), items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/upload", (req, res) => {
  try {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString();
      let name = req.headers["x-filename"] || "uploaded.md";
      if (!name.endsWith(".md")) name += ".md";
      const tmpDir = path.join(__dirname, "uploads");
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const tmpPath = path.join(tmpDir, name);
      fs.writeFileSync(tmpPath, body);
      const entry = registerFile(tmpPath);
      res.json(entry);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Image proxy
app.get("/api/image", (req, res) => {
  try {
    const imgPath = req.query.path;
    if (!imgPath) return res.status(400).send("Image path required");
    if (!/\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/i.test(imgPath))
      return res.status(403).send("Only image files");
    if (imgPath.includes("..")) return res.status(403).send("Invalid path");
    const resolved = path.resolve(imgPath);
    if (!fs.existsSync(resolved))
      return res.status(404).send("Image not found");
    const data = fs.readFileSync(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const mimeMap = {'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.bmp':'image/bmp','.ico':'image/x-icon'};
    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.send(data);
  } catch (error) {
    res.status(500).send("Failed to load image: " + error.message);
  }
});

// File mtime check
app.get("/api/mtime", (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath || !filePath.endsWith(".md") || filePath.includes(".."))
      return res.status(403).json({ error: "Invalid" });
    if (!fs.existsSync(filePath))
      return res.status(404).json({ error: "File not found" });
    const stat = fs.statSync(filePath);
    res.json({ mtime: stat.mtimeMs });
  } catch (error) {
    res.status(500).json({ error: "Failed to stat file" });
  }
});

// Remove a file from manifest
app.get("/api/remove", (req, res) => {
  try {
    const id = parseInt(req.query.id);
    if (!id) return res.status(400).json({ error: "ID required" });
    const manifest = loadManifest();
    const idx = manifest.files.findIndex((f) => f.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    const removed = manifest.files[idx];
    // Delete uploaded copy if it's in server/uploads/
    if (removed.path && removed.path.includes("/server/uploads/")) {
      try {
        fs.unlinkSync(removed.path);
      } catch {}
    }
    manifest.files.splice(idx, 1);
    saveManifest(manifest);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove" });
  }
});

// Set file-specific theme
app.get("/api/set-theme", (req, res) => {
  try {
    const id = parseInt(req.query.id);
    const theme = req.query.theme;
    if (!id || !theme) return res.status(400).json({ error: "id and theme required" });
    const manifest = loadManifest();
    const entry = manifest.files.find((f) => f.id === id);
    if (!entry) return res.status(404).json({ error: "File not found" });
    entry.theme = theme;
    saveManifest(manifest);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to set theme" });
  }
});

// ===== Main route: /i/:id =====

app.get("/i/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const manifest = loadManifest();
  const entry = manifest.files.find((f) => f.id === id);

  if (!entry) {
    // Show welcome page using main template
    const manifest = loadManifest();
    const welcomeEntry = { id: 0, hash: "", path: "", name: "MD Viewer" };
    return res.send(
      getViewTemplate(
        welcomeEntry,
        __dirname,
        getRefreshInterval(),
        manifest.files,
        getBrowseHistoryLimit(),
      ),
    );
  }

  // Update viewed_at
  const f = manifest.files.find((x) => x.id === id);
  if (f) {
    f.viewed_at = toBeijingISO();
    saveManifest(manifest);
  }

  // Read md content
  let mdContent = "";
  try {
    mdContent = fs.readFileSync(entry.path, "utf8");
  } catch {
    mdContent = "⚠️ Failed to read file";
  }
  const fileDir = path.dirname(entry.path);

  res.send(
    getViewTemplate(
      entry,
      fileDir,
      getRefreshInterval(),
      manifest.files,
      getBrowseHistoryLimit(),
    ),
  );
});

// ===== View template =====

function getViewTemplate(
  entry,
  fileDir,
  refreshInterval,
  allFiles,
  browseHistoryLimit,
) {
  // Build sidebar items
  const sidebarItems = allFiles
    .map((f) => {
      const active = f.id === entry.id ? " active" : "";
      const copyTag = f.path.includes("/server/uploads/")
        ? ' <span style="font-size:10px;color:var(--text-secondary);background:var(--bg-tertiary);padding:1px 4px;border-radius:3px">副本</span>'
        : "";
      return `<li class="sidebar-item${active}" data-id="${f.id}" onclick="navigateTo(${f.id})">
            <div class="sidebar-file-info">
                <span class="sidebar-name">${f.name}${copyTag}</span>
                <span class="sidebar-path" title="${f.path}">${f.path}</span>
            </div>
            <button class="sidebar-remove" onclick="event.stopPropagation();removeFile(${f.id})" title="Remove">✕</button>
        </li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${entry.name} — MD Viewer</title>

    <link rel="stylesheet" href="/vendor/katex.min.css">
    <script src="/vendor/marked.min.js"></script>
    <script src="/vendor/mermaid.min.js"></script>
    <script src="/vendor/katex.min.js"></script>
    <script src="/vendor/auto-render.min.js"></script>
    <script defer src="https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
    <script defer src="https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js"></script>
    <script src="/md-to-web/css.js"></script>
    <script src="/md-to-web/md-to-web.js"></script>
    <style id="md-css">
        :root {
            --bg-primary: #0d1117;
            --bg-secondary: #161b22;
            --bg-tertiary: #30363d;
            --accent: #7fdbca;
            --accent-light: #a3e4c8;
            --accent-dark: #5fb8a4;
            --accent-5: rgba(127,219,202,0.05);
            --accent-10: rgba(127,219,202,0.10);
            --accent-12: rgba(127,219,202,0.12);
            --accent-20: rgba(127,219,202,0.20);
            --text-primary: #c9d1d9;
            --text-secondary: #8b949e;
            --border-color: #30363d;
            --code-bg: #1c2128;
            --code-inline-color: #c3e88d;
            --em-color: #c792ea;
            --sidebar-width: 240px;
            --sidebar-max-width: 480px;
        }
        /* Theme: Dark Sage (default) */
        [data-theme="dark-sage"] {
            --bg-primary: #0d1117;
            --bg-secondary: #161b22;
            --bg-tertiary: #30363d;
            --accent: #7fdbca;
            --accent-light: #a3e4c8;
            --accent-dark: #5fb8a4;
            --accent-5: rgba(127,219,202,0.05);
            --accent-10: rgba(127,219,202,0.10);
            --accent-12: rgba(127,219,202,0.12);
            --accent-20: rgba(127,219,202,0.20);
            --text-primary: #c9d1d9;
            --text-secondary: #8b949e;
            --border-color: #30363d;
            --code-bg: #1c2128;
            --code-inline-color: #c3e88d;
            --em-color: #c792ea;
        }
        /* Theme: Light Classic */
        [data-theme="light"] {
            --bg-primary: #ffffff;
            --bg-secondary: #f8f9fa;
            --bg-tertiary: #e9ecef;
            --accent: #2563eb;
            --accent-light: #3b82f6;
            --accent-dark: #1d4ed8;
            --accent-5: rgba(37,99,235,0.05);
            --accent-10: rgba(37,99,235,0.10);
            --accent-12: rgba(37,99,235,0.12);
            --accent-20: rgba(37,99,235,0.20);
            --text-primary: #1f2937;
            --text-secondary: #6b7280;
            --border-color: #d1d5db;
            --code-bg: #f3f4f6;
            --code-inline-color: #059669;
            --em-color: #7c3aed;
        }
        /* Theme: GitHub Dark */
        [data-theme="github-dark"] {
            --bg-primary: #0d1117;
            --bg-secondary: #161b22;
            --bg-tertiary: #21262d;
            --accent: #58a6ff;
            --accent-light: #79c0ff;
            --accent-dark: #388bfd;
            --accent-5: rgba(88,166,255,0.05);
            --accent-10: rgba(88,166,255,0.10);
            --accent-12: rgba(88,166,255,0.12);
            --accent-20: rgba(88,166,255,0.20);
            --text-primary: #e6edf3;
            --text-secondary: #8b949e;
            --border-color: #30363d;
            --code-bg: #161b22;
            --code-inline-color: #7ee787;
            --em-color: #d2a8ff;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: var(--bg-primary);
            color: var(--text-primary);
            font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Segoe UI', sans-serif;
            line-height: 1.7;
            display: flex;
            height: 100vh;
            overflow-x: hidden;
            overflow-y: visible;
        }

        /* Sidebar */
        .sidebar {
            width: var(--sidebar-width);
            min-width: var(--sidebar-width);
            max-width: var(--sidebar-max-width);
            background: var(--bg-secondary);
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: margin-left 0.2s;
            position: relative;
        }
        .sidebar-resize {
            position: absolute; top: 0; right: -3px; bottom: 0; width: 6px;
            cursor: col-resize; z-index: 10;
        }
        .sidebar-resize:hover { background: var(--accent); opacity: 0.3; }
        .sidebar.collapsed { margin-left: calc(-1 * var(--sidebar-width)); }
        .sidebar-header {
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .sidebar-header h2 {
            font-size: 13px;
            font-weight: 600;
            color: var(--accent);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .sidebar-toggle {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 16px;
            padding: 4px;
        }
        .sidebar-toggle:hover { color: var(--text-primary); }
        .sidebar-list {
            flex: 1;
            overflow-y: auto;
            list-style: none;
            padding: 8px;
        }
        .sidebar-item {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            margin-bottom: 2px;
            transition: background 0.15s;
        }
        .sidebar-item:hover { background: var(--bg-tertiary); }
        .sidebar-item.active { background: var(--accent-12); }
        .sidebar-item.active .sidebar-name { color: var(--accent); font-weight: 500; }
        .sidebar-name {
            font-size: 13px;
            color: var(--text-primary);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .sidebar-file-info {
            flex: 1;
            min-width: 0;
        }
        .sidebar-path {
            display: block;
            font-size: 10px;
            color: var(--text-secondary);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            margin-top: 1px;
            opacity: 0.7;
        }
        .sidebar-remove {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 12px;
            padding: 2px 4px;
            border-radius: 3px;
            opacity: 0;
            transition: opacity 0.15s;
        }
        .sidebar-item:hover .sidebar-remove { opacity: 1; }
        .sidebar-remove:hover { color: #f85149; background: rgba(248,81,73,0.1); }
        .sidebar-empty {
            padding: 16px;
            text-align: center;
            color: var(--text-secondary);
            font-size: 13px;
        }
        .sidebar-footer {
            padding: 8px 12px;
            border-top: 1px solid var(--border-color);
        }
        .sidebar-add-btn {
            width: 100%;
            padding: 8px;
            background: var(--accent-10);
            border: 1px dashed var(--accent-dark);
            color: var(--accent);
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            transition: background 0.15s;
        }
        .sidebar-add-btn:hover { background: var(--accent-20); }
        .drop-overlay {
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: var(--accent-10);
            border: 3px dashed var(--accent);
            z-index: 999;
            pointer-events: none;
        }
        .drop-overlay.active { display: flex; align-items: center; justify-content: center; }
        .drop-overlay span { color: var(--accent); font-size: 24px; font-weight: 600; }

        /* Main area */
        .main-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: visible;
        }

        /* Header */
        .app-header {
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            padding: 8px 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            min-height: 44px;
        }
        .sidebar-expand-btn {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 18px;
            padding: 4px 8px;
            display: none;
            flex-shrink: 0;
        }
        .sidebar.collapsed ~ .main-area .sidebar-expand-btn { display: block; }
        .app-header h1 {
            font-size: 14px;
            font-weight: 600;
            color: var(--accent);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex-shrink: 1;
            min-width: 0;
        }
        .status-dot {
            width: 7px; height: 7px; border-radius: 50%;
            display: inline-block;
            flex-shrink: 0;
        }
        .status-dot.live { background: var(--accent); }
        .status-dot.offline { background: #f85149; }
        .header-actions {
            margin-left: auto;
            display: flex;
            gap: 6px;
            align-items: center;
            flex-shrink: 0;
            flex-wrap: nowrap;
        }
        .header-path {
            font-size: 11px;
            color: var(--text-secondary);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 0 1 600px;
            min-width: 0;
            opacity: 0.6;
        }
        /* Unified button styles */
        .header-btn, .search-toggle {
            background: none;
            border: none;
            color: var(--text-secondary);
            padding: 5px 8px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 13px;
            opacity: 0.55;
            transition: opacity 0.15s, background 0.15s;
        }
        .header-btn:hover, .search-toggle:hover { opacity: 1; background: var(--accent-10); }
        .header-btn:active, .search-toggle:active { opacity: 1; background: var(--accent-20); }
        /* Theme select dropdowns */
        .theme-select {
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 4px 6px;
            border-radius: 5px;
            font-size: 12px;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.15s, border-color 0.15s;
        }
        .theme-select:hover { opacity: 1; border-color: var(--accent); }
        .theme-select:focus { outline: none; border-color: var(--accent); opacity: 1; }
        .theme-select optgroup {
            font-style: normal;
            font-weight: 600;
            font-size: 11px;
            color: var(--text-secondary);
        }
        .theme-select option { font-size: 12px; padding: 2px 0; }
        /* Search */
        .search-toggle.active { opacity: 1; background: var(--accent-20); color: var(--accent); }
        .search-container {
            display: none;
            align-items: center;
            gap: 4px;
        }
        .search-container.open { display: flex; }
        .search-input {
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            width: 140px;
        }
        .search-input:focus { outline: none; border-color: var(--accent); }
        #search-count { font-size: 11px; color: var(--text-secondary); white-space: nowrap; }

        /* TOC */
        .toc-btn {
            position: fixed; bottom: 24px; right: 24px;
            width: 40px; height: 40px;
            border-radius: 50%; border: 1px solid var(--border-color);
            background: var(--bg-secondary); color: var(--text-primary);
            font-size: 18px; cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            z-index: 1000;
            display: flex; align-items: center; justify-content: center;
            transition: background 0.2s, transform 0.2s;
        }
        .toc-btn:hover { background: var(--accent-dark); transform: scale(1.1); }
        .toc-panel {
            position: fixed; bottom: 72px; right: 24px;
            width: 280px; max-height: 60vh;
            overflow-y: auto;
            background: var(--bg-secondary); border: 1px solid var(--border-color);
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
            z-index: 999;
            display: none; padding: 12px 0;
        }
        .toc-panel.open { display: block; }
        .toc-panel-title {
            font-size: 12px; font-weight: 600; color: var(--text-secondary);
            padding: 0 16px 8px; border-bottom: 1px solid var(--border-color);
            margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .toc-item {
            display: block; padding: 4px 16px; font-size: 13px;
            color: var(--text-secondary); text-decoration: none;
            cursor: pointer; transition: color 0.15s, background 0.15s;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .toc-item:hover { color: var(--text-primary); background: var(--bg-tertiary); }
        .toc-item.active { color: var(--accent); font-weight: 600; }
        .toc-item[data-level="2"] { padding-left: 28px; }
        .toc-item[data-level="3"] { padding-left: 40px; }
        .toc-item[data-level="4"] { padding-left: 52px; }
        .toc-panel::-webkit-scrollbar { width: 4px; }
        .toc-panel::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 2px; }

        /* File Browser */
        .browser-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.5);
            z-index: 2000; display: none; align-items: center; justify-content: center;
        }
        .browser-overlay.open { display: flex; }
        .browser-modal {
            background: var(--bg-secondary); border: 1px solid var(--border-color);
            border-radius: 12px; width: 520px; max-height: 70vh;
            display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }
        .browser-header {
            padding: 12px 16px; border-bottom: 1px solid var(--border-color);
            display: flex; align-items: center; gap: 8px;
        }
        .browser-header h3 { font-size: 14px; margin: 0; flex: 1; }
        .browser-path {
            font-size: 11px; color: var(--text-secondary); background: var(--bg-tertiary);
            padding: 4px 8px; border-radius: 4px; max-width: 300px;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .browser-close {
            background: none; border: none; color: var(--text-secondary);
            cursor: pointer; font-size: 18px; padding: 0 4px;
        }
        .browser-close:hover { color: var(--text-primary); }
        .browser-quick {
            padding: 8px 12px; border-bottom: 1px solid var(--border-color);
            display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
        }
        .browser-quick-label { font-size: 11px; color: var(--text-secondary); margin-right: 2px; }
        .browser-chip {
            font-size: 11px; padding: 2px 8px; border-radius: 10px;
            background: var(--bg-tertiary); color: var(--text-primary);
            cursor: pointer; border: 1px solid var(--border-color);
            max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            transition: background 0.15s;
        }
        .browser-chip:hover { background: var(--accent-dark); color: #000; }
        .browser-chip.home { background: var(--accent); color: #000; font-weight: 600; }
        .browser-list {
            flex: 1; overflow-y: auto; padding: 4px 0;
        }
        .browser-item {
            padding: 8px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px;
            font-size: 13px; color: var(--text-primary); transition: background 0.1s;
        }
        .browser-item:hover { background: var(--bg-tertiary); }
        .browser-item.is-md { color: var(--accent); }
        .browser-item .icon { font-size: 14px; width: 20px; text-align: center; }
        .browser-item .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .browser-empty { padding: 24px; text-align: center; color: var(--text-secondary); font-size: 13px; }

        /* Content */
        .content-wrapper {
            flex: 1;
            overflow-y: auto;
            padding: 28px 32px;
        }
        .markdown-body { max-width: 1080px; margin: 0 auto; transition: opacity 0.15s; }
        .markdown-body h1 { color: var(--accent); font-size: 26px; margin: 24px 0 14px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; }
        .markdown-body h2 { color: var(--accent-light); font-size: 20px; margin: 20px 0 10px; }
        .markdown-body h3 { color: #c792ea; font-size: 17px; margin: 16px 0 8px; }
        .markdown-body h4 { color: #ffcb6b; font-size: 15px; margin: 12px 0 6px; }
        .markdown-body p { margin: 8px 0; }
        .markdown-body a { color: var(--accent); text-decoration: none; }
        .markdown-body a:hover { text-decoration: underline; }
        .markdown-body strong { color: var(--accent-light); font-weight: 600; }
        .markdown-body em { color: var(--em-color); }
        .markdown-body del { color: var(--text-secondary); }
        .markdown-body code { background: var(--code-bg); padding: 2px 6px; border-radius: 4px; font-size: 0.88em; color: var(--accent); font-family: 'SF Mono','Fira Code',monospace; }
        .markdown-body pre { background: var(--code-bg); padding: 14px; border-radius: 8px; overflow-x: auto; margin: 10px 0; border: 1px solid var(--border-color); }
        .markdown-body pre code { background: none; padding: 0; color: var(--code-inline-color); font-size: 0.88em; }
        .markdown-body blockquote { border-left: 3px solid var(--accent-dark); padding: 8px 14px; margin: 10px 0; background: var(--accent-5); color: var(--text-secondary); }
        .markdown-body ul, .markdown-body ol { margin: 6px 0 6px 22px; }
        .markdown-body li { margin: 3px 0; }
        .markdown-body hr { border: none; border-top: 1px solid var(--border-color); margin: 20px 0; }
        .markdown-body img { max-width: 100%; height: auto; border-radius: 4px; margin: 10px 0; cursor: zoom-in; }
        .img-lightbox {
            position: fixed; inset: 0; background: rgba(0,0,0,0.85);
            z-index: 3000; display: none; align-items: center; justify-content: center;
            cursor: zoom-out;
        }
        .img-lightbox.open { display: flex; }
        .img-lightbox img {
            max-width: 90vw; max-height: 90vh; border-radius: 4px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.6);
            transition: transform 0.15s;
            cursor: grab;
        }
        .img-lightbox img:active { cursor: grabbing; }
        .img-toolbar {
            position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
            display: flex; gap: 6px; padding: 6px 10px;
            background: rgba(0,0,0,0.6); border-radius: 20px;
        }
        .img-toolbar button {
            background: none; border: none; color: #fff; cursor: pointer;
            font-size: 16px; padding: 4px 8px; border-radius: 8px;
            transition: background 0.15s;
        }
        .img-toolbar button:hover { background: rgba(255,255,255,0.2); }
        .img-toolbar .zoom-level { font-size: 12px; color: rgba(255,255,255,0.7); padding: 4px 6px; align-self: center; }
        .markdown-body table { border-collapse: collapse; margin: 10px 0; width: 100%; }
        .markdown-body th { background: var(--bg-secondary); color: var(--accent); font-weight: 600; text-align: left; padding: 6px 10px; border: 1px solid var(--border-color); }
        .markdown-body td { padding: 6px 10px; border: 1px solid var(--border-color); }
        .markdown-body tr:nth-child(even) { background: var(--bg-secondary); }
        .mermaid { background: var(--bg-secondary); padding: 14px; border-radius: 8px; margin: 10px 0; }
        .search-highlight { background: rgba(255,203,107,0.3); border-radius: 2px; }
        .search-highlight-current { background: rgba(255,203,107,0.6); }

        .export-wrapper { position: relative; }
        .export-menu {
            display: none; position: absolute; right: 0; top: 100%;
            margin-top: 6px; background: var(--bg-secondary);
            border: 1px solid var(--border-color); border-radius: 8px;
            overflow: hidden; z-index: 100; min-width: 160px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        }
        .export-menu.open { display: block; }
        .export-option {
            display: block; width: 100%; padding: 10px 16px;
            background: none; border: none; color: var(--text-primary);
            font-size: 14px; text-align: left; cursor: pointer;
        }
        .export-option:hover { background: var(--bg-tertiary); }

        @media print {
            .sidebar, .app-header { display: none; }
            body { background: white; color: black; display: block; }
            .content-wrapper { padding: 0; }
            .markdown-body h1, .markdown-body h2 { color: #333; }
            .markdown-body pre { border: 1px solid #ddd; }
            .markdown-body code { color: #333; background: #f5f5f5; }
        }
    </style>
</head>
<body>
    <div class="drop-overlay" id="drop-overlay"><span>拖拽 .md 文件到此处（上传副本，不跟踪源文件更新）</span></div>
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-resize" id="sidebar-resize"></div>
        <div class="sidebar-header">
            <h2>Files</h2>
            <button class="sidebar-toggle" onclick="toggleSidebar()" title="Collapse">◀</button>
        </div>
        <ul class="sidebar-list" id="sidebar-list">
            ${sidebarItems || '<li class="sidebar-empty">No files</li>'}
        </ul>
        <div class="sidebar-footer">
            <button class="sidebar-add-btn" onclick="openBrowser()">+ Add file</button>
        </div>
    </aside>
    <div class="main-area">
        <header class="app-header">
            <button class="sidebar-expand-btn" id="expand-btn" onclick="toggleSidebar()">☰</button>
            <span class="status-dot live" id="status-dot"></span>
            <h1 id="file-title">${entry.name}</h1>
            <span class="header-path" id="header-path">${entry.path}</span>
            <div class="header-actions">
                <div class="search-container" id="search-container">
                    <input type="text" class="search-input" id="search-input" placeholder="搜索..." />
                    <span id="search-count"></span>
                </div>
                <button class="search-toggle" id="search-toggle" onclick="toggleSearch()" title="搜索">🔍</button>
                <select class="theme-select" id="theme-select" onchange="onThemeChange(this.value)">
                    <optgroup label="MD主题">
                        <option value="md:dark-sage">护眼</option>
                        <option value="md:light">亮色</option>
                        <option value="md:github-dark">暗色</option>
                    </optgroup>
                    <optgroup label="HTML主题">
                        <option value="html:aurora-glass">极光</option>
                        <option value="html:magazine">杂志</option>
                        <option value="html:neo-brutalism">卡通</option>
                        <option value="html:swiss-mono">黑白</option>
                    </optgroup>
                </select>
                <button class="header-btn" onclick="toggleFullscreen()" title="全屏">⛶</button>
                <div class="export-wrapper" id="export-wrapper">
                    <button class="header-btn" onclick="toggleExportMenu()" title="导出">📥</button>
                    <div class="export-menu" id="export-menu">
                        <button class="export-option" onclick="exportAsImage()">🖼️ 导出图片</button>
                        <button class="export-option" onclick="exportAsPDF()">📄 导出 PDF</button>
                    </div>
                </div>
            </div>
        </header>
        <div class="content-wrapper">
            <div class="markdown-body" id="markdown-content">Loading...</div>
        </div>
    </div>
    <button class="toc-btn" id="toc-btn" onclick="toggleToc()" title="目录">📋</button>
    <div class="toc-panel" id="toc-panel">
        <div class="toc-panel-title">目录</div>
        <div id="toc-list"></div>
    </div>
    <div class="img-lightbox" id="img-lightbox" onclick="if(event.target===this)closeLightbox()">
        <img id="img-lightbox-img" src="" alt="" />
        <div class="img-toolbar">
            <button onclick="lbZoom(1.5)" title="放大">➕</button>
            <span class="zoom-level" id="zoom-level">100%</span>
            <button onclick="lbZoom(1/1.5)" title="缩小">➖</button>
            <button onclick="lbReset()" title="重置">🔄</button>
            <button onclick="closeLightbox()" title="关闭">✕</button>
        </div>
    </div>
    <div class="browser-overlay" id="browser-overlay" onclick="if(event.target===this)closeBrowser()">
        <div class="browser-modal">
            <div class="browser-header">
                <h3>选择文件</h3>
                <span class="browser-path" id="browser-path"></span>
                <button class="browser-close" onclick="closeBrowser()">✕</button>
            </div>
            <div class="browser-quick" id="browser-quick"></div>
            <div class="browser-list" id="browser-list"></div>
        </div>
    </div>

<script>
let currentId = ${entry.id};
let currentPath = '${entry.path.replace(/'/g, "\\'")}';
let currentDir = '${fileDir.replace(/'/g, "\\'")}';
let currentTheme = '${entry.theme || ""}';
const REFRESH_INTERVAL = ${refreshInterval};
const BROWSE_HISTORY_LIMIT = ${browseHistoryLimit};
let lastMtime = null;

// Marked config — rewrite relative image paths
const renderer = new marked.Renderer();
const origImage = renderer.image.bind(renderer);
renderer.image = function({href, title, text}) {
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('data:')) {
        return origImage({href, title, text});
    }
    if (href.startsWith('/')) {
        return origImage({href: '/api/image?path=' + encodeURIComponent(href), title, text});
    }
    const absPath = currentDir + '/' + href;
    return origImage({href: '/api/image?path=' + encodeURIComponent(absPath), title, text});
};
renderer.heading = function({tokens, depth}) {
    const text = this.parser.parseInline(tokens);
    const slug = 'toc-' + depth + '-' + text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\\w\\u4e00-\\u9fff]+/g, '-').replace(/(^-|-$)/g, '');
    return '<h' + depth + ' id="' + slug + '">' + text + '</h' + depth + '>';
};
marked.setOptions({ renderer, gfm: true, breaks: true });

// Load and render
async function loadContent() {
    try {
        // Welcome page when no file selected
        if (currentId === 0 || !currentPath) {
            document.getElementById('file-title').textContent = 'MD Viewer';
            document.getElementById('header-path').textContent = '';
            document.getElementById('status-dot').style.display = 'none';
            document.getElementById('markdown-content').innerHTML = '<div style="text-align:center;padding:60px 20px"><h1 style="font-size:28px;color:var(--accent);margin-bottom:12px">📄 MD Viewer</h1><p style="color:var(--text-secondary);font-size:15px;line-height:1.6;margin-bottom:24px">在浏览器中渲染 Markdown 文件<br>支持 Mermaid 图表、页内搜索、目录导航</p><p style="color:var(--text-secondary);font-size:13px">点击左侧 <strong>+ Add file</strong> 添加文件 或 拖拽 .md 文件到页面</p></div>';
            document.getElementById('toc-btn').style.display = 'none';
            return;
        }
        const resp = await fetch('/api/file?path=' + encodeURIComponent(currentPath));
        if (!resp.ok) throw new Error('Failed: ' + resp.status);
        const data = await resp.json();
        document.getElementById('file-title').textContent = data.name;
        document.getElementById('header-path').textContent = currentPath;
        document.title = data.name + ' — MD Viewer';
        currentFileText = data.content;
        let html = marked.parse(data.content);
        const contentEl = document.getElementById('markdown-content');
        contentEl.style.opacity = '0';
        contentEl.innerHTML = html;
        // KaTeX 渲染数学公式
        if (typeof renderMathInElement === 'function') {
          renderMathInElement(contentEl, { delimiters: [ {left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false} ], throwOnError: false });
        }
        requestAnimationFrame(() => { contentEl.style.opacity = '1'; });

        // Fix HTML <img> relative src → /api/image?path=
        document.querySelectorAll('#markdown-content img').forEach(img => {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:') && !src.startsWith('/api/')) {
                let absPath;
                if (src.startsWith('/')) {
                    absPath = src;
                } else {
                    absPath = currentDir + '/' + src.split('./').join('');
                }
                img.setAttribute('src', '/api/image?path=' + encodeURIComponent(absPath));
            }
        });

        // Mermaid
        document.querySelectorAll('.language-mermaid').forEach(block => {
            const parent = block.parentElement;
            const div = document.createElement('div');
            div.className = 'mermaid';
            div.textContent = block.textContent;
            parent.replaceWith(div);
        });
        if (typeof mermaid !== 'undefined') mermaid.run();

        document.getElementById('status-dot').className = 'status-dot live';
        buildToc();
        bindImageLightbox();
    } catch (e) {
        document.getElementById('markdown-content').innerHTML = '<p style="color:#f85149">⚠️ Failed to load: ' + e.message + '</p>';
        document.getElementById('status-dot').className = 'status-dot offline';
    }
}

// 主题随机池
const ALL_THEMES = ['md:dark-sage','md:light','md:github-dark','html:aurora-glass','html:magazine','html:neo-brutalism','html:swiss-mono'];

// 应用主题（统一入口）
function applyTheme(themeVal) {
    if (!themeVal) return;
    const [type, name] = themeVal.split(':');
    if (type === 'md') {
        setTheme(name);
    } else if (type === 'html') {
        switchHtmlTheme(name);
    }
}

// 保存主题到文件 entry
async function saveThemeToFile(id, themeVal) {
    try {
        await fetch('/api/set-theme?id=' + id + '&theme=' + encodeURIComponent(themeVal));
    } catch (e) { console.error('saveTheme failed:', e); }
}

// Navigate to file by hash (sidebar click or URL)
async function navigateTo(id) {
    try {
        const resp = await fetch('/api/manifest');
        const manifest = await resp.json();
        const entry = manifest.files.find(f => f.id === id);
        if (!entry) return;

        currentId = id;
        currentPath = entry.path;
        currentDir = entry.path.substring(0, entry.path.lastIndexOf('/'));
        currentTheme = entry.theme || '';
        lastMtime = null;

        // Update sidebar active state
        document.querySelectorAll('.sidebar-item').forEach(li => {
            li.classList.toggle('active', parseInt(li.dataset.id) === id);
        });

        // Refresh sidebar if new file not in list
        const sidebarIds = Array.from(document.querySelectorAll('.sidebar-item')).map(li => parseInt(li.dataset.id));
        if (!sidebarIds.includes(id)) {
            const list = document.getElementById('sidebar-list');
            list.innerHTML = '';
            for (const f of manifest.files) {
                const li = document.createElement('li');
                li.className = 'sidebar-item' + (f.id === id ? ' active' : '');
                li.dataset.id = f.id;
                const copyTag = f.path.includes('/server/uploads/') ? ' <span style="font-size:10px;color:var(--text-secondary);background:var(--bg-tertiary);padding:1px 4px;border-radius:3px">副本</span>' : '';
                li.innerHTML = '<div class="sidebar-file-info"><span class="sidebar-name">' + f.name + copyTag + '</span><span class="sidebar-path" title="' + f.path + '">' + f.path + '</span></div><button class="sidebar-remove" data-remove="' + f.id + '" title="Remove">✕</button>';
                list.appendChild(li);
            }
        }

        // Update URL without reload
        history.pushState({ id }, '', '/i/' + id);

        // 应用主题：有指定用指定的，没有随机一个并保存
        if (!currentTheme) {
            currentTheme = ALL_THEMES[Math.floor(Math.random() * ALL_THEMES.length)];
            saveThemeToFile(id, currentTheme);
        }
        // 加载内容 + 应用主题
        // HTML 主题：只 fetch 缓存原文，跳过 markdown 渲染，直接走 switchHtmlTheme（避免双重 innerHTML 替换闪烁）
        if (currentTheme.startsWith('html:')) {
            const resp = await fetch('/api/file?path=' + encodeURIComponent(currentPath));
            if (!resp.ok) throw new Error('Failed: ' + resp.status);
            const data = await resp.json();
            currentFileText = data.content;
            document.getElementById('file-title').textContent = data.name;
            document.getElementById('header-path').textContent = currentPath;
            document.title = data.name + ' — MD Viewer';
            document.getElementById('status-dot').className = 'status-dot live';
            // 清理旧 HTML 模式的事件监听（但不删 style 元素，由 switchHtmlTheme 原地替换内容）
            if (window._htmlScrollHandler) {
                const sc = document.querySelector('.content-wrapper');
                if (sc) sc.removeEventListener('scroll', window._htmlScrollHandler);
                window._htmlScrollHandler = null;
            }
            if (window._htmlTocObs) { window._htmlTocObs.disconnect(); window._htmlTocObs = null; }
            currentMode = 'html';
            await switchHtmlTheme(currentTheme.split(':')[1]);
            buildToc();
            bindImageLightbox();
        } else {
            // 切到 MD 主题：清理 HTML 模式残留
            if (currentMode === 'html') {
                currentMode = 'md';
                if (window._htmlScrollHandler) {
                    const sc = document.querySelector('.content-wrapper');
                    if (sc) sc.removeEventListener('scroll', window._htmlScrollHandler);
                    window._htmlScrollHandler = null;
                }
                if (window._htmlTocObs) { window._htmlTocObs.disconnect(); window._htmlTocObs = null; }
                const htmlStyle = document.getElementById('html-css');
                if (htmlStyle) htmlStyle.remove();
                currentHtmlTheme = '';
            }
            await loadContent();
            applyTheme(currentTheme);
        }
        checkForUpdates();
    } catch (e) {
        console.error('Navigate failed:', e);
    }
}

// Remove file from sidebar
async function removeFile(id) {
    try {
        await fetch('/api/remove?id=' + id);
        // If removed current file, navigate to another
        if (id === currentId) {
            const resp = await fetch('/api/manifest');
            const manifest = await resp.json();
            if (manifest.files.length > 0) {
                navigateTo(manifest.files[0].id);
            } else {
                window.location.href = '/i/0';
            }
            // Refresh sidebar
            const list = document.getElementById('sidebar-list');
            list.innerHTML = '';
            for (const f of manifest.files) {
                const li = document.createElement('li');
                const copyTag = f.path.includes('/server/uploads/') ? ' <span style="font-size:10px;color:var(--text-secondary);background:var(--bg-tertiary);padding:1px 4px;border-radius:3px">副本</span>' : '';
                li.className = 'sidebar-item' + (f.id === currentId ? ' active' : '');
                li.dataset.id = f.id;
                li.innerHTML = '<div class="sidebar-file-info"><span class="sidebar-name">' + f.name + copyTag + '</span><span class="sidebar-path" title="' + f.path + '">' + f.path + '</span></div><button class="sidebar-remove" data-remove="' + f.id + '" title="Remove">✕</button>';
                list.appendChild(li);
            }
        } else {
            // Just remove from sidebar
            const item = document.querySelector('.sidebar-item[data-id="' + id + '"]');
            if (item) item.remove();
        }
    } catch (e) {
        console.error('Remove failed:', e);
    }
}

// Sidebar toggle
function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('collapsed');
    document.getElementById('expand-btn').style.display = sb.classList.contains('collapsed') ? 'block' : 'none';
    updateBottomBarPosition();
}

// Sidebar resize
(function() {
    const resize = document.getElementById('sidebar-resize');
    const sidebar = document.getElementById('sidebar');
    let isResizing = false;
    resize.addEventListener('mousedown', function(e) {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        const newWidth = Math.min(Math.max(e.clientX, 160), 480);
        sidebar.style.width = newWidth + 'px';
        sidebar.style.minWidth = newWidth + 'px';
        updateBottomBarPosition();
    });
    document.addEventListener('mouseup', function() {
        if (!isResizing) return;
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });
})();

// Sidebar event delegation
document.getElementById('sidebar-list').addEventListener('click', function(e) {
    const removeBtn = e.target.closest('.sidebar-remove');
    if (removeBtn) {
        e.stopPropagation();
        removeFile(parseInt(removeBtn.dataset.remove));
        return;
    }
    const item = e.target.closest('.sidebar-item');
    if (item) navigateTo(parseInt(item.dataset.id));
});

// Auto-refresh
async function checkForUpdates() {
    try {
        const resp = await fetch('/api/mtime?path=' + encodeURIComponent(currentPath));
        if (!resp.ok) return;
        const data = await resp.json();
        if (lastMtime !== null && data.mtime !== lastMtime) {
            loadContent();
        }
        lastMtime = data.mtime;
    } catch {}
}

// Search — multi-word AND matching
let searchMatches = [];
let searchIndex = 0;
document.getElementById('search-input').addEventListener('input', function() {
    const rawQuery = this.value.trim();
    const content = document.getElementById('markdown-content');
    content.querySelectorAll('.search-highlight,.search-highlight-current').forEach(el => {
        el.replaceWith(el.textContent);
    });
    content.normalize(); // merge adjacent text nodes
    searchMatches = [];
    searchIndex = 0;
    document.getElementById('search-count').textContent = '';
    if (!rawQuery) return;

    // Split into words, search each independently
    const words = rawQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return;

    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
        const textLower = node.textContent.toLowerCase();
        // AND logic: ALL words must be present in this text node
        if (!words.every(w => textLower.includes(w))) return;
        const parent = node.parentElement;
        if (parent.classList.contains('search-highlight') || parent.classList.contains('search-highlight-current')) return;

        // Highlight the first matching word
        const firstWord = words[0];
        const idx = textLower.indexOf(firstWord);
        const before = node.textContent.slice(0, idx);
        const match = node.textContent.slice(idx, idx + firstWord.length);
        const after = node.textContent.slice(idx + firstWord.length);

        const span = document.createElement('span');
        span.className = 'search-highlight';
        span.textContent = match;
        searchMatches.push(span);

        const frag = document.createDocumentFragment();
        if (before) frag.appendChild(document.createTextNode(before));
        frag.appendChild(span);
        if (after) frag.appendChild(document.createTextNode(after));
        node.parentNode.replaceChild(frag, node);
    });

    if (searchMatches.length > 0) {
        searchMatches[0].className = 'search-highlight-current';
        searchMatches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.getElementById('search-count').textContent = '1/' + searchMatches.length;
    }
});

document.getElementById('search-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && searchMatches.length > 0) {
        searchMatches[searchIndex].className = 'search-highlight';
        searchIndex = (searchIndex + (e.shiftKey ? -1 : 1) + searchMatches.length) % searchMatches.length;
        searchMatches[searchIndex].className = 'search-highlight-current';
        searchMatches[searchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.getElementById('search-count').textContent = (searchIndex + 1) + '/' + searchMatches.length;
    }
});

// Fullscreen
function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
}

// File browser
let browserDir = '';
function getBrowseHistory() {
    try { return JSON.parse(localStorage.getItem('md-viewer-browse-history') || '[]').filter(d => typeof d === 'string' && d); } catch { return []; }
}
function saveBrowseHistory(dir) {
    if (!dir || typeof dir !== 'string') return;
    let history = getBrowseHistory();
    history = history.filter(d => d !== dir);
    history.unshift(dir);
    history = history.slice(0, BROWSE_HISTORY_LIMIT);
    localStorage.setItem('md-viewer-browse-history', JSON.stringify(history));
}
function renderQuickAccess() {
    const history = getBrowseHistory();
    const container = document.getElementById('browser-quick');
    container.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'browser-quick-label';
    label.textContent = '快速访问';
    container.appendChild(label);
    const homeChip = document.createElement('span');
    homeChip.className = 'browser-chip home';
    homeChip.textContent = '🏠';
    homeChip.onclick = () => loadBrowserDir('');
    container.appendChild(homeChip);
    for (const dir of history) {
        const chip = document.createElement('span');
        chip.className = 'browser-chip';
        const short = dir.split('/').length > 3 ? '~/' + dir.split('/').slice(3).join('/') : dir;
        chip.textContent = short;
        chip.title = dir;
        chip.onclick = () => loadBrowserDir(dir);
        container.appendChild(chip);
    }
}
async function openBrowser() {
    document.getElementById('browser-overlay').classList.add('open');
    renderQuickAccess();
    const history = getBrowseHistory();
    await loadBrowserDir(history.length > 0 ? history[0] : '');
}
function closeBrowser() {
    document.getElementById('browser-overlay').classList.remove('open');
}
async function loadBrowserDir(dir) {
    try {
        const resp = await fetch('/api/browse?dir=' + encodeURIComponent(dir));
        const data = await resp.json();
        browserDir = data.dir || '';
        if (data.dir) saveBrowseHistory(data.dir);
        renderQuickAccess();
        document.getElementById('browser-path').textContent = data.dir;
        const list = document.getElementById('browser-list');
        list.innerHTML = '';
        if (data.parent && data.parent !== data.dir) {
            const el = document.createElement('div');
            el.className = 'browser-item';
            el.dataset.dir = data.parent;
            el.innerHTML = '<span class="icon">📁</span><span class="name">..</span>';
            list.appendChild(el);
        }
        if (data.items.length === 0) {
            list.innerHTML += '<div class="browser-empty">空目录</div>';
            return;
        }
        for (const item of data.items) {
            const el = document.createElement('div');
            if (item.isDir) {
                el.className = 'browser-item';
                el.dataset.dir = item.path;
                el.innerHTML = '<span class="icon">📁</span><span class="name">' + item.name + '</span>';
            } else {
                el.className = 'browser-item is-md';
                el.dataset.file = item.path;
                el.innerHTML = '<span class="icon">📄</span><span class="name">' + item.name + '</span>';
            }
            list.appendChild(el);
        }
    } catch (e) {
        console.error('Browse failed:', e);
        document.getElementById('browser-list').innerHTML = '<div class="browser-empty">加载失败</div>';
    }
}
// Event delegation for browser clicks
document.getElementById('browser-list').addEventListener('click', function(e) {
    const item = e.target.closest('.browser-item');
    if (!item) return;
    if (item.dataset.dir) loadBrowserDir(item.dataset.dir);
    if (item.dataset.file) selectMdFile(item.dataset.file);
});
async function selectMdFile(filePath) {
    try {
        const resp = await fetch('/api/register?path=' + encodeURIComponent(filePath));
        if (resp.ok) {
            const entry = await resp.json();
            closeBrowser();
            navigateTo(entry.id);
        } else {
            const err = await resp.json();
            alert(err.error || '注册失败');
        }
    } catch (e) {
        alert('注册失败: ' + e.message);
    }
}

// Drag & drop support
document.addEventListener('dragover', function(e) {
    e.preventDefault();
    document.getElementById('drop-overlay').classList.add('active');
});
document.addEventListener('dragleave', function(e) {
    if (e.relatedTarget === null || !document.body.contains(e.relatedTarget)) {
        document.getElementById('drop-overlay').classList.remove('active');
    }
});
document.addEventListener('drop', async function(e) {
    e.preventDefault();
    document.getElementById('drop-overlay').classList.remove('active');
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
        if (!file.name.endsWith('.md')) continue;
        try {
            const content = await file.text();
            const resp = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'x-filename': file.name },
                body: content
            });
            if (resp.ok) {
                const entry = await resp.json();
                navigateTo(entry.id);
                return;
            }
        } catch (e) {
            console.error('Failed to register file:', e);
        }
    }
});

// Browser back/forward
window.addEventListener('popstate', function(e) {
    if (e.state && e.state.id) navigateTo(e.state.id);
});

// TOC
function buildToc() {
    const content = document.getElementById('markdown-content');
    const tocList = document.getElementById('toc-list');
    const headings = content.querySelectorAll('h1, h2, h3, h4');
    tocList.innerHTML = '';
    if (headings.length === 0) { document.getElementById('toc-btn').style.display = 'none'; return; }
    document.getElementById('toc-btn').style.display = 'flex';
    headings.forEach(h => {
        const level = parseInt(h.tagName[1]);
        const a = document.createElement('a');
        a.className = 'toc-item';
        a.dataset.level = level;
        a.textContent = h.textContent;
        a.onclick = function(e) {
            e.preventDefault();
            h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        tocList.appendChild(a);
    });
    setupTocObserver();
}

// Image lightbox
let lbScale = 1, lbX = 0, lbY = 0, lbDragging = false, lbStartX = 0, lbStartY = 0;
function bindImageLightbox() {
    document.querySelectorAll('.markdown-body img').forEach(img => {
        img.onclick = function() {
            lbScale = 1; lbX = 0; lbY = 0; lbTargetY = 0;
            const lbImg = document.getElementById('img-lightbox-img');
            lbImg.src = this.src;
            lbImg.style.transform = '';
            updateZoomLevel();
            document.getElementById('img-lightbox').classList.add('open');
        };
    });
}
function closeLightbox() {
    document.getElementById('img-lightbox').classList.remove('open');
}
function updateZoomLevel() {
    document.getElementById('zoom-level').textContent = Math.round(lbScale * 100) + '%';
}
function updateLightboxTransform() {
    const img = document.getElementById('img-lightbox-img');
    img.style.transform = 'translate(' + lbX + 'px,' + lbY + 'px) scale(' + lbScale + ')';
    updateZoomLevel();
}
function lbZoom(factor) {
    lbScale = Math.min(Math.max(lbScale * factor, 0.2), 10);
    if (lbScale <= 1) { lbX = 0; lbY = 0; }
    updateLightboxTransform();
}
function lbReset() {
    lbScale = 1; lbX = 0; lbY = 0; lbTargetY = 0;
    updateLightboxTransform();
}
// Double click to toggle fit/original
document.getElementById('img-lightbox-img').addEventListener('dblclick', function(e) {
    e.stopPropagation();
    if (lbScale === 1) {
        lbScale = 3; lbX = 0; lbY = 0;
    } else {
        lbScale = 1; lbX = 0; lbY = 0;
    }
    updateLightboxTransform();
});
// Wheel: smooth vertical pan only when zoomed in
let lbTargetY = 0, lbAnimId = null;
function clampPan() {
    const vh = window.innerHeight;
    const maxY = Math.max(0, (lbScale - 1) * vh / 2);
    lbX = 0;
    lbY = Math.min(maxY, Math.max(-maxY, lbY));
    lbTargetY = lbY;
}
function animatePan() {
    lbAnimId = null;
    lbY += (lbTargetY - lbY) * 0.35;
    if (Math.abs(lbTargetY - lbY) < 0.5) lbY = lbTargetY;
    else lbAnimId = requestAnimationFrame(animatePan);
    updateLightboxTransform();
}
document.getElementById('img-lightbox-img').addEventListener('wheel', function(e) {
    e.preventDefault();
    if (lbScale <= 1) return;
    lbTargetY -= e.deltaY * 0.6;
    const vh = window.innerHeight;
    const maxY = Math.max(0, (lbScale - 1) * vh / 2);
    lbTargetY = Math.min(maxY, Math.max(-maxY, lbTargetY));
    lbX = 0;
    if (!lbAnimId) lbAnimId = requestAnimationFrame(animatePan);
}, { passive: false });
// Drag to pan
document.getElementById('img-lightbox-img').addEventListener('mousedown', function(e) {
    e.stopPropagation();
    lbDragging = true;
    lbStartX = e.clientX - lbX;
    lbStartY = e.clientY - lbY;
});
document.addEventListener('mousemove', function(e) {
    if (!lbDragging) return;
    lbX = e.clientX - lbStartX;
    lbY = e.clientY - lbStartY;
    updateLightboxTransform();
});
document.addEventListener('mouseup', function() { lbDragging = false; });
// ESC to close
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeLightbox();
    if (lbScale > 1) {
        const step = lbScale * 50;
        if (e.key === 'ArrowLeft') { lbX += step; updateLightboxTransform(); e.preventDefault(); }
        if (e.key === 'ArrowRight') { lbX -= step; updateLightboxTransform(); e.preventDefault(); }
        if (e.key === 'ArrowUp') { lbY += step; updateLightboxTransform(); e.preventDefault(); }
        if (e.key === 'ArrowDown') { lbY -= step; updateLightboxTransform(); e.preventDefault(); }
    }
});

function toggleToc() {
    document.getElementById('toc-panel').classList.toggle('open');
}

// Close TOC on outside click
document.addEventListener('click', function(e) {
    const panel = document.getElementById('toc-panel');
    const btn = document.getElementById('toc-btn');
    if (panel.classList.contains('open') && !panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove('open');
    }
});

let tocObserver = null;
function setupTocObserver() {
    if (tocObserver) tocObserver.disconnect();
    const content = document.getElementById('markdown-content');
    const headings = content.querySelectorAll('h1, h2, h3, h4');
    const tocItems = document.querySelectorAll('.toc-item');
    if (headings.length === 0) return;
    tocObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const idx = Array.from(headings).indexOf(entry.target);
                tocItems.forEach((item, i) => item.classList.toggle('active', i === idx));
            }
        });
    }, { root: content.parentElement, rootMargin: '0px 0px -80% 0px', threshold: 0 });
    headings.forEach(h => tocObserver.observe(h));
}

// Search toggle
function toggleSearch() {
    const container = document.getElementById('search-container');
    const toggle = document.getElementById('search-toggle');
    const input = document.getElementById('search-input');
    container.classList.toggle('open');
    toggle.classList.toggle('active');
    if (container.classList.contains('open')) {
        input.focus();
    } else {
        if (input.value) { input.value = ''; clearSearch(); }
    }
}

// Theme switching
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('md-viewer-theme', theme);
    syncThemeSelect();
}

// Unified theme handler
async function onThemeChange(value) {
    if (!value) return;
    currentTheme = value;
    applyTheme(value);
    // 保存到当前文件 entry（确保完成）
    if (currentId > 0) {
        try { await saveThemeToFile(currentId, value); } catch(e) { console.error('saveTheme:', e); }
    }
}

// Sync select to current state
function syncThemeSelect() {
    const sel = document.getElementById('theme-select');
    if (!sel) return;
    if (currentMode === 'html' && currentHtmlTheme) {
        sel.value = 'html:' + currentHtmlTheme;
    } else {
        const saved = localStorage.getItem('md-viewer-theme') || 'light';
        sel.value = 'md:' + saved;
    }
}

// HTML 主题切换（客户端渲染 + CSS 互斥切换）
let currentMode = 'md'; // 'md' | 'html'
let currentHtmlTheme = localStorage.getItem('md-viewer-html-theme') || '';
let currentFileText = ''; // 缓存当前文件文本

async function switchHtmlTheme(themeName) {
    // 首次切换到 HTML 模式：currentFileText 已由 loadContent 缓存
    if (currentMode !== 'html') {
        currentMode = 'html';
    }

    // 客户端渲染
    const tokens = parseMdTokens(currentFileText);
    const pageData = tokensToStructured(tokens);
    const cssText = window.__mdToWebCSS.getCss();
    const fileName = currentPath.split('/').pop();
    const fullHtml = buildFullHtml(pageData, themeName, { cssText, fileName, skipDemoBar: true });

    // 用 DOMParser 解析生成的 HTML（避免模板字符串吃反斜杠 + 避免正则匹配 script 闭合标签截断）
    const parser = new DOMParser();
    const doc = parser.parseFromString(fullHtml, 'text/html');

    // 提取 <style> 内容
    const styleEl = doc.querySelector('style');
    const styleContent = styleEl ? styleEl.textContent : '';

    // 提取 <body> 内容（去掉 script 标签和重复的 img-lightbox）
    doc.querySelectorAll('script').forEach(s => s.remove());
    doc.querySelectorAll('#img-lightbox').forEach(el => el.remove());
    const bodyContent = doc.body ? doc.body.innerHTML : '';

    // CSS 作用域隔离：HTML CSS 只作用于 #markdown-content，不干扰侧边栏/header 等
    // 不禁用 #md-css（它管全局 UI），只用 scoped style 覆盖内容区
    let htmlStyle = document.getElementById('html-css');
    if (!htmlStyle) {
        htmlStyle = document.createElement('style');
        htmlStyle.id = 'html-css';
        document.head.appendChild(htmlStyle);
    }
    htmlStyle.textContent = '#markdown-content { all: unset; color: revert; } ' + styleContent;

    // 不禁用 MD CSS — 侧边栏/header/search/lightbox 继续用
    // 但 #markdown-content 的样式被 html-css 覆盖
    const contentArea = document.getElementById('markdown-content');
    if (contentArea) contentArea.innerHTML = bodyContent;

    // KaTeX 渲染
    if (typeof renderMathInElement === 'function') {
      renderMathInElement(contentArea, { delimiters: [ {left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false} ], throwOnError: false });
    }

    // 设置 data-theme
    document.documentElement.setAttribute('data-theme', themeName);

    // 先更新状态
    currentHtmlTheme = themeName;
    localStorage.setItem('md-viewer-html-theme', themeName);

    // 再同步 select（读的是 currentHtmlTheme，必须在更新之后）
    syncThemeSelect();

    // 注入后初始化：dot-nav 导航高亮、底部进度条、图片灯箱、代码高亮
    postHtmlInject();
    updateBottomBarPosition();
}

// HTML 主题注入后初始化：dot-nav 导航高亮、底部进度条、图片灯箱、代码高亮
function postHtmlInject() {
    const scope = document.getElementById('markdown-content');
    if (!scope) return;
    const sc = document.querySelector('.content-wrapper'); // 滚动容器

    // HTML <img> 相对路径重写：通过 /api/image 代理
    scope.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:') && !src.startsWith('/api/')) {
            let absPath;
            if (src.startsWith('/')) absPath = src;
            else { let p = src; while (p.startsWith('./')) p = p.slice(2); while (p.startsWith('../')) p = p.slice(3); absPath = currentDir + '/' + p; }
            img.setAttribute('src', '/api/image?path=' + encodeURIComponent(absPath));
        }
    });

    // dot-nav 高亮
    const dots = scope.querySelectorAll('.dot-nav a');
    if (dots.length > 0) {
        const ids = ['top', ...[...scope.querySelectorAll('.web-section')].map(s => s.id)];
        if (window._htmlTocObs) window._htmlTocObs.disconnect();
        window._htmlTocObs = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    dots.forEach(a => a.classList.toggle('active', a.dataset.target === e.target.id));
                }
            });
        }, { root: sc, rootMargin: '0px 0px -60% 0px' });
        ids.forEach(id => {
            const el = scope.querySelector('#' + id);
            if (el) window._htmlTocObs.observe(el);
        });
        if (dots[0]) dots[0].classList.add('active');
    }

    // dot-nav 点击跳转
    dots.forEach(a => {
        a.onclick = function(e) {
            e.preventDefault();
            const target = scope.querySelector('#' + a.dataset.target);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
    });

    // 底部进度条
    const main = scope.querySelector('main');
    if (main && sc) {
        const totalText = main.innerText || '';
        const totalLen = totalText.replace(/\s/g, '').length;
        const readMin = Math.max(1, Math.ceil(totalLen / 500));
        const fmt = n => n.toLocaleString('en-US');
        const bbChars = scope.querySelector('#bb-chars');
        const bbRead = scope.querySelector('#bb-read');
        const bbPos = scope.querySelector('#bb-pos');
        const bbPct = scope.querySelector('#bb-pct');
        const bbBar = scope.querySelector('#bb-bar');
        if (bbChars) bbChars.textContent = '字数 ' + fmt(totalLen);
        if (bbRead) bbRead.textContent = '预计阅读 ' + readMin + ' 分钟';
        if (bbPos) { bbPos.textContent = '第 0 字 / 共 ' + fmt(totalLen) + ' 字'; bbPos.title = '第 0 字 / 共 ' + fmt(totalLen) + ' 字'; }
        if (window._htmlScrollHandler) sc.removeEventListener('scroll', window._htmlScrollHandler);
        window._htmlScrollHandler = function() {
            const scrollH = sc.scrollHeight;
            const clientH = sc.clientHeight;
            const scrollTop = sc.scrollTop;
            const maxScroll = scrollH - clientH;
            const pct = maxScroll > 0 ? Math.min(1, scrollTop / maxScroll) : 0;
            const curChar = Math.round(pct * totalLen);
            if (bbPos) { bbPos.textContent = '第 ' + fmt(curChar) + ' 字 / 共 ' + fmt(totalLen) + ' 字'; bbPos.title = '第 ' + fmt(curChar) + ' 字 / 共 ' + fmt(totalLen) + ' 字'; }
            if (bbPct) bbPct.textContent = Math.round(pct * 100) + '%';
            if (bbBar) bbBar.style.width = Math.round(pct * 100) + '%';
        };
        sc.addEventListener('scroll', window._htmlScrollHandler, { passive: true });
        window._htmlScrollHandler();
    }

    // 图片灯箱（HTML 主题内）
    scope.querySelectorAll('.md-image img').forEach(img => {
        img.onclick = function() {
            lbScale = 1; lbX = 0; lbY = 0; lbTargetY = 0;
            const lbImg = document.getElementById('img-lightbox-img');
            lbImg.src = this.src;
            lbImg.style.transform = '';
            updateZoomLevel();
            document.getElementById('img-lightbox').classList.add('open');
        };
    });

    // 代码高亮
    if (typeof hljs !== 'undefined') hljs.highlightAll();

    // Mermaid 图表渲染（HTML 主题内的 mermaid div）
    const mermaidDivs = scope.querySelectorAll('.mermaid');
    if (mermaidDivs.length > 0 && typeof mermaid !== 'undefined') {
        mermaid.run({ nodes: mermaidDivs });
    }
}

// 底部进度条位置：跟随 sidebar 展开/折叠/调宽
function updateBottomBarPosition() {
    const bb = document.getElementById('bottom-bar');
    if (!bb) return;
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) { bb.style.left = '0'; return; }
    if (sidebar.classList.contains('collapsed')) {
        bb.style.left = '0';
    } else {
        bb.style.left = sidebar.offsetWidth + 'px';
    }
}

// MD 主题选择时，如果在 HTML 模式，先切回 MD 模式
const _originalSetTheme = setTheme;
setTheme = function(theme) {
    if (currentMode === 'html') {
        // 切回 MD 模式
        currentMode = 'md';
        // 清理 HTML 模式的 scroll listener 和 observer
        if (window._htmlScrollHandler) {
            const sc = document.querySelector('.content-wrapper');
            if (sc) sc.removeEventListener('scroll', window._htmlScrollHandler);
            window._htmlScrollHandler = null;
        }
        if (window._htmlTocObs) { window._htmlTocObs.disconnect(); window._htmlTocObs = null; }
        const htmlStyle = document.getElementById('html-css');
        if (htmlStyle) htmlStyle.remove();
        document.documentElement.setAttribute('data-theme', theme);
        currentHtmlTheme = '';
        localStorage.removeItem('md-viewer-html-theme');
        syncThemeSelect();
        loadContent();
    }
    _originalSetTheme(theme);
};

// Init
(function() {
    // 首次打开：如果有指定主题用指定的，否则随机
    if (!currentTheme) {
        currentTheme = ALL_THEMES[Math.floor(Math.random() * ALL_THEMES.length)];
        if (currentId > 0) saveThemeToFile(currentId, currentTheme);
    }
})();
loadContent().then(() => {
    // loadContent 完成后再应用主题，避免 MD 渲染覆盖 HTML 主题内容
    applyTheme(currentTheme);
    if (currentTheme.startsWith('html:')) {
        setTimeout(updateBottomBarPosition, 100);
    }
    checkForUpdates();
});
setInterval(checkForUpdates, REFRESH_INTERVAL);

// Export
function toggleExportMenu() {
    document.getElementById('export-menu').classList.toggle('open');
}
document.addEventListener('click', function(e) {
    if (!e.target.closest('#export-wrapper')) {
        document.getElementById('export-menu').classList.remove('open');
    }
});
function _exportClone() {
    const el = document.getElementById('markdown-content');
    const clone = el.cloneNode(true);
    clone.style.maxWidth = 'none';
    clone.style.position = 'absolute';
    clone.style.left = '-99999px';
    clone.style.top = '0';
    clone.style.width = el.parentElement.offsetWidth + 'px';
    document.body.appendChild(clone);
    return clone;
}

async function exportAsImage() {
    toggleExportMenu();
    const clone = _exportClone();
    try {
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim();
        const canvas = await html2canvas(clone, { backgroundColor: bg, scale: 1.5, useCORS: true });
        const a = document.createElement('a');
        a.download = (document.getElementById('file-title').textContent || 'export') + '.png';
        a.href = canvas.toDataURL('image/png');
        a.click();
    } finally {
        clone.remove();
    }
}
async function exportAsPDF() {
    toggleExportMenu();
    const clone = _exportClone();
    try {
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim();
        const children = Array.from(clone.children);
        const boundaries = children.map(c => ({
            top: c.offsetTop,
            bottom: c.offsetTop + c.offsetHeight
        }));
        const totalH = clone.scrollHeight;

        const canvas = await html2canvas(clone, { backgroundColor: bg, scale: 1.5, useCORS: true });
        const { jsPDF } = window.jspdf;
        const margin = 10;
        const pdfW = 210 - margin * 2;
        const pdfH = (canvas.height * pdfW) / canvas.width;
        const pxToPdf = pdfH / totalH;
        const pageH = 297 - margin * 2;
        const tolerance = 30 * pxToPdf;

        const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
        let pos = 0;
        let pageNum = 0;

        while (pos < pdfH) {
            if (pageNum > 0) pdf.addPage();
            let cutAt = pos + pageH;

            if (cutAt < pdfH) {
                let best = cutAt;
                for (const b of boundaries) {
                    const bPdf = b.bottom * pxToPdf;
                    if (bPdf > pos && bPdf <= cutAt && (cutAt - bPdf) <= tolerance) {
                        best = bPdf;
                    }
                }
                cutAt = best;
            }

            const sliceH = cutAt - pos;
            const srcY = (pos / pdfH) * canvas.height;
            const srcH = (sliceH / pdfH) * canvas.height;
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = canvas.width;
            tmpCanvas.height = Math.ceil(srcH);
            const tmpCtx = tmpCanvas.getContext('2d');
            tmpCtx.fillStyle = bg || '#ffffff';
            tmpCtx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
            tmpCtx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
            const sliceImg = tmpCanvas.toDataURL('image/jpeg', 0.85);
            pdf.addImage(sliceImg, 'JPEG', margin, margin, pdfW, sliceH);

            pos = cutAt;
            pageNum++;
        }
        pdf.save((document.getElementById('file-title').textContent || 'export') + '.pdf');
    } finally {
        clone.remove();
    }
}
</script>
<script>
// 代码块复制按钮
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('code-copy-btn')) {
    var btn = e.target;
    var code = btn.closest('.code-block').querySelector('code');
    if (!code) return;
    var text = code.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        btn.textContent = '已复制';
        btn.classList.add('copied');
        setTimeout(function() { btn.textContent = '复制'; btn.classList.remove('copied'); }, 1500);
      }).catch(function() { fallbackCopy(btn, text); });
    } else { fallbackCopy(btn, text); }
  }
});
function fallbackCopy(btn, text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  btn.textContent = '已复制';
  btn.classList.add('copied');
  setTimeout(function() { btn.textContent = '复制'; btn.classList.remove('copied'); }, 1500);
}
</script>
</body>
</html>`;
}

app.get("/", (req, res) => {
  const manifest = loadManifest();
  if (manifest.files.length > 0) {
    res.redirect("/i/" + manifest.files[0].id);
  } else {
    res.redirect("/i/0");
  }
});

app.listen(PORT, () => {
  console.log("MD Viewer Server running at http://localhost:" + PORT);
});

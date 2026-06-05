---
name: md-viewer
description: 在浏览器中渲染 Markdown 文件，当用户明确要求用 viewer/浏览器 预览 md 文件或关闭 viewer 时触发。触发词：view md/预览 md/viewer/关闭 viewer
---

## 路径

```
SKILL_DIR = 本 SKILL.md 所在目录的父目录(即 skill 根目录)
$SKILL_DIR/config.json              ← 配置文件(端口/刷新间隔/浏览历史条数/文件注册表)，不存在时自动创建
$SKILL_DIR/server/viewer-server.js  ← 服务端主程序
```

## ⚠️ 依赖

- **npm**: 首次使用需 `cd $SKILL_DIR/server && npm install` 安装 express
- **CDN**: marked + mermaid 通过 unpkg CDN 加载，**离线不可用**
- **首次加载**: mermaid 2.6MB 约 2s，浏览器缓存后秒开

## 功能

| 功能 | 说明 |
|------|------|
| Markdown 渲染 | GFM 语法 + Mermaid 图表 |
| 页内搜索 | 多词 AND 匹配，Shift+Enter 上下跳转 |
| 目录导航 | 右下角 📋 按钮，h1~h4 层级，当前区域高亮，点击跳转 |
| 图片放大 | 点击全屏，按钮/双击缩放，方向键/拖拽移动，ESC 关闭 |
| 自动刷新 | 检测文件修改自动重载 |
| 主题切换 | Light(默认) / Dark Sage / GitHub Dark |
| 文件浏览器 | + Add file 弹窗选文件，快速访问历史目录 |
| 侧边栏调宽 | 拖拽右边缘调整宽度(160~480px) |
| 拖拽添加 | 拖 .md 文件到页面上传（副本，不跟踪源文件更新） |

## 初始化

```bash
cd $SKILL_DIR/server && npm install
```

`config.json` 不存在时启动自动创建，默认内容：
```json
{"port":3456,"refresh_interval":3000,"browse_history_limit":5,"last_updated":"","files":[]}
```

## 命令

### view — 查看 md 文件

1. **确认文件路径为绝对路径**
2. **注册文件**：`curl -s "http://localhost:PORT/api/register?path=ENCODED_ABS_PATH"`
3. **如果 server 未运行**：`cd $SKILL_DIR/server && node viewer-server.js &`，等待 2 秒后重新注册
4. **打开浏览器**：`open "http://localhost:PORT/i/ID"`

端口获取：`cat $SKILL_DIR/config.json | grep -o '"port":[[:space:]]*[0-9]*' | grep -o '[0-9]*'`

### stop — 关闭 viewer server

```bash
kill $(lsof -ti:PORT)
```

---

## 配置

配置文件：`$SKILL_DIR/config.json`

| 参数 | 说明 | 默认值 | 热生效 |
|------|------|--------|--------|
| `port` | 服务端口 | 3456 | ❌ |
| `refresh_interval` | 自动刷新间隔（毫秒） | 3000 | ❌ |
| `browse_history_limit` | 快速访问历史条数 | 5 | ✅ |
| `last_updated` | 最后更新时间 | - | ✅ |
| `files` | 已注册文件列表 | [] | ✅ |

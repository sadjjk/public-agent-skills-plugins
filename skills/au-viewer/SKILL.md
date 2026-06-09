---
name: au-viewer
description: au (agent-undo) 的 Web 可视化前端，提供项目级文件变更时间线浏览 + 恢复能力。触发词：au-viewer 具体项目路径/au-viewer 关闭
---


# au-viewer

au (agent-undo) 的 Web 可视化前端，提供项目级文件变更时间线浏览 + 恢复能力。

## 路径

```
SKILL_DIR = 本 SKILL.md 所在目录的父目录(即 skill 根目录)
$SKILL_DIR/config.json                ← 配置文件(端口/项目列表)，不存在时自动创建
$SKILL_DIR/server/au-viewer-server.js ← 服务端主程序
```

## ⚠️ 依赖

- **npm**: 首次使用需 `cd $SKILL_DIR/server && npm install` 安装 express + better-sqlite3
- **au**: 需要本地安装 au CLI（`~/.local/bin/au`）

## 初始化

```bash
cd $SKILL_DIR/server && npm install
```

`config.json` 不存在时启动自动创建，默认内容：
```json
{"port":3457,"projects":[]}
```

## 命令

### view — 查看 au 项目时间线

1. **启动 server**：如果 server 未运行，`cd $SKILL_DIR/server && node au-viewer-server.js &`，等待 2 秒
2. **注册项目（可选）**：
   - 如果指定了项目路径：确认为绝对路径且存在 `.agent-undo/` 目录，然后 `curl -s "http://localhost:PORT/api/register?path=ENCODED_ABS_PATH"`
   - 未指定项目路径：跳过，用户可在浏览器中添加
3. **打开浏览器**：`open "http://localhost:PORT/"`

端口获取：`cat $SKILL_DIR/config.json | grep -o '"port":[[:space:]]*[0-9]*' | grep -o '[0-9]*'`

### stop — 关闭 viewer server

```bash
kill $(lsof -ti:PORT)
```

端口获取：`cat $SKILL_DIR/config.json | grep -o '"port":[[:space:]]*[0-9]*' | grep -o '[0-9]*'`

## 配置

配置文件：`$SKILL_DIR/config.json`

| 参数 | 说明 | 默认值 | 热生效 |
|------|------|--------|--------|
| `port` | 服务端口 | 3457 | ❌ |
| `refresh_interval` | 自动刷新间隔（毫秒） | 30000 | ❌ |
| `projects` | 已注册项目列表 | [] | ✅ |

## 功能

- 项目级事件时间线（create/modify/delete）
- 多维度过滤（文件名/时间/Action/Agent/Session）
- 文件 blame（行级归属追踪）
- 事件 diff（unified diff 渲染）
- 恢复预览（GitHub Commit UI 风格，左侧文件列表 + 右侧左右对比）
- 全局快照（pin 列表 + 恢复）
- 暗色/亮色主题切换

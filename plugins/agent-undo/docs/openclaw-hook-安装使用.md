# Agent Undo Hook

Agent 编辑文件时自动归因，让每次文件改动都能追溯到具体的 Agent 会话


## 💬 作者说

Agent 改文件，改完就走了，文件变了但没人知道是谁改的

au CLI 提供了 `au hook pre/post` 来标记归因窗口

这个事就可以交给 Agent 自己来执行

于是有了这个 OpenClaw Hook 插件

Agent 开始编辑前自动 `au hook pre`，编辑结束自动 `au hook post`

归因全自动，用户无感

## ✨ 功能一览

| 功能 | 说明 |
|------|------|
| 自动归因 | Agent 编辑文件时自动调用 au hook pre/post，无需手动执行 |
| 未初始化提醒 | 在未执行 `au init` 的项目中操作时，每日限量提醒 |
| 自动 Pin | 距上次操作超过指定天数时自动 `au pin`，防止回撤窗口过大 |
| 自动停止 | au daemon 闲置超过指定时间后自动停止，节省资源 |

## ✨ 亮点

**会话级归因** — 与原版 au 最大的区别。原版 au 一次工具写入对应一个 session，本插件将整个 OpenClaw 会话映射为一个 au session，会话内多次文件修改统一归因。

**自动识别项目** — 写入文件时自动向上查找 `.agent-undo/` 目录定位项目根，无需手动指定。未初始化的项目会启发式发现并提醒。

**项目隔离** — 同一会话涉及多个项目时，每个项目独立开 au session，互不干扰。

**渠道类型归因** — 自动解析 OpenClaw 渠道类型（feishu / cron / subagent / desktop / webchat），写入 au 的 agent 字段，au-viewer 中一眼区分来源。

**Prompt 输入输出记录** — 每轮对话的 prompt、model、output 自动写入 au session metadata，方便跟踪。

> ⚠️ 已知局限：多 Agent 同时修改同一文件时归因可能错乱，但这种情况极少发生，本身多 Agent 改同一文件就容易冲突。

## 🚀 安装

```bash
# 在 agent-undo 目录下执行
cd plugins/agent-undo
openclaw plugins install ./openclaw-extensions

# 配置插件（启用 + 允许读取对话上下文）
openclaw gateway config.patch --raw '{"plugins":{"entries":{"agent-undo-hook":{"enabled":true,"hooks":{"allowConversationAccess":true}}}}}'

# 重启生效
openclaw gateway restart
```

**配置**：默认即可，无需额外配置：

```json
"agent-undo-hook": {
  "enabled": true
}
```

需要调整时：

```json
"agent-undo-hook": {
  "enabled": true,
  "config": {
    "uninitRemindDailyLimit": 3,
    "uninitRemindIntervalMin": 5,
    "uninitRemindIgnorePaths": [],
    "autostopIdleMinutes": 120,
    "autoPinGapDays": 1,
    "promptTruncLen": 200,
    "outputTruncLen": 200
  }
}
```

| 配置 | 说明 | 默认值 |
|------|------|--------|
| `uninitRemindDailyLimit` | 每天最多提醒「未初始化 au」的次数，0 关闭 | 3 |
| `uninitRemindIntervalMin` | 同一项目两次提醒的最小间隔（分钟），0 不限 | 5 |
| `uninitRemindIgnorePaths` | 忽略提醒的路径前缀列表，支持 ~ 展开 | [] |
| `autostopIdleMinutes` | au daemon 闲置自动停止时间（分钟），0 关闭 | 120 |
| `autoPinGapDays` | 距上次操作超过此天数时自动 au pin，0 关闭 | 1 |
| `promptTruncLen` | au session end 时 prompt 截断长度 | 200 |
| `outputTruncLen` | au session end 时 prompt_output 截断长度 | 200 |


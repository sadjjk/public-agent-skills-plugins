# Agent Undo (au)

一句话 可轻如鹅毛 亦可重于泰山

在Agent领域 一句话 即可以什么文件也不改 也可以改无数个文件

纯聊天 怎么聊都行

但一旦涉及干活 文件被修复 被删除 就非常的危险

哪怕现在Agent在改之前都会确认和Diff

但还逃不出改崩的风险

因此必须有一套独立的文件跟踪系统 用于对比和回撤

于是有了 Agent Undo

## 💬 作者说

原本 【一套独立的文件跟踪系统】

这说的不就是 Git 早就有大神打造的好

但实际把Git嵌入Agent的实际场景中 还是有很多不便

Git Commit需要人为或Agent触发 但触发的时机很难把握 无法精准定位到会话级

如果每句话都Commit ，Commit又太多太乱 无法复盘
  
因此 Agent Undo 很好的解决了这个问题

没有Branch 没有Push 

就是纯粹本地文件监控系统

一旦任何文件变化了 就记录

那 Agent 怎么参与进行

Agent 在改文件之前 先吱一声 【是我OpenClaw 我要开始改 这个文件夹了 哈】

Agent Undo 【收到收到】

Agent 改完文件后 【我改好了 Over Over】

Agent Undo 就把这个期间这个项目任何文件的改动 都算再当前Agent上

## 🏠 仓库说明

本项目存在两个版本：

| 仓库 | 说明 |
|------|------|
| [peaktwilight/agent-undo](https://github.com/peaktwilight/agent-undo) | **上游原版** — 基础文件跟踪与回撤功能 |
| [sadjjk/agent-undo](https://github.com/sadjjk/agent-undo) | **增强 Fork** — 在原版基础上新增 `au revert`（diff 预览 + 确认回撤） |

> `au revert` 命令仅在 **sadjjk/agent-undo** 中支持。如需此功能，请从 [sadjjk/agent-undo](https://github.com/sadjjk/agent-undo) 安装。

## 🚀 使用

### 1️⃣ au CLI — 命令行

基础能力，独立于任何 Agent 框架：

| 命令 | 说明 |
|------|------|
| `au init --install-hooks` | 初始化项目 |
| `au serve --daemon` | 后台实时快照 |
| `au session start/end` | 会话管理 |
| `au hook pre/post` | 归因窗口 |
| `au log / blame / diff` | 查询 |
| `au oops` | 撤销最近一波 |
| `au revert` | 指定回撤（仅 sadjjk 版） |

详见 [au-cli命令-使用方法](docs/au-cli命令-使用方法.md)

### 2️⃣ OpenClaw Hook — 自动归因

在 OpenClaw 中启用 `agent-undo-hook` 插件，Agent 编辑文件时自动归因，无需手动执行 `au hook pre/post`：

- Agent 开始编辑前 → hook 自动调 `au hook pre`
- Agent 编辑结束 → hook 自动调 `au hook post`

亮点：

- **轮次级归因** — 一轮对话 = 一个 au session，该轮所有文件修改统一归因
- **自动识别项目** — 写入时自动定位项目根，未初始化项目启发式提醒
- **项目隔离** — 跨项目修改时独立开 session，互不干扰
- **渠道类型归因** — feishu / cron / subagent 等渠道自动写入 agent 字段

详见 [openclaw-hook-安装使用](docs/openclaw-hook-安装使用.md)

### 3️⃣ au-viewer Skill — 可视化查看与回滚

OpenClaw Skill，在浏览器中浏览项目文件变更时间线 + 一键回滚：

- **触发**：`au-viewer <项目路径>` 或 `au-viewer`
- **功能**：事件时间线、diff 查看、会话级/事件级回滚、文件 blame、全局快照




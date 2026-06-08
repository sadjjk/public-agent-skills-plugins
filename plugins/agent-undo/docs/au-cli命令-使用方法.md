# au-cli 命令 - 使用方法

## 📝 核心命令

**1. 初始化**

```bash
cd my-project
au init --install-hooks    # 初始化 + 自动归因
au serve --daemon          # 后台实时快照
```

**2. 会话启动**

```bash
au session start --agent <channel>   # 开始归因窗口
```

**3. 文件写入前归因**

```bash
au hook pre    # 标记接下来的文件写入属于当前会话
```

**4. 关闭归因窗口**

```bash
au hook post   # 结束归因，后续写入不再归属当前会话
```

**5. 关闭会话**

```bash
au session end --metadata '...'   # 写入会话元数据，关闭归因窗口
```

## 🔍 查询分析

| 命令 | 说明 |
|------|------|
| `/au log [N]` | 查看最近 N 条操作 |
| `/au blame <file>` | 文件行级归属 |
| `/au diff <event>` | 某次事件改动 |
| `/au sessions` | session 列表 |
| `/au status` | daemon 状态 |

## ⏪ 回撤恢复

| 命令 | 说明 |
|------|------|
| `/undo` | 撤销最近一波 Agent 编辑（= `au oops`） |
| `au oops` | 撤销最近一波操作 |
| `au revert` | 指定回撤到某个状态（见下方详细用法） |

### `au revert` 详细用法

> ⚠️ 此命令仅在 [sadjjk/agent-undo](https://github.com/sadjjk/agent-undo) 中支持，原版 [peaktwilight/agent-undo](https://github.com/peaktwilight/agent-undo) 不包含此功能。

```bash
# 按事件回撤
au revert --event [id]           # 不传 id → 最近 event

# 按会话回撤
au revert --session [id]         # 不传 id → 最近 session（不管是否结束）

# 按标签回撤
au revert --pin [label]          # 不传 label → 最近 pin
```

**参数说明**：

| 参数 | 说明 |
|------|------|
| `--event [id]` | 回撤到指定事件，不传 id 则回撤最近一条 |
| `--session [id]` | 回撤整个会话，不传 id 则回撤最近一个 |
| `--pin [label]` | 回撤到指定标签，不传 label 则回撤最近一个 |
| `--confirm` | 跳过交互确认（diff 始终展示） |
| `--json` | 输出 JSON 格式（用于前端/插件渲染） |

> ⚠️ `--event` / `--session` / `--pin` 三者互斥，必须指定其中一个

**与原命令的关系**：

| 原命令 | revert 等价 | 区别 |
|--------|-----------|------|
| `au restore 5` | `au revert --event 5` | revert 有 diff + 确认 |
| `au restore --session abc` | `au revert --session abc` | revert 有 diff + 确认 |
| `au unpin my-pin` | `au revert --pin my-pin` | revert 有 diff + 确认 |

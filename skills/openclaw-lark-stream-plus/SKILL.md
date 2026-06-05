---
name: openclaw-lark-stream-plus
description: |
  OpenClaw 飞书/Lark 插件流式增强配置。触发词：开启/关闭飞书流式输出、开启/关闭飞书流式跨插件通信
---

# OpenClaw Lark/Feishu 插件流式增强配置

---

## 功能 1：安装飞书插件

其他功能的前置依赖。未安装时，开启流式输出或跨插件通信会回退引导至此功能。

```bash
# 动态检测
OC_LARK_INSTALLED=$(openclaw plugins list 2>/dev/null | grep "openclaw-lark" | grep -c "enabled")
```

### 已安装

提示"飞书插件已安装"，无需操作。

### 未安装



建议用户参考文档：https://bytedance.larkoffice.com/docx/MFK7dDFLFoVlOGxWCv5cTXKmnMh
并自行使用以下命令安装

```bash
npx -y @larksuite/openclaw-lark install
```


---

## 功能 2：流式输出

包含单聊流式 + 群聊流式。支持开启和关闭。

```bash
# 动态检测
OC_LARK_DIR=$(eval echo "$(openclaw plugins inspect openclaw-lark 2>/dev/null | grep 'Install path:' | sed 's/Install path: *//')")
OC_LARK_STREAMING=$(grep -c "OC_LARK_PLUS:STREAMING:START" "$OC_LARK_DIR/src/card/reply-mode.js" 2>/dev/null)
```

### 开启

- 已开启（`OC_LARK_STREAMING=1`）→ 提示"流式输出已开启，无需重复操作"
- 未开启 → 检测 `OC_LARK_INSTALLED`，未安装则引导先执行功能 1
- 解析 `OC_LARK_DIR` 为实际路径，风险提示中的 `$OC_LARK_DIR` 替换为实际值展示
- 提示风险，**用户确认后**再执行：

> ⚠️ **风险提示**
> - 群聊流式更新频率可能触发飞书 API 限流
> - 多人同时对话时卡片更新可能互相干扰
>
> **将执行以下修改：**
> 1. `openclaw config set channels.feishu.streaming true`（单聊流式配置）
> 2. 修改 `{OC_LARK_DIR实际路径}/src/card/reply-mode.js` 的 `expandAutoMode` 函数：
>    - 原始：`return streaming === true ? (chatType === 'group' ? 'static' : 'streaming') : 'static';`
>    - 改为：`return streaming === true ? 'streaming' : 'static';`（用 `OC_LARK_PLUS:STREAMING` 标记包裹）
> 3. `openclaw gateway restart`
>
> 确认开启？

用户确认后执行：

**单聊流式**：

```bash
openclaw config set channels.feishu.streaming true
```

**群聊流式**（修改源码 + 标记包裹）：

文件：`$OC_LARK_DIR/src/card/reply-mode.js`

定位 `expandAutoMode` 函数，找到：

```javascript
return streaming === true ? (chatType === 'group' ? 'static' : 'streaming') : 'static';
```

替换为：

```javascript
// <!-- OC_LARK_PLUS:STREAMING:START -->
// ⚠️ 原始逻辑 group → static（硬编码降级），现已改为 group 也走 streaming。
return streaming === true ? 'streaming' : 'static';
// <!-- OC_LARK_PLUS:STREAMING:END -->
```

重启生效：

```bash
openclaw gateway restart
```

### 关闭

- 已关闭（`OC_LARK_STREAMING=0`）→ 提示"流式输出已关闭，无需重复操作"
- 已开启 → 解析 `OC_LARK_DIR` 为实际路径，风险提示中的 `$OC_LARK_DIR` 替换为实际值展示
- 提示影响，**用户确认后**再执行：

> ⚠️ **风险提示**
> - 将恢复群聊为 static 模式（非流式）
> - 单聊流式配置也将关闭
>
> **将执行以下修改：**
> 1. 删除 `{OC_LARK_DIR实际路径}/src/card/reply-mode.js` 中 `OC_LARK_PLUS:STREAMING:START/END` 之间的内容，恢复原始代码：
>    - 恢复为：`return streaming === true ? (chatType === 'group' ? 'static' : 'streaming') : 'static';`
> 2. `openclaw config set channels.feishu.streaming false`
> 3. `openclaw gateway restart`
>
> 确认关闭？

用户确认后执行：

1. 删除 `$OC_LARK_DIR/src/card/reply-mode.js` 中 `OC_LARK_PLUS:STREAMING:START` 与 `OC_LARK_PLUS:STREAMING:END` 之间的内容，恢复原始代码：
   ```javascript
   return streaming === true ? (chatType === 'group' ? 'static' : 'streaming') : 'static';
   ```
2. 关闭单聊流式配置：
   ```bash
   openclaw config set channels.feishu.streaming false
   ```
3. 重启：
   ```bash
   openclaw gateway restart
   ```

---

## 功能 3：流式跨插件通信

飞书流式卡片在 finalize 前会读取 `global.__ocCardAppend` 中对应 session 的文本，
追加到卡片内容中。其他插件只需往这个 Map 写入数据，即可将自定义内容注入飞书卡片。

支持开启和关闭。

```bash
# 动态检测
OC_LARK_DIR=$(eval echo "$(openclaw plugins inspect openclaw-lark 2>/dev/null | grep 'Install path:' | sed 's/Install path: *//')")
OC_LARK_CROSS_PLUGIN=$(grep -c "OC_LARK_PLUS:CROSS_PLUGIN:START" "$OC_LARK_DIR/src/card/streaming-card-controller.js" 2>/dev/null)
```

### 开启

- 已开启（`OC_LARK_CROSS_PLUGIN=1`）→ 提示"跨插件通信已开启，无需重复操作"
- 未开启 → 检测 `OC_LARK_INSTALLED`，未安装则引导先执行功能 1
- 解析 `OC_LARK_DIR` 为实际路径，风险提示中的 `$OC_LARK_DIR` 替换为实际值展示
- 提示说明，**用户确认后**再执行：

> ⚠️ **风险提示**
> - 其他插件可通过 `global.__ocCardAppend` 注入内容到飞书流式卡片终态
> - 注入内容会追加到卡片 displayText 末尾，以 `---` 分隔
>
> **将执行以下修改：**
> 1. 修改 `{OC_LARK_DIR实际路径}/src/card/streaming-card-controller.js`，在 `onIdle` 方法中：
>    - 将 `const displayText` 改为 `let displayText`
>    - 在 `if (!this.text.completedText && !this.text.accumulatedText) { ... }` 块之后、`const resolvedDisplayText = ...` 行之前，插入跨插件通信代码（用 `OC_LARK_PLUS:CROSS_PLUGIN` 标记包裹）
> 2. `openclaw gateway restart`
>
> **其他插件使用方式：**
> 推荐使用 `appendToMessage` 已封装的函数（飞书渠道自动追加到卡片，其他渠道写入 msg.content）。
>
> 确认开启？

用户确认后执行：

文件：`$OC_LARK_DIR/src/card/streaming-card-controller.js`

在 `onIdle` 方法中执行以下 **三步修改**（按顺序）：

**步骤 1**：将 `const displayText` 改为 `let displayText`（跨插件代码需要 `+=` 修改此变量）

定位：
```javascript
const displayText = this.text.completedText || (isNoReplyLeak ? '' : this.text.accumulatedText) || reply_dispatcher_types_1.EMPTY_REPLY_FALLBACK_TEXT;
```
替换为：
```javascript
let displayText = this.text.completedText || (isNoReplyLeak ? '' : this.text.accumulatedText) || reply_dispatcher_types_1.EMPTY_REPLY_FALLBACK_TEXT;
```

**步骤 2**：在 `if (!this.text.completedText && !this.text.accumulatedText) { ... }` 块之后、`const resolvedDisplayText = await this.imageResolver.resolveImagesAwait(displayText, ...)` 行之前，插入跨插件通信代码块（用标记包裹）

插入位置的特征锚点：
- 上方紧邻：`}` （`if` 块的闭合花括号）
- 下方紧邻：`const resolvedDisplayText = await this.imageResolver.resolveImagesAwait(displayText, 15_000);`

⚠️ **关键**：插入的代码是独立语句，必须位于两个完整语句之间，**绝不能**嵌在任何变量赋值表达式中间

插入内容：

```javascript
                // <!-- OC_LARK_PLUS:CROSS_PLUGIN:START -->
                // ── 跨插件通信：读取其他插件通过 global.__ocCardAppend 注入的文本 ──
                let _appendText = global.__ocCardAppend?.get?.(this.deps.sessionKey);
                if (!_appendText) {
                    if (!global.__ocCardAppendReady) global.__ocCardAppendReady = new Map();
                    let resolveReady;
                    const readyPromise = new Promise(r => { resolveReady = r; });
                    global.__ocCardAppendReady.set(this.deps.sessionKey, resolveReady);
                    const pollPromise = (async () => {
                        for (let i = 0; i < 50; i++) {
                            await new Promise(r => setTimeout(r, 100));
                            const v = global.__ocCardAppend?.get?.(this.deps.sessionKey);
                            if (v) return v;
                        }
                        return undefined;
                    })();
                    const raceResult = await Promise.race([
                        readyPromise.then(t => t ? "\n\n---\n\n" + t : undefined),
                        pollPromise,
                        new Promise(r => setTimeout(() => r(undefined), 5000))
                    ]);
                    _appendText = raceResult;
                    global.__ocCardAppendReady.delete(this.deps.sessionKey);
                }
                if (_appendText) {
                    displayText += _appendText;
                    global.__ocCardAppend.delete(this.deps.sessionKey);
                }
                // <!-- OC_LARK_PLUS:CROSS_PLUGIN:END -->
```

**步骤 3**：确认 `const resolvedDisplayText = await this.imageResolver.resolveImagesAwait(displayText, 15_000);` 保持不变（此行在步骤 2 插入的代码之后，此时 `displayText` 已包含跨插件追加内容）

重启生效：

```bash
openclaw gateway restart
```


#### appendToMessage 源码参考

```javascript
function appendToMessage(msg, text, sk) {
  const suffix = "\n\n---\n\n" + text;
  const isFeishuChannel = sk?.includes("feishu");
  if (isFeishuChannel) {
    if (!global.__ocCardAppend) global.__ocCardAppend = new Map();
    const existing = global.__ocCardAppend.get(sk) || "";
    global.__ocCardAppend.set(sk, existing + suffix);
    if (!global.__ocCardAppendReady) global.__ocCardAppendReady = new Map();
    const ready = global.__ocCardAppendReady.get(sk);
    if (ready) ready(text);
    return;
  }
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
```


### 关闭

- 已关闭（`OC_LARK_CROSS_PLUGIN=0`）→ 提示"跨插件通信已关闭，无需重复操作"
- 已开启 → 解析 `OC_LARK_DIR` 为实际路径，风险提示中的 `$OC_LARK_DIR` 替换为实际值展示
- 提示影响，**用户确认后**再执行：

> ⚠️ **风险提示**
> - 飞书卡片将不再读取其他插件注入的内容
>
> **将执行以下修改：**
> 1. 删除 `{OC_LARK_DIR实际路径}/src/card/streaming-card-controller.js` 中 `OC_LARK_PLUS:CROSS_PLUGIN:START/END` 之间的代码
> 2. 将 `let displayText` 恢复为 `const displayText`
> 3. 恢复 `onIdle` 方法中 `if (!this.text.completedText && !this.text.accumulatedText) { ... }` 块之后直接跟 `const resolvedDisplayText = await this.imageResolver.resolveImagesAwait(displayText, ...)` 的原始流程
> 4. `openclaw gateway restart`
>
> 确认关闭？

用户确认后执行：

1. 删除 `$OC_LARK_DIR/src/card/streaming-card-controller.js` 中 `OC_LARK_PLUS:CROSS_PLUGIN:START` 与 `OC_LARK_PLUS:CROSS_PLUGIN:END` 之间的代码
2. 将 `let displayText = ...` 恢复为 `const displayText = ...`（跨插件代码移除后变量不再被修改）
3. 确认 `const resolvedDisplayText = await this.imageResolver.resolveImagesAwait(displayText, 15_000);` 紧邻 `if (!this.text.completedText && !this.text.accumulatedText) { ... }` 块之后，中间无多余空行
4. 重启：
   ```bash
   openclaw gateway restart
   ```



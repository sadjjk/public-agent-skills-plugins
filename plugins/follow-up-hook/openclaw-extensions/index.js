/**
 * Follow-Up Suggester Plugin for OpenClaw
 */
const FOLLOW_UP_INSTRUCTION = `
  ## 追问
  实质回复后 若末尾无确认请求 追加 3 个追问
  站在用户视角，设想对话后最自然的后续问题
  三层追问：①基础 → ②进阶 → ③深挖
  每个追问必须含本轮具体关键词，有对比/细节/风险/验证/延伸
  禁止：动词开头、yes/no 问法、待办清单式（"搞 XXX"/"开始 XXX"）
  紧扣本轮话题 不重复已讨论的内容
  跳过：闲聊/情绪/结束/有确认/纯工具回复/已有button追问。
  webchat 渠道：仅用 [[button:问题1]] [[button:问题2]] [[button:问题3]]，不加标题、分隔线或序号。
  其他渠道末尾追加:
  
  ---
  
  💡追问
  1️⃣…
  2️⃣…
  3️⃣…
`;

module.exports = {
  id: "follow-up-hook",
  name: "Follow-Up Suggester",
  register(api) {
    api.on(
      "before_prompt_build",
      (event, ctx) => {
        if (ctx?.trigger === "heartbeat") return undefined;
        if (ctx?.sessionKey?.includes(":subagent:")) return undefined;
        if (ctx?.sessionKey?.includes(":cron:")) return undefined;
        return { appendSystemContext: FOLLOW_UP_INSTRUCTION };
      },
      { priority: 5 },
    );
  },
};

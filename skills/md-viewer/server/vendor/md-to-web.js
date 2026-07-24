#!/usr/bin/env node
/**
 * md-to-web.js — Markdown → 结构化 HTML 翻译脚本
 *
 * 用法：
 *   node md-to-web.js sample.md [--theme aurora-glass] [--output output.html]
 *
 * 流程：
 *   sample.md → parseMdTokens() → tokensToStructured() → buildFullHtml()
 */

const fs = typeof require !== 'undefined' ? require('fs') : null;
const path = typeof require !== 'undefined' ? require('path') : null;

// ── 参数解析 ──
const argv = typeof process !== 'undefined' ? process.argv.slice(2) : [];
const mdFile = argv.find(a => !a.startsWith('--'));
const themeArgIdx = argv.indexOf('--theme');
const theme = themeArgIdx >= 0 ? argv[themeArgIdx + 1] : 'aurora-glass';
const outputIdx = argv.indexOf('--output');
const outputFile = outputIdx >= 0 ? argv[outputIdx + 1] : null;

// 命令行入口代码移到末尾 require.main === module 守卫内，浏览器端不执行

// ══════════════════════════════════════════════════════
// Step 1: Markdown → Token 数组（零依赖简易 lexer）
// ══════════════════════════════════════════════════════

function parseMdTokens(md) {
  const tokens = [];
  const lines = md.split('\n');
  let i = 0;
  let inCodeBlock = false, codeContent = '', codeLang = '';
  let frontmatterLines = [];
  let inChatCollect = false;

  while (i < lines.length) {
    const line = lines[i];

    // frontmatter
    if (i === 0 && line.trim() === '---') {
      i++;
      while (i < lines.length && lines[i].trim() !== '---') { frontmatterLines.push(lines[i]); i++; }
      i++;
      const meta = {};
      frontmatterLines.forEach(fl => {
        const m = fl.match(/^(\w[\w-]*):\s*(.*)$/);
        if (m) {
          let val = m[2].trim();
          if (val.startsWith('[') && val.endsWith(']')) {
            val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
          } else {
            val = val.replace(/^["']|["']$/g, '');
          }
          meta[m[1]] = val;
        }
      });
      tokens.push({ type: 'frontmatter', meta });
      continue;
    }

    // 代码块
    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) { inCodeBlock = true; codeLang = line.trimStart().slice(3).trim(); codeContent = ''; i++; continue; }
      else { inCodeBlock = false; tokens.push({ type: 'code', lang: codeLang, text: codeContent }); i++; continue; }
    }
    if (inCodeBlock) { codeContent += (codeContent ? '\n' : '') + line; i++; continue; }

    // heading
    const hm = line.match(/^(#{1,6})\s+(.+)/);
    if (hm) { tokens.push({ type: 'heading', depth: hm[1].length, text: hm[2].trim() }); i++; continue; }

    // blockquote — 连续收集多个
    if (line.startsWith('>')) {
      const ql = [];
      while (i < lines.length && lines[i].startsWith('>')) { ql.push(lines[i].replace(/^>\s?/, '')); i++; }
      tokens.push({ type: 'blockquote', text: ql.join('\n') });
      continue;
    }

    // hr（不在 chat-message 收集模式内时才触发）
    if (!inChatCollect && /^---+\s*$/.test(line.trim()) && line.trim().length >= 3) { tokens.push({ type: 'hr' }); i++; continue; }

    // 图片独立行 — 解析成 image token
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (imgMatch) { tokens.push({ type: 'image', alt: imgMatch[1], url: imgMatch[2] }); i++; continue; }

    // chat-message 检测：- U [HH:MM]: 或 - A [HH:MM]:
    const chatMatch = line.match(/^[-*]\s+([UA])\s+\[(\d{2}:\d{2})\]:\s*(.*)/);
    if (chatMatch) {
      const role = chatMatch[1];
      const time = chatMatch[2];
      const firstLine = chatMatch[3];
      const textParts = firstLine ? [firstLine] : [];
      const chatIndent = line.length - line.trimStart().length;
      i++;
      inChatCollect = true;
      // 收集后续行：缩更深的内容行、空行（跳过但继续看后面），直到下一个 chat-message 或非缩进行
      while (i < lines.length) {
        const cl = lines[i];
        // 下一个 chat-message → 停止
        if (/^[-*]\s+[UA]\s+\[\d{2}:\d{2}\]:/.test(cl)) break;
        // 空行 → 跳过，但继续看后面是否有缩进行
        if (cl.trim() === '') { i++; continue; }
        const clIndent = cl.length - cl.trimStart().length;
        // 缩进行（比 chat-message 行缩进更深或 >= 2 空格）→ 收集
        if (clIndent > chatIndent || clIndent >= 2) {
          textParts.push(cl.trim());
          i++;
        } else {
          // 同级或更少缩进的非空行 → 停止
          break;
        }
      }
      inChatCollect = false;
      tokens.push({ type: 'chat-message', role, time, text: textParts.join('\n') });
      continue;
    }

    // 无序列表（含任务列表、嵌套子项）
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const indent = lines[i].length - lines[i].trimStart().length;
        const raw = lines[i].trimStart().replace(/^[-*]\s+/, '');
        // 任务列表
        const taskMatch = raw.match(/^\[([x ]?)\]\s+(.*)/i);
        const item = taskMatch
          ? { text: taskMatch[2], checked: taskMatch[1].toLowerCase() === 'x', indent }
          : { text: raw, indent };
        // 收集子项（更深缩进的连续 - 或非列表行作为子内容）
        i++;
        const children = [];
        while (i < lines.length) {
          const subLine = lines[i];
          const subIndent = subLine.length - subLine.trimStart().length;
          if (subLine.trim() === '') { i++; continue; }
          if (subIndent > indent && /^\s*[-*]\s+/.test(subLine)) {
            children.push(subLine.trimStart().replace(/^[-*]\s+/, ''));
            i++;
          } else break;
        }
        if (children.length > 0) item.children = children;
        items.push(item);
      }
      tokens.push({ type: 'list', ordered: false, items });
      continue;
    }

    // 有序列表
    if (/^\d+\.\s+/.test(line.trimStart())) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trimStart())) { items.push(lines[i].trimStart().replace(/^\d+\.\s+/, '')); i++; }
      tokens.push({ type: 'list', ordered: true, items });
      continue;
    }

    // table
    if (line.includes('|') && i + 1 < lines.length && /^\|?\s*[-:]+/.test(lines[i + 1])) {
      const headers = line.split('|').map(s => s.trim()).filter(Boolean);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|')) { rows.push(lines[i].split('|').map(s => s.trim()).filter(Boolean)); i++; }
      tokens.push({ type: 'table', headers, rows });
      continue;
    }

    // 空行
    if (line.trim() === '') { i++; continue; }

    // HTML 注释：标记性注释 → comment-marker token；SCAN 边界 → scan-boundary
    if (/^<!--/.test(line.trim())) {
      // SCAN:START / SCAN:END — 边界标记 token，保留原文
      const scanMatch = line.match(/<!--\s*SCAN:(START|END)(.*?)-->/);
      if (scanMatch) {
        const raw = line.trim().replace(/^<!--/, '').replace(/-->$/, '').trim();
        tokens.push({ type: 'scan-boundary', boundary: scanMatch[1].toLowerCase(), raw });
        if (/-->$/.test(line.trim())) { i++; continue; }
        i++; while (i < lines.length && !/-->$/.test(lines[i].trim())) i++; i++; continue;
      }
      // 标记性注释（HOURLY:END 等）→ comment-marker token
      const markerMatch = line.match(/<!--\s*(\w+:\w+|END|START)\s*-->/);
      if (markerMatch) {
        tokens.push({ type: 'comment-marker', text: markerMatch[1] });
        i++; continue;
      }
      // <!--more--> 标记 → more-marker token（用于提取摘要）
      if (/^<!--\s*more\s*-->$/i.test(line.trim())) {
        tokens.push({ type: 'more-marker' });
        i++; continue;
      }
      // 普通注释跳过
      if (/-->$/.test(line.trim())) { i++; continue; }
      i++; while (i < lines.length && !/-->$/.test(lines[i].trim())) i++; i++; continue;
    }
    // 普通段落（可能含内联图片）
    // 统计行单独收集：首行 emoji+空格+**加粗** 才触发，后续连续 emoji 行一并收集
    if (/^\p{Extended_Pictographic}\s+\*\*/u.test(line.trim())) {
      while (i < lines.length && /^\p{Extended_Pictographic}/u.test(lines[i].trim())) {
        tokens.push({ type: 'stat-line', text: lines[i].trim() });
        i++;
      }
      continue;
    }
    const pl = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('>') && !lines[i].startsWith('```') && !/^[-*]\s+/.test(lines[i].trimStart()) && !/^\d+\.\s+/.test(lines[i].trimStart()) && !/^---+\s*$/.test(lines[i].trim()) && !/^<!--.*-->$/.test(lines[i].trim()) && !/^<!--/.test(lines[i].trim()) && !/^!\[[^\]]*\]\([^)]+\)\s*$/.test(lines[i].trim())) {
      pl.push(lines[i]); i++;
    }
    if (pl.length > 0) {
      tokens.push({ type: 'paragraph', text: pl.join('\n') });
    }
  }
  return tokens;
}

// ══════════════════════════════════════════════════════
// Step 2: Token → 结构化 JSON（规则映射）
// ══════════════════════════════════════════════════════

function tokensToStructured(tokens) {
  const hero = { title: '', subtitle: '', kicker: '', panelTitle: '核心看点', heroBullets: [], meta: {} };
  const sections = [];
  let cur = null;
  let isFirstH1 = true;
  let pendingScanLabel = null;

  // 最小 heading depth 决定 section 标题层级：有 H1/H2 时用其层级，否则至少 H3
  const minDepth = Math.min(...tokens.filter(t => t.type === 'heading').map(t => t.depth));
  const sectionDepth = minDepth <= 2 ? minDepth : 3;  // H1/H2 做 section；无 H1/H2 时 H3 做最末 section

  for (let idx = 0; idx < tokens.length; idx++) {
    const t = tokens[idx];

    // frontmatter
    if (t.type === 'frontmatter') {
      hero.meta = t.meta;
      if (t.meta.title) hero.title = t.meta.title;
      if (t.meta.tags) hero.kicker = Array.isArray(t.meta.tags) ? t.meta.tags.join(' · ') : t.meta.tags;
      if (t.meta.date) hero.metaDate = t.meta.date;
      else if (t.meta.created) hero.metaDate = t.meta.created;
      else if (t.meta.updated) hero.metaDate = t.meta.updated;
      if (t.meta.tags) delete hero.meta.tags;
      continue;
    }

    // <!--more--> 标记：从当前 section 中取出之前的段落作为 hero.subtitle
    if (t.type === 'more-marker') {
      if (!hero.subtitle && cur && cur.blocks.length > 0) {
        const paraBlocks = [];
        while (cur.blocks.length > 0 && cur.blocks[cur.blocks.length - 1].kind === 'paragraph') {
          paraBlocks.unshift(cur.blocks.pop());
        }
        if (paraBlocks.length > 0) {
          hero.subtitle = paraBlocks.map(b => b.text).join('\n');
        }
      }
      continue;
    }

    // scan-boundary: START/END 都生成 comment-marker block；END 额外关闭当前 section
    if (t.type === 'scan-boundary') {
      const label = t.raw || (t.boundary === 'start' ? 'SCAN:START' : 'SCAN:END');
      if (cur) cur.blocks.push({ kind: 'comment-marker', text: label });
      else if (t.boundary === 'start') pendingScanLabel = label; // cur 为 null 时缓存，等 chat-message 创建 section 后补
      if (t.boundary === 'end' && cur) { cur = null; }
      continue;
    }

    // chat-message: 需要有 section 归属（规则 1 · 兜底）
    if (t.type === 'chat-message') {
      // 没有 cur → 创建带编号的兜底 section
      if (!cur) {
        const logCount = sections.filter(s => s.type === 'chat-log').length;
        const seq = logCount + 1;
        cur = { type: 'chat-log', anchor: `session-log-${seq}`, title: `对话记录 ${String(seq).padStart(2, '0')}`, titleDepth: 2, intro: '', blocks: [], quotes: [], images: [] };
        if (pendingScanLabel) { cur.blocks.push({ kind: 'comment-marker', text: pendingScanLabel }); pendingScanLabel = null; }
        sections.push(cur);
      }
      // 规则 3 泛化: 按 --- 分段
      const parts = t.text.split('\n---\n');
      let body = parts[0].trim();
      const meta = parts.length > 1 ? parts.slice(1).join('\n').trim() : null;

      // 规则 7: 工具调用标记 → [type: content]
      const toolCalls = [];
      const toolRe = /→ \[([\w-]+(?:__\w+)?)\s*:\s*([^\]]+)\]/g;
      body = body.replace(toolRe, (_, type, content) => {
        // 简化 type 名称
        const shortType = type.replace(/^context-mode__/, 'ctx_').replace(/^feishu_/, 'feishu_');
        toolCalls.push({ type: shortType, content: content.trim() });
        return '';  // 从 body 中移除
      });
      body = body.trim();

      // 规则 8: button 交互 [[button:...]]
      const buttons = []
      const btnRe = /\[\[button:([^\]]+)\]\]/g;
      body = body.replace(btnRe, (_, label) => {
        buttons.push({ label: label.trim() });
        return '';
      });
      body = body.trim();

      // 规则 9: meta 统计行按行拆分
      let metaLines = null;
      if (meta) {
        metaLines = meta.split('\n').filter(l => l.trim()).map(l => l.trim());
      }

      cur.blocks.push({ kind: 'chat-message', role: t.role, time: t.time, body, meta: metaLines, toolCalls, buttons });
      continue;
    }

    // H1: 第一个 -> hero, 后续 -> 新 section
    if (t.type === 'heading' && t.depth === 1) {
      if (isFirstH1) {
        hero.title = hero.title || t.text;
        const next = tokens[idx + 1];
        // subtitle 只吞：1) 引用块(>)  2) 短描述段落(≤3行、不含 **Key:** Value 连续行、不含代码块)
        if (next && next.type === 'blockquote') {
          hero.subtitle = next.text;
          idx++;
        } else if (next && next.type === 'paragraph') {
          const lines = next.text.split('\n').filter(l => l.trim());
          const isKeyValue = lines.length >= 2 && lines.every(l => /^\*\*[^*]+[:：]\*\*/.test(l.trim()));
          const hasCode = next.text.includes('```');
          const isShortDesc = lines.length <= 3 && !hasCode;
          if (!isKeyValue && isShortDesc) {
            hero.subtitle = next.text;
            idx++;
          }
        }
        isFirstH1 = false;
      } else {
        cur = { type: 'text', anchor: slugify(t.text), title: t.text, titleDepth: 1, intro: '', blocks: [], quotes: [], images: [] };
        const next = tokens[idx + 1];
        if (next && next.type === 'paragraph') { cur.intro = next.text; idx++; }
        cur.type = detectSectionType(tokens, idx + 1, t.text);
        sections.push(cur);
      }
      continue;
    }

    // Hr -> section 分隔（结束当前 section）
    if (t.type === 'hr') { cur = null; continue; }

    // 统一兜底：cur=null 时遇到内容 token，创建无标题 section
    if (!cur && !['heading', 'hr', 'frontmatter', 'scan-boundary', 'chat-message'].includes(t.type)) {
      const logCount = sections.filter(s => s.type === 'text' || s.type === 'chat-log').length;
      const seq = logCount + 1;
      cur = { type: 'text', anchor: `content-${seq}`, title: '', titleDepth: 2, intro: '', blocks: [], quotes: [], images: [] };
      sections.push(cur);
    }

    // H2 -> 新 section
    if (t.type === 'heading' && t.depth === 2) {
      cur = { type: 'text', anchor: slugify(t.text), title: t.text, intro: '', blocks: [], quotes: [], images: [] };
      // 不吞首段作 intro，让所有内容平等进入 blocks
      cur.type = detectSectionType(tokens, idx + 1, t.text);
      sections.push(cur);
      continue;
    }

    // H3+ (或无 H1/H2/H3 时的 H4+): 无 cur 或同级标题 → 新 section；有 cur 且更深层级 → 子项
    if (t.type === 'heading' && t.depth >= sectionDepth) {
      if (!cur || !cur.title || t.depth <= cur.titleDepth || t.depth <= sectionDepth) {
        // 同级或更高级 → 关闭旧 section，创建新 section
        // 从标题提取时间徽章（如 "08:56~17:22 - 项目名"）
        const tbMatch = t.text.match(/^(\d{2}:\d{2})~(\d{2}:\d{2})\s*[-–]\s*(.+)$/);
        const timeBadge = tbMatch ? { start: tbMatch[1], end: tbMatch[2] } : null;
        const titleText = tbMatch ? tbMatch[3] : t.text;
        cur = { type: 'text', anchor: slugify(t.text), title: t.text, titleText, timeBadge, titleDepth: t.depth, intro: '', blocks: [], quotes: [], images: [] };
        // H3+ 不吞首段作 intro（避免吃掉 **Label**: value 段落），只有 H1/H2 才需要
        cur.type = detectSectionType(tokens, idx + 1, t.text);
        sections.push(cur);
        continue;
      }
      // 有 cur 时作为子项
      cur.blocks.push({ kind: 'subheading', text: t.text, depth: t.depth });
      const next = tokens[idx + 1];
      if (next && next.type === 'paragraph') {
        // 检测 label-value 模式
        const lvLines = next.text.split('\n');
        const lvPattern = /^\*\*([^*]+)\*\*\s*[：:]\s*(.*)/;
        const isLabelValue = lvLines.every(l => l.trim() === '' || lvPattern.test(l.trim()));
        if (isLabelValue && lvLines.filter(l => l.trim()).length >= 1) {
          const allPairs = lvLines.filter(l => l.trim()).map(l => {
            const m = l.trim().match(lvPattern);
            return { label: m[1].trim(), value: m[2].trim() };
          });
          cur.blocks.push({ kind: 'label-values', pairs: allPairs });
        } else {
          cur.blocks.push({ kind: 'paragraph', text: next.text });
        }
        idx++;
      }
      else if (next && next.type === 'table') { cur.blocks.push({ kind: 'table', headers: next.headers, rows: next.rows }); idx++; }
      continue;
    }

    // 无序列表（含任务列表、嵌套子项）
    if (t.type === 'list' && !t.ordered && cur) {
      const items = t.items.map(item => {
        const text = typeof item === 'string' ? item : item.text;
        const result = {};
        if (typeof item === 'object' && item.checked !== undefined) {
          result.isTask = true;
          result.checked = item.checked;
        }
        if (typeof item === 'object' && item.indent) result.indent = item.indent;
        // 加粗标题
        const cm = text.match(/^\*\*(.+?)\*\*\s*(.*)/);
        // emoji 前缀
        const emojiMatch = text.match(/^(\p{Extended_Pictographic}+)\s*(.*)/u);
        // 冒号前缀 (至少2个中英文字符)
        const colonMatch = text.match(/^([\u4e00-\u9fa5a-zA-Z]{2,}[：:])\s*(.*)/);
        if (cm) { result.title = cm[1]; result.body = cm[2]; }
        else if (emojiMatch) { result.title = emojiMatch[1]; result.body = emojiMatch[2]; }
        else if (colonMatch) { result.title = colonMatch[1].replace(/[：:]$/, ''); result.body = colonMatch[2]; }
        else { result.title = ''; result.body = text; }
        if (item.children) result.children = item.children;
        return result;
      });
      // 检测工具列表（name×N）
      const toolPattern = /^(.+?)×(\d+)$/;
      const isToolList = items.every(it => {
        const text = it.body || it.title || '';
        return toolPattern.test(text.trim());
      });
      // 检测文件列表（[dir]/[file]/[val] 前缀）
      const filePattern = /^\[(dir|file|val)\]\s*(.*)/i;
      const isFileList = items.every(it => {
        const text = it.body || it.title || '';
        return filePattern.test(text.trim());
      });
      if (isToolList) {
        const tools = items.map(it => {
          const text = (it.body || it.title || '').trim();
          const m = text.match(toolPattern);
          return { name: m[1].trim(), count: parseInt(m[2]) };
        });
        cur.blocks.push({ kind: 'tool-list', tools });
      } else if (isFileList) {
        const files = items.map(it => {
          const text = (it.body || it.title || '').trim();
          const m = text.match(filePattern);
          return { fileType: m[1].toLowerCase(), path: m[2].trim(), children: it.children };
        });
        cur.blocks.push({ kind: 'file-list', files });
      } else {
        cur.blocks.push({ kind: 'list', ordered: false, items });
      }
      continue;
    }

    // 有序列表
    if (t.type === 'list' && t.ordered && cur) {
      const items = t.items.map(item => {
        const sm = item.match(/^(.+?)\s*[—–-]\s*(.*)/);
        const colon = item.match(/^([\u4e00-\u9fa5a-zA-Z]{2,}[：:])\s*(.*)/);
        const period = item.match(/^(.+?[。.])\s*(.*)/);
        if (sm) return { title: sm[1], body: sm[2] };
        if (colon) return { title: colon[1].replace(/[：:]$/, ''), body: colon[2] };
        if (period) return { title: period[1], body: period[2] };
        return { title: item, body: '' };
      });
      cur.blocks.push({ kind: 'list', ordered: true, items });
      continue;
    }

    // blockquote -> 收集到 quotes[]
    if (t.type === 'blockquote' && cur) {
      cur.quotes.push(t.text);
      continue;
    }

    // image -> 分配到当前 section
    if (t.type === 'image' && cur) {
      cur.images.push({ alt: t.alt, url: t.url });
      continue;
    }

    // code -> 追加到 blocks
    if (t.type === 'code' && cur) {
      cur.blocks.push({ kind: 'code', lang: t.lang, text: t.text });
      continue;
    }

    // table -> 追加到 blocks
    if (t.type === 'table' && cur) {
      cur.blocks.push({ kind: 'table', headers: t.headers, rows: t.rows });
      continue;
    }

    // stat-line -> blocks
    if (t.type === 'stat-line' && cur) {
      cur.blocks.push({ kind: 'stat-line', text: t.text });
      continue;
    }

    // comment-marker -> blocks
    if (t.type === 'comment-marker' && cur) {
      cur.blocks.push({ kind: 'comment-marker', text: t.text });
      continue;
    }

    // paragraph -> blocks 或 FAQ
    if (t.type === 'paragraph' && cur) {
      if (isFaqSection(cur.title) && (t.text.endsWith('？') || t.text.endsWith('?'))) {
        // FAQ: 持续收集答案
        let answerParts = [];
        let j = idx + 1;
        while (j < tokens.length && tokens[j].type === 'paragraph' && !tokens[j].text.endsWith('？') && !tokens[j].text.endsWith('?')) {
          answerParts.push(tokens[j].text);
          j++;
        }
        // 也收集 list/table 作为答案
        if (answerParts.length === 0 && tokens[idx + 1] && (tokens[idx + 1].type === 'list' || tokens[idx + 1].type === 'table')) {
          const nextT = tokens[idx + 1];
          if (nextT.type === 'list') {
            answerParts.push(nextT.items.map(it => typeof it === 'string' ? '- ' + it : '- ' + it.text).join('\n'));
          } else if (nextT.type === 'table') {
            answerParts.push('| ' + nextT.headers.join(' | ') + ' |\n| ' + nextT.headers.map(() => '---').join(' | ') + ' |\n' + nextT.rows.map(r => '| ' + r.join(' | ') + ' |').join('\n'));
          }
          idx++;
        }
        cur.blocks.push({ kind: 'faq', question: t.text, answer: answerParts.join('\n\n') });
        idx = j - 1;
        continue;
      }
      // 检测 label-value 模式（**Label**: value 单换行连续行）
      const lvLines = t.text.split('\n');
      const lvPattern = /^\*\*([^*]+)\*\*\s*[：:]\s*(.*)/;
      const isLabelValue = lvLines.every(l => l.trim() === '' || lvPattern.test(l.trim()));
      if (isLabelValue && lvLines.filter(l => l.trim()).length >= 1) {
        const allPairs = lvLines.filter(l => l.trim()).map(l => {
          const m = l.trim().match(lvPattern);
          const rawValue = m[2].trim();
          const sm = rawValue.match(/^(\p{Extended_Pictographic}+)\s*(.*)/u);
          if (sm) return { label: m[1].trim(), value: sm[2].trim(), status: sm[1] };
          return { label: m[1].trim(), value: rawValue };
        });
        // value 为空的 label 拆成独立 section-subhead block，不包在 meta-grid 里
        // 这样后面的列表/工具网格能紧跟，不会被 meta-grid 容器隔断
        const groups = [];
        let curPairs = [];
        for (const p of allPairs) {
          if (!p.value && !p.status) {
            if (curPairs.length > 0) { groups.push({ kind: 'pairs', pairs: curPairs }); curPairs = []; }
            groups.push({ kind: 'subhead', label: p.label });
          } else {
            curPairs.push(p);
          }
        }
        if (curPairs.length > 0) groups.push({ kind: 'pairs', pairs: curPairs });
        for (const g of groups) {
          if (g.kind === 'pairs') cur.blocks.push({ kind: 'label-values', pairs: g.pairs });
          else cur.blocks.push({ kind: 'section-subhead', text: g.label });
        }
      } else {
        cur.blocks.push({ kind: 'paragraph', text: t.text });
      }
    }
  }

  // 过滤空 section（有内容保留，无标题且无内容的丢弃）
  const filtered = sections.filter(s => s.blocks.length > 0 || s.quotes.length > 0 || s.images.length > 0 || s.intro);
  if (hero.heroBullets.length === 0 && filtered.length > 0) {
    // 只保留最高一级 section 标题进导航（titleDepth 最小的那级）
    const titledSections = filtered.filter(s => s.title);
    const minDepth = titledSections.reduce((min, s) => Math.min(min, s.titleDepth || 2), 99);
    hero.heroBullets = titledSections.filter(s => (s.titleDepth || 2) === minDepth).map(s => s.title);
    // 标记最高级 section
    filtered.forEach(s => { s.isTopLevel = s.title && (s.titleDepth || 2) === minDepth; });
  }
  return { hero, sections: filtered };
}

function detectSectionType(tokens, startIdx, sectionTitle) {
  // 扫描前方 20 个 token，统计各类型数量
  const ahead = [];
  for (let i = startIdx; i < Math.min(startIdx + 20, tokens.length); i++) {
    const t = tokens[i];
    if (t.type === 'heading' || t.type === 'hr' || t.type === 'scan-boundary') break;
    ahead.push(t);
  }

  if (isFaqSection(sectionTitle)) return 'faq';

  let listCount = 0, paraCount = 0, quoteCount = 0, tableCount = 0, imageCount = 0, chatCount = 0;
  let orderedList = false, unorderedList = false;

  for (const t of ahead) {
    if (t.type === 'list') {
      listCount++;
      if (t.ordered) orderedList = true; else unorderedList = true;
    }
    else if (t.type === 'paragraph') paraCount++;
    else if (t.type === 'blockquote') quoteCount++;
    else if (t.type === 'table') tableCount++;
    else if (t.type === 'image') imageCount++;
    else if (t.type === 'chat-message') chatCount++;
  }

  // chat-message 占比 > 50% → chat-log
  const total = ahead.length;
  if (total > 0 && chatCount / total > 0.5) return 'chat-log';

  // 交错段落+列表 → mixed（保留原始顺序用通用渲染器）
  if (listCount >= 2 && paraCount >= 1) return 'mixed';
  if (listCount >= 1 && paraCount >= 2) return 'mixed';

  if (quoteCount > 0 || imageCount > 0) return 'split';
  if (orderedList && !unorderedList && paraCount === 0) return 'steps';
  // 含 task 列表（- [ ]）的不用 cards 布局，走 text 保持正常渲染
  const hasTaskList = ahead.some(t => t.type === 'list' && t.items && t.items.some(it => it.checked !== undefined));
  if (unorderedList && paraCount === 0 && !hasTaskList) return 'cards';
  if (tableCount > 0 && listCount === 0) return 'table';

  // 兜底：纯文本或混合内容都用通用渲染器
  return 'text';
}

function isFaqSection(title) { return /faq|问答|常见问题|疑问/i.test(title); }
function slugify(text) { return 'sec-' + text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/(^-|-$)/g, ''); }

// ══════════════════════════════════════════════════════
// Step 3: JSON → HTML（模板渲染）
// ══════════════════════════════════════════════════════

function wrapEmoji(text) {
  return String(text).replace(/([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}])/gu, '<span class="emoji">$1</span>');
}

function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function renderInline(text) {
  // 先提取反引号代码，转义内部 HTML，用占位符保护
  const codes = [];
  let result = String(text).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(escapeHtml(code));
    return `%%INLINECODE_${codes.length - 1}%%`;
  });
  result = escapeHtml(result)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, src) => {
      // 相对路径重写：通过 /api/image 代理
      if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:') && !src.startsWith('/api/')) {
        let absPath;
        if (src.startsWith('/')) absPath = src;
        else if (typeof currentDir !== 'undefined' && currentDir) absPath = currentDir + '/' + src.replace(/^\.\//, '');
        else absPath = src;
        src = '/api/image?path=' + encodeURIComponent(absPath);
      }
      return '<img src="' + src + '" alt="' + alt + '" loading="lazy" style="max-width:100%;border-radius:8px;vertical-align:middle">';
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\[\[(?!button:)([^\]]+)\]\]/g, '<a href="#$1">$1</a>');
  result = result.replace(/%%INLINECODE_(\d+)%%/g, (_, idx) => `<code>${codes[parseInt(idx)]}</code>`);
  return result;
}

function renderBlocks(text) {
  if (!text) return '';
  // 先提取代码块，用占位符保护
  const codeBlocks = [];
  let processed = String(text).replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang, code: code.replace(/\n$/, '') });
    return `\n%%CODEBLOCK_${idx}%%\n`;
  });
  // 提取 $$...$$ 块级公式，用占位符保护（防止 <br> 破坏 KaTeX 定界符）
  const mathBlocks = [];
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    const idx = mathBlocks.length;
    mathBlocks.push(math);
    return `\n%%MATHBLOCK_${idx}%%\n`;
  });
  // 按双换行分段
  const result = processed.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => {
    const codeMatch = p.match(/^%%CODEBLOCK_(\d+)%%$/);
    if (codeMatch) {
      const cb = codeBlocks[parseInt(codeMatch[1])];
      return renderCodeBlock(cb.lang, cb.code);
    }
    const mathMatch = p.match(/^%%MATHBLOCK_(\d+)%%$/);
    if (mathMatch) {
      const math = mathBlocks[parseInt(mathMatch[1])];
      return `<div class="math-block">$$${math}$$</div>`;
    }
    if (p.includes('%%MATHBLOCK_')) {
      let restored = p.replace(/%%MATHBLOCK_(\d+)%%/g, (_, idx) => `$$${mathBlocks[parseInt(idx)]}$$`);
      return `<p>${renderInline(restored).replace(/\n/g, '<br>')}</p>`;
    }
    if (p.startsWith('|') && p.split('\n').length >= 2) return renderTable(p);
    // 连续 **Key:** Value 行 → meta-grid 定义列表
    if (isKeyValueBlock(p)) return renderKeyValueBlock(p);
    // 包含 HTML 块级标签的段落不做换行转 <br>
    if (/^\s*<(table|div|section|ul|ol|nav|article|aside|figure|figcaption|blockquote)\b/i.test(p)) return `<div>${renderInline(p)}</div>`;
    return `<p>${renderInline(p).replace(/\n/g, '<br>')}</p>`;
  }).join('');
  return result;
}

// 检测是否为连续 **Key:** Value 行（至少2行，冒号在加粗内）
function isKeyValueBlock(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return false;
  return lines.every(l => /^\*\*([^*]+[:：])\*\*\s*(.*)/.test(l.trim()));
}

// 渲染 **Key:** Value 行为 meta-grid 定义列表
function renderKeyValueBlock(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const rows = lines.map(l => {
    const m = l.trim().match(/^\*\*([^*]+[:：])\*\*\s*(.*)/);
    if (m) { const label = m[1].replace(/[:：]$/, ''); return `<div class="meta-row"><span class="meta-label">${renderInline(label.trim())}</span><span class="meta-value">${renderInline(m[2].trim())}</span></div>`; }
    return `<div class="meta-row"><span class="meta-value">${renderInline(l.trim())}</span></div>`;
  }).join('');
  return `<div class="meta-grid">${rows}</div>`;
}

// 代码块渲染：逐行 span + 复制按钮
function renderCodeBlock(lang, code) {
  var lines = code.split('\n');
  var numbered = lines.map(function(l) {
    return '<span class="code-line">' + escapeHtml(l) + '</span>';
  }).join('');
  return `<div class="code-block"><div class="code-header"><span class="code-lang">${escapeHtml(lang || '')}</span><button class="code-copy-btn" type="button">复制</button></div><pre><code class="language-${lang || ''}">${numbered}</code></pre></div>`;
}

// 增强内联渲染：在 renderInline 基础上识别 → [type: content] 工具调用和 [[button:xxx]] 按钮
function renderInlineEnhanced(text) {
  if (!text) return '';
  let result = renderInline(text);
  // 工具调用 → [type: content]
  result = result.replace(/→ \[([\w-]+)(?:__\w+)?\s*:\s*([^\]]+)\]/g, (_, type, content) => {
    const shortType = type.replace(/^context-mode__/, 'ctx_').replace(/^feishu_/, 'feishu_');
    const icon = shortType.startsWith('ctx_') ? '🌐' : shortType === 'exec' ? '⚙' : shortType === 'edit' ? '✏️' : shortType === 'read' ? '📖' : shortType === 'skill' ? '📦' : '🔧';
    return `<span class="tool-ref">${icon} ${escapeHtml(shortType)}: ${escapeHtml(content.trim())}</span>`;
  });
  // 按钮 [[button:xxx]]
  result = result.replace(/\[\[button:([^\]]+)\]\]/g, (_, label) => {
    return `<span class="btn-ref">${escapeHtml(label.trim())}</span>`;
  });
  return result;
}

// 增强段落渲染：renderBlocks + renderInlineEnhanced
function renderBlocksEnhanced(text) {
  if (!text) return '';
  const codeBlocks = [];
  let processed = String(text).replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang, code: code.replace(/\n$/, '') });
    return `\n%%CODEBLOCK_${idx}%%\n`;
  });
  // 提取 $$...$$ 块级公式
  const mathBlocks = [];
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    const idx = mathBlocks.length;
    mathBlocks.push(math);
    return `\n%%MATHBLOCK_${idx}%%\n`;
  });
  const result = processed.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => {
    const codeMatch = p.match(/^%%CODEBLOCK_(\d+)%%$/);
    if (codeMatch) {
      const cb = codeBlocks[parseInt(codeMatch[1])];
      return renderCodeBlock(cb.lang, cb.code);
    }
    const mathMatch = p.match(/^%%MATHBLOCK_(\d+)%%$/);
    if (mathMatch) {
      const math = mathBlocks[parseInt(mathMatch[1])];
      return `<div class="math-block">$$${math}$$</div>`;
    }
    if (p.includes('%%MATHBLOCK_')) {
      let restored = p.replace(/%%MATHBLOCK_(\d+)%%/g, (_, idx) => `$$${mathBlocks[parseInt(idx)]}$$`);
      return `<p>${renderInlineEnhanced(restored).replace(/\n/g, '<br>')}</p>`;
    }
    if (p.startsWith('|') && p.split('\n').length >= 2) return renderTable(p);
    if (isKeyValueBlock(p)) return renderKeyValueBlock(p);
    return `<p>${renderInlineEnhanced(p).replace(/\n/g, '<br>')}</p>`;
  }).join('');
  return result;
}

function renderTable(md) {
  const lines = md.split('\n').filter(l => l.trim() && !l.match(/^\|?\s*[-:]+/));
  if (!lines.length) return '';
  const headers = lines[0].split('|').map(s => s.trim()).filter(Boolean);
  const rows = lines.slice(1).map(l => l.split('|').map(s => s.trim()).filter(Boolean));
  let h = '<table><thead><tr>' + headers.map(x => `<th>${renderInline(x)}</th>`).join('') + '</tr></thead><tbody>';
  rows.forEach(r => {
    while (r.length < headers.length) r.push('');
    h += '<tr>' + r.map(c => `<td>${renderInline(c)}</td>`).join('') + '</tr>';
  });
  return h + '</tbody></table>';
}

// ── Block 渲染辅助 ──

function renderListBlock(block) {
  const hasTask = block.items.some(it => it.isTask);
  const hasNested = block.items.some(it => it.children && it.children.length > 0);
  let ulClass = '';
  if (hasTask) ulClass = ' class="task-list"';
  else if (hasNested && !block.ordered) ulClass = ' class="nested-list"';
  const items = block.items.map(it => {
    let li = '';
    if (it.isTask) {
      li = `<li class="task-item ${it.checked ? 'done' : ''}"><span class="task-check"></span> ${renderInline(it.body || it.title || '')}</li>`;
    } else {
      const text = it.title ? (it.body ? `**${it.title}** ${it.body}` : it.title) : (it.body || '');
      li = `<li>${renderInline(text)}`;
      if (it.children && it.children.length > 0) {
        const subItems = it.children.map(c => `<li>${renderInline(c)}</li>`).join('');
        li += `<ul>${subItems}</ul>`;
      }
      li += `</li>`;
    }
    return li;
  }).join('');
  return block.ordered ? `<ol>${items}</ol>` : `<ul${ulClass}>${items}</ul>`;
}

function renderLabelValues(block) {
  return `<div class="meta-grid">${block.pairs.map(p => {
    let value = p.status ? `<span class="status-pill">${p.status}</span>${renderInline(p.value)}` : renderInline(p.value);
    return `<div class="meta-row"><span class="meta-label">${escapeHtml(p.label)}</span><span class="meta-value">${value}</span></div>`;
  }).join('')}</div>`;
}

function renderToolGrid(block) {
  return `<div class="tool-grid">${block.tools.map(t =>
    `<div class="tool-item"><span class="tool-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</span><span class="tool-count">×${t.count}</span></div>`
  ).join('')}</div>`;
}

function renderFileList(block) {
  return `<ul class="file-list">${block.files.map(f => {
    const tag = `<span class="file-tag file-${f.fileType}">${f.fileType.toUpperCase()}</span>`;
    const change = f.children && f.children.length > 0
      ? `<span class="file-change">${f.children.map(c => `<span class="file-change-label">改动:</span> ${renderInline(c)}`).join('<br>')}</span>`
      : '';
    return `<li>${tag}<span class="file-path">${renderInline(f.path)}</span>${change}</li>`;
  }).join('')}</ul>`;
}

function renderTableBlock(block) {
  const nc = block.headers.length;
  let h = '<table><thead><tr>' + block.headers.map(x => `<th>${renderInline(x)}</th>`).join('') + '</tr></thead><tbody>';
  block.rows.forEach(r => {
    while (r.length < nc) r.push('');
    h += '<tr>' + r.map(c => `<td>${renderInline(c)}</td>`).join('') + '</tr>';
  });
  return h + '</tbody></table>';
}

// H3 → <h3>；H4+ → .sub-block 缩进容器（方案C）
// 单个 block 渲染（供 renderAllBlocks 内部调用）
function renderBlockItem(b) {
  if (b.kind === 'paragraph') return renderBlocksEnhanced(b.text);
  if (b.kind === 'list') return renderListBlock(b);
  if (b.kind === 'label-values') return renderLabelValues(b);
  if (b.kind === 'section-subhead') return `<div class="section-subhead">${renderInline(b.text)}</div>`;
  if (b.kind === 'tool-list') return renderToolGrid(b);
  if (b.kind === 'file-list') return renderFileList(b);
  if (b.kind === 'code') {
    if (b.lang === 'mermaid') return '<div class="mermaid">' + b.text + '</div>';
    return renderCodeBlock(b.lang, b.text);
  }
  if (b.kind === 'table') return renderTableBlock(b);
  if (b.kind === 'subheading') return renderSubheading(b);
  if (b.kind === 'faq') return `<details><summary>${renderInline(b.question)}</summary>${renderBlocks(b.answer)}</details>`;
  if (b.kind === 'stat-line') return `<div class="stat-line">${renderInlineEnhanced(b.text)}</div>`;
  if (b.kind === 'comment-marker') return `<div class="comment-marker">── ${b.text} ──</div>`;
  return '';
}

function renderSubheading(b) {
  return `<div class="subsection-head"><h3>${renderInline(b.text)}</h3></div>`;
}

// 单条 chat-message 渲染（供 renderAllBlocks 内部调用）
function renderChatMessage(m) {
  const isUser = m.role === 'U';
  const bubbleCls = isUser ? 'chat-msg user' : 'chat-msg assistant';
  const roleLabel = isUser ? '用户' : '助手';
  const bodyHtml = m.body ? `<div class="chat-bubble">${renderBlocksEnhanced(m.body)}</div>` : '';
  const toolsHtml = (m.toolCalls && m.toolCalls.length > 0)
    ? (() => {
        const groups = {};
        m.toolCalls.forEach(tc => { if (!groups[tc.type]) groups[tc.type] = []; groups[tc.type].push(tc.content); });
        return Object.entries(groups).map(([type, contents]) => {
          const icon = type.startsWith('ctx_') ? '🌐' : type === 'exec' ? '⚙️' : type === 'edit' ? '✏️' : type === 'read' ? '📖' : type === 'skill' ? '📦' : type === 'cron' ? '⏰' : '🔧';
          const label = type.startsWith('ctx_') ? 'ctx' : type;
          const items = contents.map(c => `<pre><code>${escapeHtml(c)}</code></pre>`).join('');
          return `<details class="chat-tool-group"><summary>${icon} ${escapeHtml(label)} ×${contents.length}</summary>${items}</details>`;
        }).join('');
      })() : '';
  const toolsWrap = toolsHtml ? `<div class="chat-tools">${toolsHtml}</div>` : '';
  const buttonsHtml = (m.buttons && m.buttons.length > 0)
    ? `<div class="chat-buttons">${m.buttons.map(b => `<span class="chat-btn">${escapeHtml(b.label)}</span>`).join('')}</div>`
    : '';
  const metaHtml = (m.meta && m.meta.length > 0)
    ? `<div class="chat-meta">${m.meta.map(line => `<span class="meta-line">${renderInline(line)}</span>`).join('')}</div>`
    : '';
  return `<div class="${bubbleCls}"><div class="chat-msg-head"><span class="chat-role">${roleLabel}</span><span class="chat-time">${escapeHtml(m.time)}</span></div>${bodyHtml}${toolsWrap}${buttonsHtml}${metaHtml}</div>`;
}

function renderAllBlocks(blocks) {
  // 如果 blocks 含 chat-message，保持原始顺序渲染
  const hasChat = blocks.some(b => b.kind === 'chat-message');
  if (hasChat) {
    const out = [];
    let chatGroup = [];
    for (const b of blocks) {
      if (b.kind === 'chat-message') {
        chatGroup.push(b);
      } else {
        // flush chat group
        if (chatGroup.length > 0) {
          out.push(`<div class="chat-timeline">${chatGroup.map(m => renderChatMessage(m)).join('')}</div>`);
          chatGroup = [];
        }
        out.push(renderBlockItem(b));
      }
    }
    if (chatGroup.length > 0) {
      out.push(`<div class="chat-timeline">${chatGroup.map(m => renderChatMessage(m)).join('')}</div>`);
    }
    return out.filter(Boolean).join('');
  }
  // H3+ subheading 及其后续非 subheading blocks，渲染为分组容器
  // H3 → .subsection-group（左缩进，无底色）
  // H4+ → .sub-block（轻底色容器，已有）
  const out = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.kind === 'subheading' && b.depth && b.depth >= 4) {
      // H4+ → .sub-block 轻底色容器
      const contentBlocks = [];
      let j = i + 1;
      while (j < blocks.length) {
        const nb = blocks[j];
        if (nb.kind === 'subheading') break;
        contentBlocks.push(nb);
        j++;
      }
      const contentHtml = contentBlocks.map(renderBlockItem).filter(Boolean).join('');
      out.push(`<div class="sub-block"><div class="sub-block-title">${renderInline(b.text)}</div><div class="sub-block-content">${contentHtml}</div></div>`);
      i = j;
    } else if (b.kind === 'subheading' && b.depth === 3) {
      // H3 → .subsection-group 左缩进分组，标题有竖线，内容缩进对齐
      const contentBlocks = [];
      let j = i + 1;
      while (j < blocks.length) {
        const nb = blocks[j];
        if (nb.kind === 'subheading') break;
        contentBlocks.push(nb);
        j++;
      }
      const contentHtml = contentBlocks.map(renderBlockItem).filter(Boolean).join('');
      out.push(`<div class="subsection-head"><h3>${renderInline(b.text)}</h3></div><div class="subsection-body">${contentHtml}</div>`);
      i = j;
    } else {
      out.push(renderBlockItem(b));
      i++;
    }
  }
  return out.filter(Boolean).join('');
}

// ── 从 blocks 提取特定类型 ──

function extractListItems(blocks, ordered) {
  return blocks.filter(b => b.kind === 'list' && (ordered ? b.ordered : !b.ordered)).flatMap(b => b.items);
}

function extractParagraphHtml(blocks) {
  return blocks.filter(b => b.kind === 'paragraph').map(b => renderBlocks(b.text)).join('');
}

function renderWebSection(s, i) {
  const num = String(i+1).padStart(2,'0');
  const hTag = s.isTopLevel ? 'h2' : 'h3';
  const titleHtml = s.timeBadge
    ? `<div class="time-badge">${s.timeBadge.start}<span>→</span>${s.timeBadge.end}</div><${hTag}>${renderInline(s.titleText)}</${hTag}>`
    : `<${hTag}>${renderInline(s.title)}</${hTag}>`;
  const numStr = i >= 0 ? String(i+1).padStart(2,'0') : '';
  const isSubSection = hTag === 'h3';
  const head = s.title ? (isSubSection
    ? `<div class="subsection-head"><${hTag}>${renderInline(s.title)}</${hTag}>${s.intro ? `<div class="section-intro">${renderInline(s.intro)}</div>` : ''}</div>`
    : `<div class="section-head">${numStr ? `<p>${numStr}</p>` : ''}${titleHtml}${s.intro ? `<div class="section-intro">${renderInline(s.intro)}</div>` : ''}</div>`) : '';

  // 渲染 quotes
  const quotesHtml = (s.quotes && s.quotes.length > 0)
    ? (s.quotes.length === 1
      ? `<aside class="insight-note"><div>${renderBlocks(s.quotes[0])}</div></aside>`
      : `<div class="multi-quotes">${s.quotes.map(q => `<blockquote>${renderBlocks(q)}</blockquote>`).join('')}</div>`)
    : '';

  // 渲染 images
  const imagesHtml = (s.images && s.images.length > 0)
    ? s.images.map(img => {
      let src = img.url;
      if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:') && !src.startsWith('/api/')) {
        let absPath;
        if (src.startsWith('/')) absPath = src;
        else if (typeof currentDir !== 'undefined' && currentDir) absPath = currentDir + '/' + src.replace(/^\.\//, '');
        else absPath = src;
        src = '/api/image?path=' + encodeURIComponent(absPath);
      }
      return `<figure class="md-image"><img src="${escapeHtml(src)}" alt="${escapeHtml(img.alt)}"${img.alt ? ` loading="lazy"` : ''}>${img.alt ? `<figcaption>${renderInline(img.alt)}</figcaption>` : ''}</figure>`;
    }).join('')
    : '';

  // mixed / text: 按 blocks 顺序渲染（通用渲染器）
  if (s.type === 'mixed' || s.type === 'text') {
    const introHtml = s.intro ? `<div class="section-intro">${renderInline(s.intro)}</div>` : '';
    return `<section id="${escapeHtml(s.anchor)}" class="web-section">${head}${introHtml}<div class="text-panel">${renderAllBlocks(s.blocks)}</div>${quotesHtml ? `<div style="margin-top:16px">${quotesHtml}</div>` : ''}${imagesHtml}</section>`;
  }

  if (s.type === 'split') {
    // 含 task 的 list 留在主内容区，只把非 task 的 list 抽到 mini-grid
    const hasTaskList = s.blocks.some(b => b.kind === 'list' && b.items.some(it => it.isTask));
    if (hasTaskList) {
      // 有 task 列表 → 按 text 类型渲染，不走 split 布局
      const paraHtml = renderAllBlocks(s.blocks);
      return `<section id="${escapeHtml(s.anchor)}" class="web-section">${head}<div class="text-panel">${paraHtml}</div>${quotesHtml ? `<div style="margin-top:16px">${quotesHtml}</div>` : ''}${imagesHtml}</section>`;
    }
    const listItems = extractListItems(s.blocks, false).slice(0,6);
    const items = listItems.map(it => {
      if (it.isTask) return `<article class="task-item ${it.checked ? 'done' : ''}"><input type="checkbox" ${it.checked ? 'checked' : ''} disabled> <span>${renderInline(it.body || it.title || '')}</span></article>`;
      return `<article>${it.title ? `<h3>${renderInline(it.title)}</h3>` : ''}${it.body ? `<p>${renderInline(it.body)}</p>` : ''}</article>`;
    }).join('');
    const paraHtml = renderAllBlocks(s.blocks.filter(b => b.kind !== 'list'));
    if (!paraHtml && listItems.length > 0) {
      return `<section id="${escapeHtml(s.anchor)}" class="web-section">${head}<div class="card-grid">${listItems.map(it => `<article class="web-card">${it.isTask ? `<input type="checkbox" ${it.checked ? 'checked' : ''} disabled> ` : ''}${it.title ? `<h3>${renderInline(it.title)}</h3>` : ''}${it.body ? `<p>${renderInline(it.body)}</p>` : ''}</article>`).join('')}</div>${quotesHtml ? `<div style="margin-top:24px">${quotesHtml}</div>` : ''}${imagesHtml}</section>`;
    }
    return `<section id="${escapeHtml(s.anchor)}" class="web-section">${head}<div class="split-main">${paraHtml}${quotesHtml}</div><div class="mini-grid">${items}</div>${imagesHtml ? `<div style="margin-top:16px">${imagesHtml}</div>` : ''}</section>`;
  }

  if (s.type === 'cards') {
    const listItems = extractListItems(s.blocks, false);
    const paraHtml = extractParagraphHtml(s.blocks);
    const cards = listItems.map(it => {
      if (it.isTask) return `<article class="web-card task-item ${it.checked ? 'done' : ''}"><input type="checkbox" ${it.checked ? 'checked' : ''} disabled><div><h3>${renderInline(it.body || it.title || '')}</h3></div></article>`;
      return `<article class="web-card">${it.title ? `<h3>${renderInline(it.title)}</h3>` : ''}${it.body ? `<p>${renderInline(it.body)}</p>` : ''}</article>`;
    }).join('');
    return `<section id="${escapeHtml(s.anchor)}" class="web-section">${head}${paraHtml ? `<div class="text-panel">${paraHtml}</div>` : ''}<div class="card-grid">${cards}</div>${quotesHtml ? `<div style="margin-top:24px">${quotesHtml}</div>` : ''}${imagesHtml}</section>`;
  }

  if (s.type === 'steps') {
    const listItems = extractListItems(s.blocks, true);
    const paraHtml = extractParagraphHtml(s.blocks);
    const steps = listItems.map((it,si) => `<article class="step"><span class="step-num">${String(si+1).padStart(2,'0')}</span><h3>${renderInline(it.title)}</h3>${it.body ? `<p>${renderInline(it.body)}</p>` : ''}</article>`).join('');
    return `<section id="${escapeHtml(s.anchor)}" class="web-section">${head}${paraHtml ? `<div class="text-panel">${paraHtml}</div>` : ''}<div class="steps">${steps}</div>${quotesHtml ? `<div style="margin-top:24px">${quotesHtml}</div>` : ''}${imagesHtml}</section>`;
  }

  if (s.type === 'quote') {
    return `<section id="${escapeHtml(s.anchor)}" class="web-section">${head}${quotesHtml || `<aside class="insight-note"><div>${renderAllBlocks(s.blocks)}</div></aside>`}${imagesHtml}</section>`;
  }

  if (s.type === 'faq') {
    const faqs = s.blocks.filter(b => b.kind === 'faq').map((it,fi) => `<details${fi===0?' open':''}><summary>${renderInline(it.question)}</summary>${renderBlocks(it.answer)}</details>`).join('');
    const otherHtml = renderAllBlocks(s.blocks.filter(b => b.kind !== 'faq'));
    return `<section id="${escapeHtml(s.anchor)}" class="web-section">${head}${otherHtml ? `<div class="text-panel">${otherHtml}</div>` : ''}<div class="faq-list">${faqs}</div>${imagesHtml}</section>`;
  }

  if (s.type === 'table') {
    return `<section id="${escapeHtml(s.anchor)}" class="web-section">${head}<div class="text-panel">${renderAllBlocks(s.blocks)}</div>${imagesHtml}</section>`;
  }

  // chat-log: 对话回放渲染，按原始顺序穿插渲染
  if (s.type === 'chat-log') {
    const parts = s.blocks.map(b => {
      if (b.kind === 'chat-message') return renderChatMessage(b);
      return renderAllBlocks([b]);
    }).filter(Boolean);
    return `<section id="${escapeHtml(s.anchor)}" class="web-section chat-log">${head}<div class="chat-timeline">${parts.join('')}</div>${imagesHtml}</section>`;
  }

  // 兜底：通用渲染
  return `<section id="${escapeHtml(s.anchor)}" class="web-section">${head}<div class="text-panel">${renderAllBlocks(s.blocks)}</div>${quotesHtml ? `<div style="margin-top:16px">${quotesHtml}</div>` : ''}${imagesHtml}</section>`;
}

// ══════════════════════════════════════════════════════
// 组装完整 HTML
// ══════════════════════════════════════════════════════

function buildFullHtml(pageData, themeName, options) {
  const { hero, sections } = pageData;
  const navItems = sections.filter(s => s.anchor && s.title)
    .filter(s => (s.titleDepth || 2) === (sections.filter(x => x.title).reduce((min, x) => Math.min(min, x.titleDepth || 2), 99)))
    .slice(0,12)
    .map((s) => `<a href="#${escapeHtml(s.anchor)}" data-target="${escapeHtml(s.anchor)}"><span class="dot"></span><span class="dot-label" title="${escapeHtml(s.title)}">${renderInline(s.title)}</span></a>`).join('');
  const heroBullets = hero.heroBullets.filter(b => b && b.trim()).map(b => `<li>${renderInline(b)}</li>`).join('');
  const metaTags = [];
  if (hero.metaDate) metaTags.push(`<span>📅 ${escapeHtml(hero.metaDate)}</span>`);
  if (hero.meta.tags) { const t = Array.isArray(hero.meta.tags) ? hero.meta.tags : [hero.meta.tags]; metaTags.push(`<span>🏷️ ${escapeHtml(t.join(', '))}</span>`); }
  const fileName = (options && options.fileName) || (mdFile ? path.basename(mdFile) : 'unknown');
  metaTags.push(`<span>📄 ${escapeHtml(fileName)}</span>`);
  // 只给最高一级 section 编号，与 heroBullets 一致
  let _sectionNum = 0;
  const sectionsHtml = sections.map(s => {
    if (!s.title) return renderWebSection(s, -1);
    const num = s.isTopLevel ? ++_sectionNum - 1 : -1;
    return renderWebSection(s, num);
  }).join('');

  let css;
  if (options && options.cssText) {
    css = options.cssText;
  } else if (path && fs && path.join && fs.existsSync) {
    const cssPath = path.join(__dirname, 'css.js');
    css = fs.existsSync(cssPath) ? require(cssPath).getCss() : '/* css.js not found */';
  } else {
    css = '/* css not loaded */';
  }

  const html = `<!DOCTYPE html>
<html lang="zh" data-theme="${escapeHtml(themeName)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(hero.title)}</title>
<style>${css}</style>
<link rel="stylesheet" href="/vendor/katex.min.css">
<script src="/vendor/katex.min.js"></script>
<script src="/vendor/auto-render.min.js"></script>
</head>
<body>
${(options && options.skipDemoBar) ? '' : `<div class="demo-bar">
  <span>🎨 主题</span>
  <button class="theme-btn" data-val="aurora-glass" onclick="setTheme('aurora-glass')">极光</button>
  <button class="theme-btn" data-val="magazine" onclick="setTheme('magazine')">杂志</button>
  <button class="theme-btn" data-val="neo-brutalism" onclick="setTheme('neo-brutalism')">卡通</button>
  <button class="theme-btn" data-val="swiss-mono" onclick="setTheme('swiss-mono')">黑白</button>
</div>`}
<nav class="dot-nav" id="dotNav">
  <a href="#top" data-target="top"><span class="dot"></span><span class="dot-label">顶部</span></a>
  ${navItems}
</nav>
<main id="top">
  <section class="web-hero">
    <div class="hero-copy">
      <p class="eyebrow">${renderInline(hero.kicker || 'Structured Note')}</p>
      <h1>${wrapEmoji(renderInline(hero.title))}</h1>
      ${hero.subtitle ? `<p class="hero-summary">${renderInline(hero.subtitle)}</p>` : ``}
      <div class="hero-meta">${metaTags.join('\n')}</div>
    </div>
    <aside class="hero-panel">
      <h2>${renderInline(hero.panelTitle)}</h2>
      <ul>${heroBullets}</ul>
    </aside>
  </section>
  ${sectionsHtml}
</main>
<div class="bottom-bar" id="bottom-bar">
  <div class="bb-left"><span id="bb-chars">字数 0</span><span id="bb-read">预计阅读 0 分钟</span></div>
  <div class="bb-center" id="bb-pos" title="第 0 字 / 共 0 字">第 0 字 / 共 0 字</div>
  <div class="bb-right"><span class="bb-percent" id="bb-pct">0%</span></div>
  <div class="bb-progress-wrap"><div class="bb-progress" id="bb-bar"></div></div>
</div>
<script>
function setTheme(t){document.documentElement.setAttribute('data-theme',t);document.querySelectorAll('.theme-btn').forEach(b=>b.classList.toggle('active',b.dataset.val===t))}
setTheme('${themeName}');
const dots=document.querySelectorAll('.dot-nav a');
const ids=['top',...[...document.querySelectorAll('.web-section')].map(s=>s.id)];
const obs=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting)dots.forEach(a=>a.classList.toggle('active',a.dataset.target===e.target.id))})},{rootMargin:'0px 0px -60% 0px'});
ids.forEach(id=>{const el=document.getElementById(id);if(el)obs.observe(el)});
dots[0].classList.add('active');
// bottom-bar 进度计算
(function(){
  const main=document.querySelector('main');
  if(!main)return;
  const totalText=main.innerText||'';
  const totalLen=totalText.replace(/\s/g,'').length;
  const readMin=Math.max(1,Math.ceil(totalLen/500));
  const fmt=n=>n.toLocaleString('en-US');
  document.getElementById('bb-chars').textContent='字数 '+fmt(totalLen);
  document.getElementById('bb-read').textContent='预计阅读 '+readMin+' 分钟';
  document.getElementById('bb-pos').textContent='第 0 字 / 共 '+fmt(totalLen)+' 字';
  document.getElementById('bb-pos').title='第 0 字 / 共 '+fmt(totalLen)+' 字';
  function updateProgress(){
    const scrollH=document.documentElement.scrollHeight;
    const clientH=document.documentElement.clientHeight;
    const scrollY=window.scrollY||0;
    const maxScroll=scrollH-clientH;
    const pct=maxScroll>0?Math.min(1,scrollY/maxScroll):0;
    const curChar=Math.round(pct*totalLen);
    document.getElementById('bb-pos').textContent='第 '+fmt(curChar)+' 字 / 共 '+fmt(totalLen)+' 字';
    document.getElementById('bb-pos').title='第 '+fmt(curChar)+' 字 / 共 '+fmt(totalLen)+' 字';
    document.getElementById('bb-pct').textContent=Math.round(pct*100)+'%';
    document.getElementById('bb-bar').style.width=Math.round(pct*100)+'%';
  }
  window.addEventListener('scroll',updateProgress,{passive:true});
  updateProgress();
})();
</script>
<script src="https://unpkg.com/@highlightjs/cdn-assets@11.11.1/highlight.min.js"></script>
<script>hljs.highlightAll();</script>
<div class="img-lightbox" id="img-lightbox" onclick="if(event.target===this)closeLightbox()">
  <img id="img-lightbox-img" src="" alt="" />
  <div class="img-toolbar">
    <button onclick="lbZoom(1.25)" title="放大">➕</button>
    <button onclick="lbZoom(0.8)" title="缩小">➖</button>
    <span class="zoom-level" id="zoom-level">100%</span>
    <button onclick="lbReset()" title="重置">⤢</button>
    <button onclick="closeLightbox()" title="关闭">✕</button>
  </div>
</div>
<script>
let lbScale=1,lbX=0,lbY=0,lbDrag=false,lbSX=0,lbSY=0,lbTX=0,lbTY=0,lbAnim=null;
function bindImgLightbox(){document.querySelectorAll('.md-image img').forEach(img=>{img.onclick=function(){lbScale=1;lbX=0;lbY=0;lbTX=0;lbTY=0;const li=document.getElementById('img-lightbox-img');li.src=this.src;li.style.transform='';updateZoom();document.getElementById('img-lightbox').classList.add('open')}})}
function closeLightbox(){document.getElementById('img-lightbox').classList.remove('open')}
function updateZoom(){document.getElementById('zoom-level').textContent=Math.round(lbScale*100)+'%'}
function updateLbTransform(){document.getElementById('img-lightbox-img').style.transform='translate('+lbX+'px,'+lbY+'px) scale('+lbScale+')';updateZoom()}
function getLbBounds(){const img=document.getElementById('img-lightbox-img');const r=img.getBoundingClientRect();const iw=r.width,ih=r.height;const vw=window.innerWidth,vh=window.innerHeight;return{maxX:Math.max(0,(iw-vw)/2),maxY:Math.max(0,(ih-vh)/2)}}
function clampLbPos(){const b=getLbBounds();lbX=Math.min(b.maxX,Math.max(-b.maxX,lbX));lbY=Math.min(b.maxY,Math.max(-b.maxY,lbY));lbTX=lbX;lbTY=lbY}
function lbZoom(f){lbScale=Math.min(Math.max(lbScale*f,0.2),10);if(lbScale<=1){lbX=0;lbY=0;lbTX=0;lbTY=0}else clampLbPos();updateLbTransform()}
function lbReset(){lbScale=1;lbX=0;lbY=0;lbTX=0;lbTY=0;updateLbTransform()}

// 代码复制按钮
function bindCodeCopy(){document.querySelectorAll('.code-copy-btn').forEach(function(btn){if(btn._bound)return;btn._bound=true;btn.addEventListener('click',function(){var codeEl=btn.closest('.code-block');if(!codeEl)return;var pre=codeEl.querySelector('pre');if(!pre)return;var text=pre.textContent||'';if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text)}var orig=btn.textContent;btn.textContent='已复制 ✓';btn.classList.add('copied');setTimeout(function(){btn.textContent=orig;btn.classList.remove('copied')},1500)})})}

document.getElementById('img-lightbox-img').addEventListener('dblclick',function(e){e.stopPropagation();if(lbScale===1){lbScale=3;lbX=0;lbY=0;lbTX=0;lbTY=0}else{lbScale=1;lbX=0;lbY=0;lbTX=0;lbTY=0}updateLbTransform()});
document.getElementById('img-lightbox-img').addEventListener('wheel',function(e){e.preventDefault();if(lbScale<=1)return;const b=getLbBounds();lbTX-=e.deltaX*0.6;lbTY-=e.deltaY*0.6;lbTX=Math.min(b.maxX,Math.max(-b.maxX,lbTX));lbTY=Math.min(b.maxY,Math.max(-b.maxY,lbTY));if(!lbAnim)lbAnim=requestAnimationFrame(function animate(){lbAnim=null;lbX+=(lbTX-lbX)*0.35;lbY+=(lbTY-lbY)*0.35;if(Math.abs(lbTX-lbX)<0.5&&Math.abs(lbTY-lbY)<0.5){lbX=lbTX;lbY=lbTY}else lbAnim=requestAnimationFrame(animate);updateLbTransform()})},{passive:false});
document.getElementById('img-lightbox-img').addEventListener('mousedown',function(e){e.stopPropagation();lbDrag=true;lbSX=e.clientX-lbX;lbSY=e.clientY-lbY});
document.addEventListener('mousemove',function(e){if(!lbDrag)return;lbX=e.clientX-lbSX;lbY=e.clientY-lbSY;const b=getLbBounds();lbX=Math.min(b.maxX,Math.max(-b.maxX,lbX));lbY=Math.min(b.maxY,Math.max(-b.maxY,lbY));lbTX=lbX;lbTY=lbY;updateLbTransform()});
document.addEventListener('mouseup',function(){lbDrag=false});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeLightbox();if(lbScale>1){const b=getLbBounds();const step=lbScale*50;if(e.key==='ArrowLeft'){lbX=Math.min(b.maxX,lbX+step);lbTX=lbX;updateLbTransform();e.preventDefault()}if(e.key==='ArrowRight'){lbX=Math.max(-b.maxX,lbX-step);lbTX=lbX;updateLbTransform();e.preventDefault()}if(e.key==='ArrowUp'){lbY=Math.min(b.maxY,lbY+step);lbTY=lbY;updateLbTransform();e.preventDefault()}if(e.key==='ArrowDown'){lbY=Math.max(-b.maxY,lbY-step);lbTY=lbY;updateLbTransform();e.preventDefault()}}});
bindImgLightbox();
bindCodeCopy();
if(typeof renderMathInElement==='function'){renderMathInElement(document.body,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],throwOnError:false})}
</script>
</body>
</html>`;

  return html;
}

// ── 执行（仅命令行模式） ──
if (typeof require !== 'undefined' && require.main === module) {
  if (!mdFile) {
    console.error('用法: node md-to-web.js <file.md> [--theme name] [--output file.html]');
    process.exit(1);
  }
  const mdContent = fs.readFileSync(mdFile, 'utf8');
  // Node 端读取 css.js
  const cssPath = path.join(__dirname, 'css.js');
  const cssText = fs.existsSync(cssPath) ? require(cssPath).getCss() : '';
  const tokens = parseMdTokens(mdContent);
  const pageData = tokensToStructured(tokens);
  const html = buildFullHtml(pageData, theme, { cssText, fileName: path.basename(mdFile), skipDemoBar: false });

  if (outputFile) {
    fs.writeFileSync(outputFile, html);
    console.log(`✅ 输出: ${outputFile}`);
  } else {
    process.stdout.write(html);
  }
}

// ── 暴露核心函数供浏览器端 ──
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseMdTokens, tokensToStructured, buildFullHtml };
}

/**
 * css.js — 4 套主题完整 CSS
 * Aurora Glass（极光玻璃）| Magazine（杂志）| Neo-Brutalism（新粗野）| Swiss Mono（瑞士黑白）
 */
function getCss() {
  return `
/* ═══ 通用基础 ═══ */
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:var(--font-body);background:var(--bg-primary);color:var(--text-primary);transition:background .3s,color .3s}
::selection{background:var(--accent-20)}

.demo-bar{position:fixed;top:0;left:0;right:0;z-index:10000;display:flex;align-items:center;gap:6px;padding:10px 20px;background:var(--bg-primary);border-bottom:1px solid var(--border-color)}
.demo-bar span{font-size:13px;color:var(--text-secondary);margin-right:8px;white-space:nowrap}
.theme-btn{background:none;border:1px solid var(--border-color);color:var(--text-primary);padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;transition:all .2s;white-space:nowrap}
.theme-btn:hover{border-color:var(--accent);color:var(--accent)}
.theme-btn.active{background:var(--accent);color:#fff;border-color:var(--accent)}
[data-theme="aurora-glass"] .demo-bar{background:rgba(15,12,41,0.82)}
[data-theme="aurora-glass"] .demo-bar span{color:#a0aec0}
[data-theme="magazine"] .demo-bar{background:rgba(250,248,245,0.85)}
[data-theme="neo-brutalism"] .demo-bar{background:rgba(248,248,248,0.85)}
[data-theme="swiss-mono"] .demo-bar{background:rgba(255,255,255,0.85)}
[data-theme="aurora-glass"] .theme-btn{color:#e2e8f0;border-color:rgba(255,255,255,0.2)}
[data-theme="aurora-glass"] .theme-btn:hover{border-color:#64ffda;color:#64ffda}
[data-theme="aurora-glass"] .theme-btn.active{background:#64ffda;color:#0f0c29;border-color:#64ffda}
[data-theme="magazine"] .theme-btn.active{background:#8b4513;color:#faf8f5;border-color:#8b4513}
[data-theme="neo-brutalism"] .theme-btn.active{background:#5200FF;color:#fff;border-color:#5200FF}
[data-theme="swiss-mono"] .theme-btn.active{background:#000;color:#fff;border-color:#000}

.dot-nav{position:fixed;right:24px;top:50%;transform:translateY(-50%);z-index:100;display:flex;flex-direction:column;gap:14px}
.dot-nav a{display:flex;align-items:center;gap:10px;text-decoration:none;cursor:pointer}
.dot-nav .dot{width:10px;height:10px;border-radius:50%;border:2px solid var(--border-color);background:transparent;flex-shrink:0;transition:all .25s}
.dot-nav .dot-label{font-size:12px;font-weight:600;color:var(--text-secondary);white-space:nowrap;opacity:0.4;transform:translateX(0);transition:opacity .25s;max-width:120px;overflow:hidden;text-overflow:ellipsis;display:inline-block}
.dot-nav a:hover .dot-label{opacity:1}
.dot-nav a:hover .dot{border-color:var(--accent)}
.dot-nav a.active .dot{background:var(--accent);border-color:var(--accent);box-shadow:0 0 8px var(--accent-20)}
.dot-nav a.active .dot-label{opacity:1;transform:translateX(0);color:var(--accent)}
@media(max-width:640px){.dot-nav{right:12px;gap:10px}.dot-nav .dot-label{display:none}}

main{width:min(100%,1080px);margin:0 auto;padding:20px 22px 100px}

.web-hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(280px,0.95fr);gap:clamp(22px,4vw,48px);align-items:stretch;min-height:340px;padding:28px 0 46px}
.hero-copy{display:flex;flex-direction:column;justify-content:center}
.eyebrow{color:var(--accent);font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.5px}
.web-hero h1{margin:18px 0;font-family:var(--font-heading);font-size:clamp(34px,6vw,64px);line-height:1.08;font-weight:800;color:var(--text-primary)}
.hero-summary{max-width:680px;color:var(--text-secondary);font-size:clamp(16px,2vw,20px);font-weight:500;line-height:1.6}
.hero-meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
.hero-meta span{border:1px solid var(--border-color);border-radius:999px;padding:4px 12px;font-size:12px;color:var(--text-secondary);background:var(--meta-bg)}
.hero-panel{display:flex;flex-direction:column;gap:16px;padding:28px;border-radius:var(--card-radius);background:var(--panel-bg);border:1px solid var(--border-color);box-shadow:var(--card-shadow)}
.hero-panel h2{font-size:15px;font-weight:800;color:var(--accent);margin-bottom:4px}
.hero-panel ul{list-style:none;display:flex;flex-direction:column;gap:10px}
.hero-panel li{display:flex;gap:8px;font-size:14px;line-height:1.6;color:var(--text-primary)}
.hero-panel li::before{content:'\\2192';color:var(--accent);font-weight:700;flex-shrink:0}

.web-section{padding:36px 0;border-top:1px solid var(--border-color)}
.section-head{display:grid;grid-template-columns:60px auto 1fr;gap:0 12px;margin-bottom:24px;align-items:center}
.section-head>p:first-child{font-size:13px;font-weight:900;color:var(--accent);font-family:var(--font-mono);padding-top:4px}
.section-head h2{font-family:var(--font-heading);font-size:clamp(22px,3.5vw,32px);font-weight:800;line-height:1.2;color:var(--text-primary)}
.section-intro{grid-column:2;margin-top:8px;color:var(--text-secondary);font-size:15px;line-height:1.6}

.split-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(240px,0.7fr);gap:32px}
.split-main p{margin:10px 0;line-height:1.8}
.insight-note{margin:20px 0;padding:16px 20px;border-radius:var(--card-radius);background:var(--insight-bg);border-left:4px solid var(--accent)}
.insight-note>span{display:block;font-size:12px;font-weight:800;color:var(--accent);text-transform:uppercase;margin-bottom:8px}
.insight-note p{margin:4px 0;line-height:1.7}
.mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.mini-grid article{padding:16px;border-radius:var(--card-radius);background:var(--card-bg);border:1px solid var(--border-color)}
.mini-grid article h3{font-size:14px;font-weight:700;color:var(--accent);margin-bottom:6px}
.mini-grid article p{font-size:13px;line-height:1.6;color:var(--text-secondary)}

.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.web-card{padding:24px;border-radius:var(--card-radius);background:var(--card-bg);border:1px solid var(--border-color);box-shadow:var(--card-shadow);transition:transform .2s,box-shadow .2s}
.web-card:hover{transform:translateY(-2px);box-shadow:var(--card-hover-shadow)}
.web-card h3{font-size:16px;font-weight:700;color:var(--accent);margin-bottom:10px}
.web-card p{font-size:14px;line-height:1.7;color:var(--text-secondary)}

.steps{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.step{padding:24px;border-radius:var(--card-radius);background:var(--card-bg);border:1px solid var(--border-color);position:relative}
.step>span.step-num{display:inline-block;width:32px;height:32px;border-radius:50%;background:var(--accent);color:var(--bg-primary);font-size:13px;font-weight:800;line-height:32px;text-align:center;margin-bottom:12px;font-family:var(--font-mono)}
.step h3{font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:8px}
.step p{font-size:13px;line-height:1.6;color:var(--text-secondary)}

.faq-list{display:flex;flex-direction:column;gap:10px}
.faq-list details{padding:16px 20px;border-radius:var(--card-radius);background:var(--card-bg);border:1px solid var(--border-color);cursor:pointer}
.faq-list summary{font-size:15px;font-weight:600;color:var(--text-primary);outline:none}
.faq-list summary::-webkit-details-marker{display:none}
.faq-list summary::after{content:'+';float:right;font-size:18px;color:var(--accent);transition:transform .2s}
.faq-list details[open] summary::after{transform:rotate(45deg)}
.faq-list details[open] summary{margin-bottom:10px}
.faq-list details p{font-size:14px;line-height:1.7;color:var(--text-secondary)}

.text-panel{max-width:760px}
.text-panel p{margin:10px 0;line-height:1.8}
.text-panel code{background:var(--code-bg);padding:2px 6px;border-radius:4px;font-size:.88em;color:var(--code-inline-color);font-family:var(--font-mono)}
.text-panel pre{background:var(--code-bg);padding:14px;border-radius:8px;overflow-x:auto;margin:12px 0;border:1px solid var(--border-color)}
.text-panel pre code{background:none;padding:0;color:var(--text-primary)}
.code-block{margin:12px 0;border:1px solid var(--border-color);border-radius:8px;overflow:hidden}
.code-header{display:flex;justify-content:space-between;align-items:center;padding:6px 12px;background:var(--bg-tertiary);border-bottom:1px solid var(--border-color);font-size:12px}
.code-lang{font-family:var(--font-mono);color:var(--text-secondary);text-transform:lowercase}
.code-copy-btn{background:none;border:1px solid var(--border-color);border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;color:var(--text-secondary);font-family:var(--font-mono)}
.code-copy-btn:hover{color:var(--accent);border-color:var(--accent)}
.code-copy-btn.copied{color:var(--accent);border-color:var(--accent)}
.code-block pre{margin:0;border:none;border-radius:0}
.code-line{display:block}
.meta-grid{margin:12px 0}
.subsection-head{margin:28px 0 4px;padding-left:12px;border-left:3px solid var(--accent)}
.subsection-head h3{font-family:var(--font-heading);font-size:17px;font-weight:700;color:var(--accent);margin:0;line-height:1.3}
.subsection-head .section-intro{margin-top:6px}
.subsection-body{padding:4px 0 4px 15px;margin-bottom:8px}
.subsection-body p{margin:8px 0;line-height:1.7}
.meta-row{display:flex;padding:6px 0}
.meta-row:not(:first-child){border-top:1px solid var(--border-color)}
.meta-row:last-child{border:none}
.meta-label{flex:0 0 auto;padding:8px 12px;font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);white-space:nowrap}
.meta-value{flex:1;min-width:0;padding:8px 12px;font-size:14px;line-height:1.6;word-break:break-word}
.text-panel ul,.text-panel ol{margin:8px 0 8px 24px}
.text-panel li{margin:4px 0;line-height:1.7}
.text-panel strong{color:var(--accent-light);font-weight:600}
.text-panel em{color:var(--em-color)}
.text-panel a{color:var(--accent);text-decoration:none}
.text-panel a:hover{text-decoration:underline}
.text-panel table{border-collapse:collapse;margin:12px 0;width:100%}
.text-panel th{background:var(--bg-secondary);color:var(--accent);font-weight:600;text-align:left;padding:8px 12px;border:1px solid var(--border-color)}
.text-panel td{padding:8px 12px;border:1px solid var(--border-color)}
.text-panel tr:nth-child(even){background:var(--bg-secondary)}

/* 图片 */
.md-image{margin:16px 0;text-align:center}
.md-image img{max-width:100%;border-radius:var(--card-radius);border:1px solid var(--border-color);cursor:zoom-in;transition:transform .2s}
.md-image img:hover{transform:scale(1.02)}
.md-image figcaption{margin-top:6px;font-size:12px;color:var(--text-secondary);font-style:italic}

/* ═══ 对话回放 chat-log ═══ */
.chat-timeline{position:relative;padding-left:28px;max-width:800px}
.chat-timeline::before{content:'';position:absolute;left:8px;top:0;bottom:0;width:2px;background:var(--border-color)}
.chat-msg{position:relative;margin-bottom:24px;padding-left:8px}
.chat-msg::before{content:'';position:absolute;left:-24px;top:6px;width:12px;height:12px;border-radius:50%;background:var(--accent);border:2px solid var(--bg-primary);z-index:1}
.chat-msg.assistant::before{background:var(--accent-dark,var(--accent))}
.chat-msg-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.chat-role{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary)}
.chat-time{font-size:11px;font-family:var(--font-mono);color:var(--text-secondary);opacity:.7}
.chat-bubble{display:inline-block;max-width:100%;padding:10px 16px;border-radius:var(--card-radius);background:var(--card-bg);border:1px solid var(--border-color);line-height:1.7;font-size:14px;color:var(--text-primary)}
.chat-msg.user .chat-bubble{background:var(--bg-secondary);border-radius:12px 12px 12px 2px}
.chat-msg.assistant .chat-bubble{background:var(--card-bg);border-radius:12px 12px 2px 12px;border-color:var(--accent-10,var(--border-color))}
.chat-meta{margin-top:8px;padding:8px 12px;border-radius:6px;background:var(--bg-tertiary,var(--bg-secondary));font-family:var(--font-mono);font-size:11px;line-height:1.6;color:var(--text-secondary);opacity:.8;white-space:pre-wrap;word-break:break-all}
.chat-meta .meta-line{display:block;padding:2px 0}
.chat-tools{margin-top:6px}
.chat-tool-group{margin-bottom:4px;border:1px solid var(--border-color);border-radius:6px;overflow:hidden}
.chat-tool-group summary{padding:4px 10px;font-size:11px;font-family:var(--font-mono);color:var(--text-secondary);cursor:pointer;list-style:none;outline:none;user-select:none}
.chat-tool-group summary::-webkit-details-marker{display:none}
.chat-tool-group summary:hover{background:var(--bg-tertiary,var(--bg-secondary))}
.chat-tool-group pre{padding:8px 12px;margin:0;font-size:11px;font-family:var(--font-mono);background:var(--bg-tertiary,var(--bg-secondary));overflow-x:auto;max-height:200px;overflow-y:auto;border-top:1px solid var(--border-color)}
.chat-tool-group pre code{background:none;padding:0;color:var(--text-secondary);font-size:11px}
.chat-buttons{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}
.chat-btn{display:inline-block;padding:4px 12px;font-size:12px;border:1px solid var(--border-color);border-radius:999px;background:var(--bg-secondary);color:var(--text-secondary);cursor:default;user-select:none}

/* ═══ 图片灯箱 ═══ */
.img-lightbox{position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:10001;display:none;align-items:center;justify-content:center;cursor:zoom-out}
.img-lightbox.open{display:flex}
.img-lightbox img{max-width:92vw;max-height:92vh;border-radius:4px;box-shadow:0 4px 24px rgba(0,0,0,0.6);transition:transform .15s;cursor:grab}
.img-lightbox img:active{cursor:grabbing}
.img-toolbar{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:6px;padding:6px 10px;background:rgba(0,0,0,0.6);border-radius:20px}
.img-toolbar button{background:none;border:none;color:#fff;cursor:pointer;font-size:16px;padding:4px 8px;border-radius:8px;transition:background .15s}
.img-toolbar button:hover{background:rgba(255,255,255,0.2)}
.img-toolbar .zoom-level{font-size:12px;color:rgba(255,255,255,0.7);padding:4px 6px;align-self:center}

/* 任务列表 */
.task-item{position:relative;padding-left:4px}
.task-item.done{opacity:0.6;text-decoration:line-through}

/* ═══ 语义增强通用 ═══ */
.time-badge{display:inline-flex;align-items:center;gap:2px;font-family:var(--font-mono);font-size:13px;padding:4px 12px;border-radius:var(--card-radius);border:1px solid var(--border-color);background:var(--card-bg);white-space:nowrap;flex-shrink:0}
.time-badge span{color:var(--text-secondary);margin:0 4px}
.section-head{align-items:flex-start}
.meta-grid{display:flex;flex-direction:column;gap:0;margin-bottom:16px}
.meta-row{display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-color)}
.meta-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--accent);font-family:var(--font-mono);min-width:100px;padding:2px 0;flex-shrink:0}
.meta-value{font-size:14px;color:var(--text-primary);line-height:1.6;flex:1;padding:2px 0}
.meta-row .meta-value code{padding:0 4px}
.status-pill{display:inline-flex;align-items:center;gap:2px;font-size:14px;margin-right:4px;vertical-align:middle}
.section-subhead{font-size:13px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.5px;margin:16px 0 4px;padding-top:8px;border-top:1px solid var(--border-color)}
.tool-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin:8px 0 16px}
.tool-item{display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:var(--card-radius);overflow:hidden}
.tool-name{color:var(--text-secondary);font-family:var(--font-mono);font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.tool-count{color:var(--accent);font-weight:700;font-family:var(--font-mono);font-size:12px;flex-shrink:0}
.file-list{list-style:none;margin:8px 0 16px}
.file-list>li{padding:8px 0;border-bottom:1px solid var(--border-color)}
.file-tag{display:inline-block;font-size:9px;font-weight:800;padding:1px 6px;border-radius:3px;margin-right:8px;font-family:var(--font-mono);letter-spacing:.5px;vertical-align:middle}
.file-dir{background:var(--accent-10);color:var(--accent);border:1px solid var(--accent-20)}
.file-file{background:var(--accent-10);color:var(--accent-light);border:1px solid var(--accent-20)}
.file-val{background:var(--accent-10);color:var(--accent-dark);border:1px solid var(--accent-20)}
.file-path{font-size:13px;color:var(--text-primary);font-family:var(--font-mono);word-break:break-all}
.file-change{display:block;margin:4px 0 0 28px;font-size:13px;color:var(--text-secondary);padding-left:12px;border-left:2px solid var(--accent-20)}
.file-change-label{color:var(--accent);font-weight:600}

@media(max-width:768px){.web-hero,.split-grid,.section-head{grid-template-columns:1fr}.card-grid,.steps{grid-template-columns:1fr}.web-hero h1{font-size:36px}}

/* ═══ highlight.js ═══ */
[data-theme="aurora-glass"] .hljs{background:var(--code-bg);color:#c9d1d9}
[data-theme="aurora-glass"] .hljs-keyword,[data-theme="aurora-glass"] .hljs-selector-tag{color:#ff6b9d}
[data-theme="aurora-glass"] .hljs-string,[data-theme="aurora-glass"] .hljs-addition{color:#64ffda}
[data-theme="aurora-glass"] .hljs-comment,[data-theme="aurora-glass"] .hljs-quote{color:#6a737d;font-style:italic}
[data-theme="aurora-glass"] .hljs-number,[data-theme="aurora-glass"] .hljs-literal{color:#79c0ff}
[data-theme="aurora-glass"] .hljs-function .hljs-title{color:#d2a8ff}
[data-theme="aurora-glass"] .hljs-built_in{color:#ffa657}
[data-theme="aurora-glass"] .hljs-variable,[data-theme="aurora-glass"] .hljs-attr{color:#79c0ff}

[data-theme="magazine"] .hljs{background:var(--code-bg);color:#4a3728}
[data-theme="magazine"] .hljs-keyword,[data-theme="magazine"] .hljs-selector-tag{color:#8b4513}
[data-theme="magazine"] .hljs-string,[data-theme="magazine"] .hljs-addition{color:#5b7c5b}
[data-theme="magazine"] .hljs-comment,[data-theme="magazine"] .hljs-quote{color:#8a7050;font-style:italic}
[data-theme="magazine"] .hljs-number,[data-theme="magazine"] .hljs-literal{color:#a0522d}
[data-theme="magazine"] .hljs-function .hljs-title{color:#6b3410}
[data-theme="magazine"] .hljs-built_in{color:#b87333}

[data-theme="neo-brutalism"] .hljs{background:#08080D;color:#F8E000}
[data-theme="neo-brutalism"] .hljs-keyword{color:#5200FF}
[data-theme="neo-brutalism"] .hljs-string{color:#E1306C}
[data-theme="neo-brutalism"] .hljs-comment{color:#555;font-style:italic}
[data-theme="neo-brutalism"] .hljs-number{color:#F8E000}
[data-theme="neo-brutalism"] .hljs-function .hljs-title{color:#E1306C}
[data-theme="neo-brutalism"] .hljs-built_in{color:#5200FF}

[data-theme="swiss-mono"] .hljs{background:#f5f5f5;color:#999}
[data-theme="swiss-mono"] .hljs-keyword{color:#000;font-weight:700}
[data-theme="swiss-mono"] .hljs-string{color:#333}
[data-theme="swiss-mono"] .hljs-comment{color:#ccc;font-style:italic}
[data-theme="swiss-mono"] .hljs-number{color:#000;font-weight:600}
[data-theme="swiss-mono"] .hljs-function .hljs-title{color:#000;font-weight:600}
[data-theme="swiss-mono"] .hljs-built_in{color:#666}
[data-theme="swiss-mono"] .hljs-variable,[data-theme="swiss-mono"] .hljs-attr{color:#333}
[data-theme="swiss-mono"] .hljs-tag,[data-theme="swiss-mono"] .hljs-name{color:#000;font-weight:600}
[data-theme="swiss-mono"] .hljs-attribute{color:#333}
[data-theme="swiss-mono"] .hljs-addition{color:#2e7d32}
[data-theme="swiss-mono"] .hljs-deletion{color:#c62828}

/* ═══════════════════════════════════════════════
   主题 1: 极光玻璃 Aurora Glass
   科技SaaS · 毛玻璃+渐变发光+脉冲导航
   ═══════════════════════════════════════════════ */
[data-theme="aurora-glass"]{
  --bg-primary:#0f0c29;--bg-secondary:#1a1a3e;--bg-tertiary:#2a2a5a;
  --text-primary:#ffffff;--text-secondary:#a0aec0;
  --border-color:rgba(255,255,255,0.25);
  --accent:#64ffda;--accent-light:#80ffea;--accent-dark:#4dd9b8;
  --accent-5:rgba(100,255,218,0.05);--accent-10:rgba(100,255,218,0.10);
  --accent-12:rgba(100,255,218,0.12);--accent-20:rgba(100,255,218,0.20);
  --em-color:#ff6b9d;--code-bg:#1e1e42;--code-inline-color:#64ffda;
  --meta-bg:rgba(100,255,218,0.05);--panel-bg:rgba(30,30,66,0.4);
  --card-bg:rgba(30,30,66,0.5);--insight-bg:rgba(100,255,218,0.05);
  --card-shadow:0 8px 32px rgba(0,0,0,0.3);
  --card-hover-shadow:0 12px 40px rgba(100,255,218,0.15);
  --card-radius:12px;
  --font-body:'Inter','Noto Sans SC',system-ui,sans-serif;
  --font-heading:'Inter','Noto Sans SC',sans-serif;
  --font-mono:'SF Mono','Fira Code',monospace;
}
[data-theme="aurora-glass"] body{background:linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%);background-attachment:fixed}
[data-theme="aurora-glass"] .web-hero h1{background:linear-gradient(135deg,#64ffda 20%,#ff6b9d 80%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
[data-theme="aurora-glass"] .web-hero h1 .emoji{background:none;-webkit-text-fill-color:initial;color:initial}
[data-theme="aurora-glass"] .hero-panel,[data-theme="aurora-glass"] .web-card,[data-theme="aurora-glass"] .step,[data-theme="aurora-glass"] .faq-list details{backdrop-filter:blur(8px)}
[data-theme="aurora-glass"] .section-head{grid-template-columns:48px auto 1fr;position:relative;align-items:center}
[data-theme="aurora-glass"] .section-head>p:first-child{position:relative;font-size:11px;font-weight:900;color:#64ffda;font-family:var(--font-mono);padding-top:6px}
[data-theme="aurora-glass"] .section-head>p:first-child::after{content:'';position:absolute;left:23px;top:32px;bottom:-36px;width:2px;background:linear-gradient(to bottom,rgba(100,255,218,0.4),transparent)}
[data-theme="aurora-glass"] .subsection-head{border-left-color:#64ffda}
[data-theme="aurora-glass"] .subsection-head h3{color:#64ffda;text-shadow:0 0 12px rgba(100,255,218,0.3)}
[data-theme="aurora-glass"] .subsection-body{border-left:1px solid rgba(100,255,218,0.15);margin-left:2px}
[data-theme="aurora-glass"] .dot-nav a.active .dot{animation:aurora-pulse 2s ease-in-out infinite}
@keyframes aurora-pulse{0%,100%{box-shadow:0 0 8px rgba(100,255,218,0.2)}50%{box-shadow:0 0 16px rgba(100,255,218,0.4)}}

/* 杂志·语义增强 */
[data-theme="magazine"] .time-badge{background:none;border:none;border-top:1px solid #8b4513;border-bottom:1px solid #8b4513;border-radius:0;color:#8b4513;font-family:Georgia,serif;font-style:italic;font-size:14px;padding:4px 0}
[data-theme="magazine"] .time-badge span{color:#d6cfc1;margin:0 6px;font-style:normal}
[data-theme="magazine"] .meta-row{border-color:#d6cfc1}
[data-theme="magazine"] .meta-label{color:#8b4513;font-family:Georgia,serif;font-style:italic;text-transform:none;letter-spacing:0;font-size:13px}
[data-theme="magazine"] .meta-value{color:#2c2c2c;font-family:Georgia,serif;font-size:14px}
[data-theme="magazine"] .tool-grid{grid-template-columns:repeat(auto-fill,minmax(100px,1fr))}
[data-theme="magazine"] .tool-item{background:none;border:none;border-bottom:1px dotted #d6cfc1;border-radius:0;padding:4px 0}
[data-theme="magazine"] .tool-name{color:#6b6b6b;font-family:Georgia,serif;font-size:13px;font-style:italic}
[data-theme="magazine"] .tool-count{color:#8b4513;font-family:Georgia,serif;font-size:13px}
[data-theme="magazine"] .file-list>li{border-bottom:1px dotted #d6cfc1}
[data-theme="magazine"] .file-tag{font-family:Georgia,serif;font-style:italic;background:none;border:none;padding:0 4px 0 0;font-size:11px}
[data-theme="magazine"] .file-dir{color:#8b4513}
[data-theme="magazine"] .file-file{color:#a0522d}
[data-theme="magazine"] .file-val{color:#6b3410}
[data-theme="magazine"] .file-path{color:#2c2c2c;font-family:Georgia,serif;font-size:13px}
[data-theme="magazine"] .file-change{border-left:2px solid #8b4513;color:#6b6b6b;font-style:italic;margin-left:0}
[data-theme="magazine"] .file-change-label{color:#8b4513;font-style:normal}
[data-theme="magazine"] .section-subhead{color:#8b4513;font-family:Georgia,serif;font-style:italic;text-transform:none;letter-spacing:0;border-color:#d6cfc1}
[data-theme="magazine"] .chat-timeline::before{background:#d6cfc1}
[data-theme="magazine"] .chat-msg::before{background:#8b4513;border-color:#faf8f5}
[data-theme="magazine"] .chat-msg.assistant::before{background:#5b7c5b}
[data-theme="magazine"] .chat-msg.user .chat-bubble{background:#f5efe6;border:1px solid #d6cfc1;border-radius:2px 12px 12px 12px;font-family:Georgia,serif}
[data-theme="magazine"] .chat-msg.assistant .chat-bubble{background:#faf8f5;border:1px solid #d6cfc1;border-radius:12px 2px 12px 12px;font-family:Georgia,serif}
[data-theme="magazine"] .chat-meta{background:#f5efe6;color:#8a7050;border:1px solid #d6cfc1;border-radius:2px;font-family:'Courier New',monospace}
[data-theme="magazine"] .chat-role{color:#8b4513}
[data-theme="magazine"] .chat-msg.assistant .chat-role{color:#5b7c5b}
[data-theme="magazine"] .chat-tool-group{background:#f5efe6;border-color:#d6cfc1;border-radius:2px}
[data-theme="magazine"] .chat-tool-group summary{color:#8a7050;font-family:Georgia,serif;font-size:11px}
[data-theme="magazine"] .chat-tool-group pre{background:#faf8f5;border-color:#d6cfc1}
[data-theme="magazine"] .chat-tool-group pre code{color:#4a3728;font-family:'Courier New',monospace}
[data-theme="magazine"] .chat-btn{background:#f5efe6;border-color:#8b4513;color:#8b4513;font-family:Georgia,serif;border-radius:2px}
[data-theme="magazine"] .meta-line{border-bottom:1px solid #e8e0d0;font-family:'Courier New',monospace}

/* 杂志导航：衬线编号 + 斜体标签 + 棕红短横线 */
[data-theme="magazine"] .dot-nav .dot{display:none}
[data-theme="magazine"] .dot-nav .dot-label{font-family:Georgia,serif;font-style:italic;font-size:13px;color:#6b6b6b;opacity:0.5;transform:translateX(0);transition:opacity .25s}
[data-theme="magazine"] .dot-nav a:hover .dot-label{opacity:1}
[data-theme="magazine"] .dot-nav a.active .dot-label{opacity:1;color:#8b4513}
[data-theme="magazine"] .dot-nav a{position:relative;padding-left:14px}
[data-theme="magazine"] .dot-nav a::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:8px;height:1px;background:#8b4513;opacity:0.4;transition:opacity .25s,width .25s}
[data-theme="magazine"] .dot-nav a:hover::before{opacity:0.8;width:12px}
[data-theme="magazine"] .dot-nav a.active::before{opacity:1;width:16px}

[data-theme="aurora-glass"] .web-card:hover{border-color:rgba(100,255,218,0.4);box-shadow:0 12px 40px rgba(100,255,218,0.15),0 0 0 1px rgba(100,255,218,0.2)}

/* 极光·语义增强 */
[data-theme="aurora-glass"] .time-badge{background:rgba(100,255,218,0.08);border-color:rgba(100,255,218,0.3);color:#64ffda;backdrop-filter:blur(8px)}
[data-theme="aurora-glass"] .time-badge span{color:rgba(100,255,218,0.4)}
[data-theme="aurora-glass"] .meta-row{border-color:rgba(255,255,255,0.06)}
[data-theme="aurora-glass"] .meta-label{color:#64ffda}
[data-theme="aurora-glass"] .meta-value{color:#e2e8f0}
[data-theme="aurora-glass"] .meta-row .meta-value code{padding:0 4px}
[data-theme="aurora-glass"] .status-pill{font-size:14px}
[data-theme="aurora-glass"] .tool-item{background:rgba(30,30,66,0.5);border-color:rgba(255,255,255,0.15)}
[data-theme="aurora-glass"] .tool-name{color:#a0aec0}
[data-theme="aurora-glass"] .tool-count{color:#64ffda}
[data-theme="aurora-glass"] .file-dir{background:rgba(100,255,218,0.12);color:#64ffda;border-color:rgba(100,255,218,0.3)}
[data-theme="aurora-glass"] .file-file{background:rgba(255,107,157,0.12);color:#ff6b9d;border-color:rgba(255,107,157,0.3)}
[data-theme="aurora-glass"] .file-val{background:rgba(168,85,247,0.12);color:#c084fc;border-color:rgba(168,85,247,0.3)}
[data-theme="aurora-glass"] .file-path{color:#e2e8f0}
[data-theme="aurora-glass"] .file-change{border-color:rgba(100,255,218,0.3);color:#a0aec0}
[data-theme="aurora-glass"] .file-change-label{color:#64ffda}
[data-theme="aurora-glass"] .section-subhead{color:#64ffda;border-color:rgba(255,255,255,0.1)}
[data-theme="aurora-glass"] .chat-timeline::before{background:rgba(100,255,218,0.2)}
[data-theme="aurora-glass"] .chat-msg::before{background:#64ffda;border-color:#0f0c29}
[data-theme="aurora-glass"] .chat-msg.assistant::before{background:#ff6b9d}
[data-theme="aurora-glass"] .chat-msg.user .chat-bubble{background:rgba(30,30,66,0.6);border-color:rgba(255,255,255,0.1);backdrop-filter:blur(8px)}
[data-theme="aurora-glass"] .chat-msg.assistant .chat-bubble{background:rgba(26,26,62,0.8);border-color:rgba(100,255,218,0.15);backdrop-filter:blur(8px)}
[data-theme="aurora-glass"] .chat-meta{background:rgba(15,12,41,0.5);color:#a0aec0;border:1px solid rgba(255,255,255,0.05)}
[data-theme="aurora-glass"] .chat-role{color:#64ffda}
[data-theme="aurora-glass"] .chat-msg.assistant .chat-role{color:#ff6b9d}
[data-theme="aurora-glass"] .chat-tool-group{background:rgba(15,12,41,0.4);border-color:rgba(255,255,255,0.08)}
[data-theme="aurora-glass"] .chat-tool-group summary{color:#a0aec0}
[data-theme="aurora-glass"] .chat-tool-group summary:hover{background:rgba(100,255,218,0.05)}
[data-theme="aurora-glass"] .chat-tool-group pre{background:rgba(10,10,30,0.6);border-color:rgba(255,255,255,0.05)}
[data-theme="aurora-glass"] .chat-tool-group pre code{color:#c0c0d0}
[data-theme="aurora-glass"] .chat-btn{background:rgba(100,255,218,0.08);border-color:rgba(100,255,218,0.2);color:#64ffda}
[data-theme="aurora-glass"] .meta-line{border-bottom:1px solid rgba(255,255,255,0.03)}

/* ═══════════════════════════════════════════════
   主题 2: 杂志 Magazine
   杂志编辑 · 双栏排版+首字下沉+斜体引用+顶部横线标签
   ═══════════════════════════════════════════════ */
[data-theme="magazine"]{
  --bg-primary:#faf8f5;--bg-secondary:#f0ece4;--bg-tertiary:#e6e0d4;
  --text-primary:#2c2c2c;--text-secondary:#6b6b6b;
  --border-color:#d6cfc1;
  --accent:#8b4513;--accent-light:#a0522d;--accent-dark:#6b3410;
  --accent-5:rgba(139,69,19,0.05);--accent-10:rgba(139,69,19,0.10);
  --accent-12:rgba(139,69,19,0.12);--accent-20:rgba(139,69,19,0.20);
  --em-color:#5b7c5b;--code-bg:#f0ece4;--code-inline-color:#8b4513;
  --meta-bg:rgba(139,69,19,0.03);--panel-bg:#f0ece4;
  --card-bg:#f5f1ea;--insight-bg:rgba(139,69,19,0.04);
  --card-shadow:0 4px 20px rgba(139,69,19,0.06);
  --card-hover-shadow:0 8px 28px rgba(139,69,19,0.12);
  --card-radius:0px;
  --font-body:Georgia,'Noto Serif SC',serif;
  --font-heading:Georgia,'Noto Serif SC',serif;
  --font-mono:'Courier New',monospace;
}
[data-theme="magazine"] .web-hero{grid-template-columns:1fr;gap:20px}
[data-theme="magazine"] .hero-panel{border:none;border-top:2px solid #8b4513;border-radius:0;box-shadow:none;background:none;padding:20px 0 0;position:relative}
[data-theme="magazine"] .hero-panel::after{content:'';position:absolute;top:2px;left:0;width:60px;height:2px;background:#8b4513}
[data-theme="magazine"] .hero-panel h2{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#8b4513;border-bottom:1px solid #d6cfc1;padding-bottom:8px;margin-bottom:12px}
[data-theme="magazine"] .hero-panel ul{flex-direction:column;gap:0;counter-reset:mag}
[data-theme="magazine"] .hero-panel li{font-style:normal;font-size:14px;color:#2c2c2c;border-bottom:1px dotted #d6cfc1;padding:6px 0;counter-increment:mag;display:flex;gap:10px;align-items:baseline}
[data-theme="magazine"] .hero-panel li::before{content:counter(mag,decimal-leading-zero);font-family:Georgia,serif;font-style:italic;color:#8b4513;font-size:12px;min-width:24px}
[data-theme="magazine"] .web-hero h1{letter-spacing:-1px;font-size:clamp(28px,4.5vw,48px)}
[data-theme="magazine"] .web-hero h1::first-letter{font-size:1.3em;float:left;line-height:0.8;margin-right:6px;margin-top:4px;color:#8b4513;font-weight:bold}
[data-theme="magazine"] .section-head{grid-template-columns:auto 1fr;gap:0 12px;align-items:baseline}
[data-theme="magazine"] .section-head>p:first-child{font-family:Georgia,serif;font-size:14px;color:#8b4513;border:1px solid #8b4513;border-radius:50%;width:28px;height:28px;line-height:26px;text-align:center;padding:0;flex-shrink:0}
[data-theme="magazine"] .section-head h2{font-size:clamp(20px,3vw,28px);border-bottom:1px solid #d6cfc1;padding-bottom:6px}
[data-theme="magazine"] .subsection-head{border-left-color:#8b4513}
[data-theme="magazine"] .subsection-head h3{font-family:Georgia,serif;font-size:16px;font-weight:700;color:#8b4513;font-style:italic}
[data-theme="magazine"] .subsection-body{border-left:1px solid #d6cfc1;margin-left:2px}
[data-theme="magazine"] .subsection-body p{color:#6b6b6b}
[data-theme="magazine"] .card-grid{grid-template-columns:1fr 1fr;gap:0}
[data-theme="magazine"] .web-card{border:none;border-bottom:1px solid #d6cfc1;border-radius:0;box-shadow:none;background:none;padding:20px 16px}
[data-theme="magazine"] .web-card:nth-child(odd){border-right:1px solid #d6cfc1}
[data-theme="magazine"] .web-card:hover{transform:none;background:rgba(139,69,19,0.02)}
[data-theme="magazine"] .web-card h3{font-style:italic}
[data-theme="magazine"] .steps{grid-template-columns:1fr;gap:0}
[data-theme="magazine"] .step{border:none;border-bottom:1px solid #d6cfc1;border-radius:0;background:none;box-shadow:none;padding:20px 0;display:grid;grid-template-columns:40px 1fr;gap:8px 16px;align-items:start}
[data-theme="magazine"] .step>span.step-num{grid-row:1/3}
[data-theme="magazine"] .step h3{grid-column:2;grid-row:1}
[data-theme="magazine"] .step p{grid-column:2;grid-row:2}
[data-theme="magazine"] .step>span.step-num{background:none;color:#8b4513;border:none;border-radius:0;font-family:Georgia,serif;font-size:28px;line-height:1;width:auto;height:auto}
[data-theme="magazine"] .step h3{font-style:italic}
[data-theme="magazine"] .insight-note{font-style:italic;border-left:4px solid #8b4513}
[data-theme="magazine"] .insight-note>span{font-style:normal}
[data-theme="magazine"] .faq-list details{border:none;border-bottom:1px solid #d6cfc1;border-radius:0;background:none}
[data-theme="magazine"] .faq-list summary{font-style:italic;font-size:17px}
[data-theme="magazine"] .faq-list summary::after{font-size:20px}

/* ═══════════════════════════════════════════════
   主题 3: 新粗野 Neo-Brutalism
   The Verge · 粗黑描边+高饱和撞色+硬投影+hover翻转
   ═══════════════════════════════════════════════ */
[data-theme="neo-brutalism"]{
  --bg-primary:#F8F8F8;--bg-secondary:#fff;--bg-tertiary:#f0f0f0;
  --text-primary:#08080D;--text-secondary:#555;
  --border-color:#08080D;
  --accent:#5200FF;--accent-light:#7B3BFF;--accent-dark:#3A00B8;
  --accent-5:rgba(82,0,255,0.05);--accent-10:rgba(82,0,255,0.10);
  --accent-12:rgba(82,0,255,0.12);--accent-20:rgba(82,0,255,0.20);
  --em-color:#E1306C;--code-bg:#08080D;--code-inline-color:#F8E000;
  --meta-bg:#F8E000;--panel-bg:#F8E000;--card-bg:#fff;
  --insight-bg:#F8E000;--card-shadow:4px 4px 0 #08080D;
  --card-hover-shadow:6px 6px 0 #5200FF;--card-radius:2px;
  --font-body:'Space Grotesk','Noto Sans SC',sans-serif;
  --font-heading:'Space Grotesk','Noto Sans SC',sans-serif;
  --font-mono:'Geist Mono','Fira Code',monospace;
}
[data-theme="neo-brutalism"] .web-hero h1{display:inline-block;background:#5200FF;color:#fff;padding:8px 20px;font-size:clamp(32px,6vw,56px);font-weight:700;letter-spacing:-1px;box-shadow:6px 6px 0 #E1306C}
[data-theme="neo-brutalism"] .hero-summary{font-size:18px;font-weight:500;color:#08080D;border:none;max-width:560px}
[data-theme="neo-brutalism"] .hero-meta span{border:2px solid #08080D;border-radius:2px;background:#fff;box-shadow:2px 2px 0 #08080D;font-weight:600;font-size:12px}
[data-theme="neo-brutalism"] .hero-panel{border:3px solid #08080D;box-shadow:6px 6px 0 #5200FF;background:#F8E000;border-radius:2px}
[data-theme="neo-brutalism"] .hero-panel h2{color:#08080D}
[data-theme="neo-brutalism"] .hero-panel li::before{color:#08080D}
[data-theme="neo-brutalism"] .web-section{border-top:3px solid #08080D}
[data-theme="neo-brutalism"] .section-head>p:first-child{background:#F8E000;border:2px solid #08080D;box-shadow:3px 3px 0 #08080D;padding:2px 8px;width:auto;height:auto;line-height:1.4;border-radius:2px;font-size:12px}
[data-theme="neo-brutalism"] .section-head h2{font-size:clamp(26px,4vw,40px);font-weight:700;letter-spacing:-0.5px}
[data-theme="neo-brutalism"] .subsection-head{border-left:4px solid #5200FF}
[data-theme="neo-brutalism"] .subsection-head h3{font-size:20px;font-weight:700;color:#08080D;letter-spacing:-0.3px}
[data-theme="neo-brutalism"] .subsection-body{border-left:2px solid rgba(82,0,255,0.2);margin-left:2px}
[data-theme="neo-brutalism"] .web-card{border:3px solid #08080D;box-shadow:4px 4px 0 #08080D;border-radius:2px;background:#fff}
[data-theme="neo-brutalism"] .web-card:hover{transform:translate(2px,-2px);box-shadow:6px 6px 0 #5200FF;background:#5200FF;color:#fff}
[data-theme="neo-brutalism"] .web-card:hover h3{color:#F8E000}
[data-theme="neo-brutalism"] .web-card:hover p{color:#fff}
[data-theme="neo-brutalism"] .web-card h3{font-size:18px;font-weight:700;color:#5200FF}
[data-theme="neo-brutalism"] .step{border:3px solid #08080D;box-shadow:4px 4px 0 #08080D;border-radius:2px}
[data-theme="neo-brutalism"] .step>span.step-num{background:#F8E000;color:#08080D;border:2px solid #08080D;border-radius:2px;box-shadow:2px 2px 0 #08080D}
[data-theme="neo-brutalism"] .insight-note{background:#F8E000;border:3px solid #08080D;border-left:4px solid #08080D;box-shadow:4px 4px 0 #5200FF;border-radius:2px}
[data-theme="neo-brutalism"] .insight-note>span{color:#08080D}
[data-theme="neo-brutalism"] .faq-list details{border:3px solid #08080D;border-radius:2px;box-shadow:3px 3px 0 #08080D;background:#fff}
[data-theme="neo-brutalism"] .faq-list summary::after{color:#5200FF}
[data-theme="neo-brutalism"] .faq-list details[open]{box-shadow:6px 6px 0 #E1306C}
[data-theme="neo-brutalism"] .split-grid{gap:0}
[data-theme="neo-brutalism"] .mini-grid article{border:3px solid #08080D;box-shadow:3px 3px 0 #08080D;border-radius:2px;background:#fff}
[data-theme="neo-brutalism"] .text-panel pre{border:3px solid #08080D;border-radius:2px;box-shadow:4px 4px 0 #5200FF}
[data-theme="neo-brutalism"] .text-panel code{border-radius:2px;border:2px solid #08080D}
[data-theme="neo-brutalism"] .text-panel th{border:2px solid #08080D;background:#5200FF;color:#fff}
[data-theme="neo-brutalism"] .text-panel td{border:2px solid #08080D}
/* 新粗野·语义增强 */
[data-theme="neo-brutalism"] .time-badge{background:#F8E000;border:2px solid #08080D;box-shadow:3px 3px 0 #08080D;border-radius:2px;color:#08080D;font-weight:700;padding:4px 10px}
[data-theme="neo-brutalism"] .time-badge span{color:#08080D;margin:0 4px}
[data-theme="neo-brutalism"] .meta-row{border-color:#08080D;border-bottom:2px solid #08080D}
[data-theme="neo-brutalism"] .meta-label{color:#08080D;background:#F8E000;border:2px solid #08080D;box-shadow:2px 2px 0 #08080D;padding:2px 6px;border-radius:2px;font-size:10px;min-width:auto}
[data-theme="neo-brutalism"] .meta-value{color:#08080D;font-weight:500}
[data-theme="neo-brutalism"] .tool-item{border:2px solid #08080D;box-shadow:2px 2px 0 #08080D;border-radius:2px;background:#fff;padding:4px 8px}
[data-theme="neo-brutalism"] .tool-name{color:#08080D;font-weight:500}
[data-theme="neo-brutalism"] .tool-count{color:#5200FF;font-weight:800}
[data-theme="neo-brutalism"] .file-list>li{border-bottom:2px solid #08080D}
[data-theme="neo-brutalism"] .file-tag{border:2px solid #08080D;border-radius:2px;padding:1px 4px;font-weight:800}
[data-theme="neo-brutalism"] .file-dir{background:#F8E000;color:#08080D}
[data-theme="neo-brutalism"] .file-file{background:#E1306C;color:#fff}
[data-theme="neo-brutalism"] .file-val{background:#5200FF;color:#fff}
[data-theme="neo-brutalism"] .file-path{color:#08080D;font-weight:500}
[data-theme="neo-brutalism"] .file-change{border-left:4px solid #5200FF;background:#F8E000;padding:4px 8px;border-radius:2px;color:#08080D;margin-left:0}
[data-theme="neo-brutalism"] .file-change-label{color:#5200FF;font-weight:800}
[data-theme="neo-brutalism"] .section-subhead{color:#08080D;background:#F8E000;border:2px solid #08080D;box-shadow:3px 3px 0 #08080D;border-radius:2px;padding:4px 8px;display:inline-block}
[data-theme="neo-brutalism"] .chat-timeline::before{background:#08080D;width:3px}
[data-theme="neo-brutalism"] .chat-msg::before{background:#5200FF;border:2px solid #08080D;width:14px;height:14px}
[data-theme="neo-brutalism"] .chat-msg.assistant::before{background:#E1306C}
[data-theme="neo-brutalism"] .chat-msg.user .chat-bubble{background:#fff;border:2px solid #08080D;box-shadow:3px 3px 0 #5200FF;border-radius:2px 2px 2px 0}
[data-theme="neo-brutalism"] .chat-msg.assistant .chat-bubble{background:#fff;border:2px solid #08080D;box-shadow:3px 3px 0 #E1306C;border-radius:2px 2px 0 2px}
[data-theme="neo-brutalism"] .chat-meta{background:#08080D;color:#F8E000;border:2px solid #08080D;border-radius:2px;font-family:'Courier New',monospace}
[data-theme="neo-brutalism"] .chat-role{color:#5200FF;font-weight:800}
[data-theme="neo-brutalism"] .chat-msg.assistant .chat-role{color:#E1306C}
[data-theme="neo-brutalism"] .chat-tool-group{border:2px solid #08080D;box-shadow:2px 2px 0 #5200FF;border-radius:2px;background:#fff}
[data-theme="neo-brutalism"] .chat-tool-group summary{color:#5200FF;font-weight:700;font-family:'Courier New',monospace}
[data-theme="neo-brutalism"] .chat-tool-group summary:hover{background:#F8E000}
[data-theme="neo-brutalism"] .chat-tool-group pre{background:#08080D;border-top:2px solid #08080D}
[data-theme="neo-brutalism"] .chat-tool-group pre code{color:#F8E000}
[data-theme="neo-brutalism"] .text-panel pre code{color:var(--code-inline-color)}
[data-theme="neo-brutalism"] .chat-btn{border:2px solid #08080D;box-shadow:2px 2px 0 #5200FF;border-radius:2px;background:#fff;color:#08080D;font-weight:700;font-family:'Courier New',monospace}
[data-theme="neo-brutalism"] .meta-line{border-bottom:2px solid #08080D}
[data-theme="neo-brutalism"] .dot-nav .dot{border-radius:0;width:8px;height:8px;border:2px solid #08080D}
[data-theme="neo-brutalism"] .dot-nav a.active .dot{background:#5200FF;border-color:#08080D;box-shadow:2px 2px 0 #08080D}

/* ═══════════════════════════════════════════════
   主题 4: 瑞士黑白 Swiss Mono
   Vercel · 纯黑白+Geist+锐利直角+精密栅格
   ═══════════════════════════════════════════════ */
[data-theme="swiss-mono"]{
  --bg-primary:#ffffff;--bg-secondary:#fafafa;--bg-tertiary:#f0f0f0;
  --text-primary:#000000;--text-secondary:#888888;
  --border-color:#e8e8e8;
  --accent:#000000;--accent-light:#333333;--accent-dark:#000000;
  --accent-5:rgba(0,0,0,0.03);--accent-10:rgba(0,0,0,0.06);
  --accent-12:rgba(0,0,0,0.08);--accent-20:rgba(0,0,0,0.12);
  --em-color:#666666;--code-bg:#f5f5f5;--code-inline-color:#000;
  --meta-bg:transparent;--panel-bg:transparent;--card-bg:transparent;
  --insight-bg:transparent;--card-shadow:none;--card-hover-shadow:none;
  --card-radius:0px;
  --font-body:'Geist','Inter','Noto Sans SC',-apple-system,system-ui,sans-serif;
  --font-heading:'Geist','Inter','Noto Sans SC',sans-serif;
  --font-mono:'Geist Mono','SF Mono','Fira Code',monospace;
}
[data-theme="swiss-mono"] .web-hero{grid-template-columns:1fr;min-height:280px;padding:60px 0 40px;border-bottom:1px solid #e8e8e8}
[data-theme="swiss-mono"] .hero-copy{align-items:flex-start}
[data-theme="swiss-mono"] .eyebrow{font-family:'Geist Mono',monospace;font-size:11px;color:#888;letter-spacing:1px}
[data-theme="swiss-mono"] .web-hero h1{font-size:clamp(32px,5vw,56px);font-weight:700;letter-spacing:-1.5px;line-height:1.05;margin:16px 0;color:#000}
[data-theme="swiss-mono"] .hero-summary{font-size:16px;color:#888;font-weight:400;max-width:520px}
[data-theme="swiss-mono"] .hero-meta span{border:none;background:none;font-size:11px;color:#888;font-family:'Geist Mono',monospace;letter-spacing:0.5px;border-radius:0;padding:0}
[data-theme="swiss-mono"] .hero-panel{border:1px solid #000;background:none;box-shadow:none;border-radius:0;padding:0;display:grid;grid-template-columns:repeat(2,1fr);gap:0;counter-reset:swisstable}
[data-theme="swiss-mono"] .hero-panel h2{display:none}
[data-theme="swiss-mono"] .hero-panel ul{display:contents}
[data-theme="swiss-mono"] .hero-panel li{font-size:12px;color:#555;font-weight:500;padding:12px 16px;border-right:1px solid #e8e8e8;border-bottom:1px solid #e8e8e8;font-family:'Geist Mono',monospace;letter-spacing:0.5px;counter-increment:swisstable;display:block}
[data-theme="swiss-mono"] .hero-panel li:nth-child(2n){border-right:none}
[data-theme="swiss-mono"] .hero-panel li:nth-last-child(-n+2){border-bottom:none}
[data-theme="swiss-mono"] .hero-panel li::before{content:counter(swisstable,decimal-leading-zero) '/  ';color:#ccc;margin-right:4px}
[data-theme="swiss-mono"] .web-section{border-top:1px solid #f0f0f0;padding:48px 0}
[data-theme="swiss-mono"] .section-head{grid-template-columns:1fr;gap:4px;margin-bottom:32px;text-align:right}
[data-theme="swiss-mono"] .section-head>p:first-child{font-family:'Geist Mono',monospace;font-size:11px;color:#ccc;padding:0;border:none;width:auto;text-transform:uppercase;letter-spacing:1px}
[data-theme="swiss-mono"] .section-head>p:first-child::before{content:'\\25B8 '}
[data-theme="swiss-mono"] .section-head h2{font-size:clamp(22px,3.5vw,34px);font-weight:700;letter-spacing:-0.5px;text-align:right}
[data-theme="swiss-mono"] .subsection-head{border-left:2px solid #000}
[data-theme="swiss-mono"] .subsection-head h3{font-family:'Geist Mono',monospace;font-size:16px;font-weight:700;color:#000;letter-spacing:-0.3px}
[data-theme="swiss-mono"] .subsection-body{border-left:1px solid #e8e8e8;margin-left:2px}
[data-theme="swiss-mono"] .subsection-body p{color:#888}
[data-theme="swiss-mono"] .card-grid{grid-template-columns:1fr;gap:0}
[data-theme="swiss-mono"] .web-card{border:none;border-bottom:1px solid #e8e8e8;border-radius:0;background:none;box-shadow:none;padding:24px 0;display:grid;grid-template-columns:200px 1fr;gap:32px;align-items:start}
[data-theme="swiss-mono"] .web-card:hover{transform:none;border-bottom-color:#000}
[data-theme="swiss-mono"] .web-card h3{font-size:14px;font-weight:600;color:#000}
[data-theme="swiss-mono"] .web-card p{font-size:14px;color:#888}
[data-theme="swiss-mono"] .steps{grid-template-columns:1fr;gap:0}
[data-theme="swiss-mono"] .step{border:none;border-left:1px solid #e8e8e8;border-radius:0;background:none;box-shadow:none;padding:20px 0 20px 24px}
[data-theme="swiss-mono"] .step>span.step-num{background:none;color:#000;border:1px solid #000;border-radius:0;width:24px;height:24px;line-height:22px;font-size:11px;font-family:'Geist Mono',monospace}
[data-theme="swiss-mono"] .step h3{font-size:15px;font-weight:600}
[data-theme="swiss-mono"] .insight-note{background:none;border:1px solid #e8e8e8;border-left:2px solid #000;border-radius:0}
[data-theme="swiss-mono"] .insight-note>span{color:#000}
[data-theme="swiss-mono"] .faq-list details{border:none;border-bottom:1px solid #e8e8e8;border-radius:0;background:none}
[data-theme="swiss-mono"] .faq-list summary{font-size:15px;font-weight:500}
[data-theme="swiss-mono"] .faq-list summary::after{color:#888;font-size:16px}
[data-theme="swiss-mono"] .faq-list details[open] summary::after{color:#000}
[data-theme="swiss-mono"] .split-grid{grid-template-columns:1fr;gap:0;border-top:1px solid #f0f0f0;padding-top:24px}
[data-theme="swiss-mono"] .mini-grid{gap:0}
[data-theme="swiss-mono"] .mini-grid article{border:none;border-bottom:1px solid #e8e8e8;border-radius:0;background:none;padding:16px 0}
[data-theme="swiss-mono"] .text-panel pre{border:none;border-left:1px solid #e8e8e8;border-radius:0}
[data-theme="swiss-mono"] .text-panel code{border-radius:0;background:#f5f5f5;border:none}
[data-theme="swiss-mono"] .text-panel th{background:none;border:none;border-bottom:2px solid #000;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;color:#000}
[data-theme="swiss-mono"] .text-panel td{border:none;border-bottom:1px solid #f0f0f0}
[data-theme="swiss-mono"] .text-panel tr:nth-child(even){background:none}
[data-theme="swiss-mono"] .text-panel strong{color:#000}
[data-theme="swiss-mono"] .dot-nav .dot{border-radius:0;width:2px;height:12px;border:1px solid #e0e0e0}
[data-theme="swiss-mono"] .dot-nav a.active .dot{background:#000;border-color:#000;box-shadow:none}
/* 瑞士黑白·语义增强 */
[data-theme="swiss-mono"] .time-badge{background:none;border:none;border-top:1px solid #000;border-bottom:1px solid #000;border-radius:0;color:#000;font-family:'Geist Mono',monospace;font-size:12px;padding:2px 0;letter-spacing:1px}
[data-theme="swiss-mono"] .time-badge span{color:#ccc;margin:0 6px}
[data-theme="swiss-mono"] .meta-row{border-color:#f0f0f0;border-bottom:1px solid #f0f0f0}
[data-theme="swiss-mono"] .meta-label{color:#000;font-family:'Geist Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:1px;min-width:120px}
[data-theme="swiss-mono"] .meta-value{color:#000;font-size:14px}
[data-theme="swiss-mono"] .meta-row .meta-value code{padding:0 4px}
[data-theme="swiss-mono"] .tool-grid{grid-template-columns:1fr;gap:0;border-top:1px solid #f0f0f0}
[data-theme="swiss-mono"] .tool-item{background:none;border:none;border-bottom:1px solid #f0f0f0;border-radius:0;padding:6px 0;display:flex;justify-content:space-between}
[data-theme="swiss-mono"] .tool-name{color:#000;font-family:'Geist Mono',monospace;font-size:12px;text-transform:lowercase}
[data-theme="swiss-mono"] .tool-count{color:#000;font-family:'Geist Mono',monospace;font-size:12px;font-weight:600}
[data-theme="swiss-mono"] .file-list>li{border-bottom:1px solid #f0f0f0}
[data-theme="swiss-mono"] .file-tag{font-family:'Geist Mono',monospace;background:none;border:none;padding:0 4px 0 0;font-size:10px}
[data-theme="swiss-mono"] .file-dir{color:#000}
[data-theme="swiss-mono"] .file-file{color:#000}
[data-theme="swiss-mono"] .file-val{color:#000}
[data-theme="swiss-mono"] .file-path{color:#000;font-family:'Geist Mono',monospace;font-size:12px}
[data-theme="swiss-mono"] .file-change{border-left:1px solid #000;color:#888;margin-left:0;font-family:'Geist Mono',monospace;font-size:12px}
[data-theme="swiss-mono"] .file-change-label{color:#000;font-weight:600}
[data-theme="swiss-mono"] .section-subhead{color:#000;font-family:'Geist Mono',monospace;font-size:11px;letter-spacing:1px;border-color:#f0f0f0;border-top:1px solid #000;padding-top:8px}
[data-theme="swiss-mono"] .chat-timeline::before{background:#000;width:1px}
[data-theme="swiss-mono"] .chat-msg::before{background:#000;border-color:#fff;width:8px;height:8px}
[data-theme="swiss-mono"] .chat-msg.assistant::before{background:#666}
[data-theme="swiss-mono"] .chat-msg.user .chat-bubble{background:#f5f5f5;border:1px solid #000;border-radius:0}
[data-theme="swiss-mono"] .chat-msg.assistant .chat-bubble{background:#fff;border:1px solid #000;border-radius:0}
[data-theme="swiss-mono"] .chat-meta{background:#f5f5f5;color:#666;border:1px solid #e0e0e0;border-radius:0;font-family:'Geist Mono',monospace}
[data-theme="swiss-mono"] .chat-role{color:#000;font-weight:600}
[data-theme="swiss-mono"] .chat-msg.assistant .chat-role{color:#666}
[data-theme="swiss-mono"] .chat-tool-group{border:1px solid #000;border-radius:0;background:#f5f5f5}
[data-theme="swiss-mono"] .chat-tool-group summary{color:#000;font-family:'Geist Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
[data-theme="swiss-mono"] .chat-tool-group summary:hover{background:#000;color:#fff}
[data-theme="swiss-mono"] .chat-tool-group pre{background:#f5f5f5;border-top:1px solid #000}
[data-theme="swiss-mono"] .chat-tool-group pre code{color:#333;font-family:'Geist Mono',monospace}
[data-theme="swiss-mono"] .chat-btn{border:1px solid #000;border-radius:0;background:#f5f5f5;color:#000;font-family:'Geist Mono',monospace;font-size:11px}
[data-theme="swiss-mono"] .meta-line{border-bottom:1px solid #e0e0e0;font-family:'Geist Mono',monospace}
[data-theme="swiss-mono"] .dot-nav .dot-label{font-size:10px;letter-spacing:0.5px;font-family:'Geist Mono',monospace}

/* ═══ 底部进度栏 ═══ */
.bottom-bar{position:fixed;bottom:0;left:0;right:0;z-index:10000;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 20px 6px;border-top:1px solid var(--border-color);font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);transition:left .2s}
.bottom-bar .bb-left{display:flex;gap:12px;align-items:center;flex-shrink:0}
.bottom-bar .bb-center{flex:1;text-align:center;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bottom-bar .bb-right{display:flex;gap:8px;align-items:center;flex-shrink:0}
.bottom-bar .bb-progress-wrap{position:absolute;bottom:0;left:0;right:0;height:3px;background:var(--border-color);overflow:hidden}
.bottom-bar .bb-progress{height:100%;width:0%;background:var(--accent);transition:width .15s}

/* ═══════════════════════════════════════════════
   H4+ subheading 缩进容器（方案C）
   ═══════════════════════════════════════════════ */

/* 极光·sub-block */
[data-theme="aurora-glass"] .sub-block{margin:12px 0;padding:12px 16px;background:rgba(100,255,218,0.03);border-left:2px solid rgba(100,255,218,0.4);border-radius:0 4px 4px 0}
[data-theme="aurora-glass"] .sub-block-title{font-size:14px;font-weight:600;color:#a0aec0;margin-bottom:6px;letter-spacing:0.5px}
[data-theme="aurora-glass"] .sub-block-title::before{content:'';display:inline-block;width:5px;height:5px;background:rgba(100,255,218,0.4);border-radius:50%;margin-right:8px;vertical-align:middle}
[data-theme="aurora-glass"] .sub-block-content{padding-left:14px}
[data-theme="aurora-glass"] .sub-block-content p{margin:6px 0;font-size:14px;line-height:1.7;color:#a0aec0}
[data-theme="aurora-glass"] .sub-block-content li{margin:3px 0;font-size:14px;line-height:1.6;color:#a0aec0}
[data-theme="aurora-glass"] .sub-block-content code{background:rgba(100,255,218,0.10);padding:2px 6px;border-radius:4px;font-size:0.86em;color:#64ffda;font-family:var(--font-mono)}
[data-theme="aurora-glass"] .sub-block-content strong{color:#ff6b9d;font-weight:600}

/* 杂志·sub-block */
[data-theme="magazine"] .sub-block{margin:12px 0;padding:12px 16px;background:rgba(139,69,19,0.02);border-left:2px solid rgba(139,69,19,0.4);border-radius:0}
[data-theme="magazine"] .sub-block-title{font-family:Georgia,serif;font-size:14px;font-weight:600;color:#6b6b6b;margin-bottom:6px;font-style:italic}
[data-theme="magazine"] .sub-block-title::before{content:'§';margin-right:6px;color:#999;font-style:normal}
[data-theme="magazine"] .sub-block-content{padding-left:14px}
[data-theme="magazine"] .sub-block-content p{margin:6px 0;font-size:14px;line-height:1.7;color:#6b6b6b}
[data-theme="magazine"] .sub-block-content li{margin:3px 0;font-size:14px;line-height:1.6;color:#6b6b6b}
[data-theme="magazine"] .sub-block-content code{background:#f0ece4;padding:2px 6px;border-radius:2px;font-size:0.86em;color:#8b4513;font-family:'Courier New',monospace}
[data-theme="magazine"] .sub-block-content strong{color:#5b7c5b;font-weight:600}

/* 新粗野·sub-block */
[data-theme="neo-brutalism"] .sub-block{margin:12px 0;padding:12px 16px;background:rgba(82,0,255,0.03);border-left:2px solid rgba(82,0,255,0.4);border-radius:0 2px 2px 0}
[data-theme="neo-brutalism"] .sub-block-title{font-size:14px;font-weight:600;color:#555;margin-bottom:6px;display:flex;align-items:center;gap:6px}
[data-theme="neo-brutalism"] .sub-block-title::before{content:'';display:inline-block;width:5px;height:5px;background:rgba(82,0,255,0.3);border:1px solid #08080D;border-radius:0;flex-shrink:0}
[data-theme="neo-brutalism"] .sub-block-content{padding-left:12px}
[data-theme="neo-brutalism"] .sub-block-content p{margin:6px 0;font-size:14px;line-height:1.7;color:#555}
[data-theme="neo-brutalism"] .sub-block-content li{margin:3px 0;font-size:14px;line-height:1.6;color:#555}
[data-theme="neo-brutalism"] .sub-block-content code{background:#08080D;padding:2px 6px;border-radius:4px;font-size:0.86em;color:#F8E000;font-family:var(--font-mono)}
[data-theme="neo-brutalism"] .sub-block-content strong{color:#E1306C;font-weight:600}

/* 瑞士黑白·sub-block */
[data-theme="swiss-mono"] .sub-block{margin:12px 0;padding:10px 16px;background:rgba(0,0,0,0.02);border-left:1px solid #ccc;border-radius:0}
[data-theme="swiss-mono"] .sub-block-title{font-size:13px;font-weight:600;color:#888;margin-bottom:6px;letter-spacing:1px}
[data-theme="swiss-mono"] .sub-block-title::before{content:'';display:inline-block;width:6px;height:1px;background:#ccc;margin-right:8px;vertical-align:middle}
[data-theme="swiss-mono"] .sub-block-content{padding-left:12px}
[data-theme="swiss-mono"] .sub-block-content p{margin:6px 0;font-size:14px;line-height:1.7;color:#888}
[data-theme="swiss-mono"] .sub-block-content li{margin:3px 0;font-size:14px;line-height:1.6;color:#888}
[data-theme="swiss-mono"] .sub-block-content code{background:#f5f5f5;padding:2px 6px;border-radius:2px;font-size:0.86em;color:#000;font-family:var(--font-mono)}
[data-theme="swiss-mono"] .sub-block-content strong{color:#000;font-weight:600}

/* ═══════════════════════════════════════════════
   新增样式：task-list / nested-list / stat-line / tool-ref / btn-ref / comment-marker / multi-quotes
   ═══════════════════════════════════════════════ */

/* ── 极光主题 ── */
[data-theme="aurora-glass"] .task-list{list-style:none;margin-left:0;padding:0}
[data-theme="aurora-glass"] .task-list li{padding-left:28px;position:relative;font-size:14px;margin:4px 0;color:#a0aec0}
[data-theme="aurora-glass"] .task-list .task-check{position:absolute;left:0;top:1px;width:18px;height:18px;border:1.5px solid rgba(100,255,218,0.4);border-radius:4px;background:rgba(30,30,66,0.5)}
[data-theme="aurora-glass"] .task-list li.done{color:#6a737d;text-decoration:line-through;text-decoration-color:#ff6b9d}
[data-theme="aurora-glass"] .task-list li.done .task-check{background:#64ffda;border-color:#64ffda}
[data-theme="aurora-glass"] .task-list li.done .task-check::after{content:'✓';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#0f0c29;font-size:12px;font-weight:800}
[data-theme="aurora-glass"] .nested-list > li > ul{margin:4px 0 4px 20px;padding-left:12px;border-left:1px solid rgba(100,255,218,0.2)}
[data-theme="aurora-glass"] .nested-list > li > ul > li{font-size:13px;color:#a0aec0}
[data-theme="aurora-glass"] .stat-line{font-family:var(--font-mono);font-size:12px;color:#a0aec0;background:rgba(100,255,218,0.03);padding:4px 10px;border-left:2px solid #64ffda;margin:2px 0;border-radius:0 4px 4px 0}
[data-theme="aurora-glass"] .tool-ref{display:inline-flex;align-items:center;gap:3px;background:rgba(100,255,218,0.08);border:1px solid rgba(100,255,218,0.25);padding:1px 7px;border-radius:4px;font-size:12px;font-family:var(--font-mono);color:#64ffda}
[data-theme="aurora-glass"] .btn-ref{display:inline-block;background:rgba(30,30,66,0.6);border:1px solid rgba(255,255,255,0.2);padding:2px 10px;font-size:12px;font-weight:600;color:#e2e8f0;border-radius:6px;margin:2px 4px 2px 0}
[data-theme="aurora-glass"] .comment-marker{text-align:center;font-size:11px;font-family:var(--font-mono);color:#6a737d;background:repeating-linear-gradient(90deg,transparent,transparent 4px,rgba(100,255,218,0.06) 4px,rgba(100,255,218,0.06) 8px);padding:4px;margin:8px 0;border-radius:4px}
[data-theme="aurora-glass"] .multi-quotes blockquote{margin:6px 0;padding:10px 16px;border-left:3px solid #64ffda;background:rgba(100,255,218,0.04);color:#a0aec0;font-style:italic;font-size:14px;border-radius:0 6px 6px 0}
[data-theme="aurora-glass"] .multi-quotes blockquote:nth-child(2){border-left-color:#ff6b9d;background:rgba(255,107,157,0.04)}
[data-theme="aurora-glass"] .multi-quotes blockquote:nth-child(3){border-left-color:#80ffea;background:rgba(128,255,234,0.03)}

/* ── 杂志主题 ── */
[data-theme="magazine"] .task-list{list-style:none;margin-left:0;padding:0}
[data-theme="magazine"] .task-list li{padding-left:28px;position:relative;font-size:14px;margin:4px 0;color:#6b6b6b;font-family:Georgia,serif}
[data-theme="magazine"] .task-list .task-check{position:absolute;left:0;top:2px;width:16px;height:16px;border:1px solid #8b4513;border-radius:0;background:#f5f1ea}
[data-theme="magazine"] .task-list li.done{color:#999;text-decoration:line-through;text-decoration-color:#8b4513;font-style:italic}
[data-theme="magazine"] .task-list li.done .task-check{background:#8b4513}
[data-theme="magazine"] .task-list li.done .task-check::after{content:'✓';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#f5f1ea;font-size:11px;font-weight:700}
[data-theme="magazine"] .nested-list > li > ul{margin:4px 0 4px 18px;padding-left:12px;border-left:1px solid #d6cfc1}
[data-theme="magazine"] .nested-list > li > ul > li{font-size:13px;color:#6b6b6b;font-style:italic}
[data-theme="magazine"] .stat-line{font-family:'Courier New',monospace;font-size:12px;color:#6b6b6b;background:rgba(139,69,19,0.03);padding:4px 10px;border-left:2px solid #8b4513;margin:2px 0}
[data-theme="magazine"] .tool-ref{display:inline-flex;align-items:center;gap:3px;background:rgba(139,69,19,0.06);border:1px solid #8b4513;padding:1px 7px;font-size:12px;font-family:'Courier New',monospace;color:#8b4513}
[data-theme="magazine"] .btn-ref{display:inline-block;background:#f5f1ea;border:1px solid #8b4513;padding:2px 10px;font-size:13px;font-weight:600;color:#2c2c2c;margin:2px 4px 2px 0;font-family:Georgia,serif}
[data-theme="magazine"] .comment-marker{text-align:center;font-size:11px;font-family:'Courier New',monospace;color:#8a7050;background:repeating-linear-gradient(90deg,transparent,transparent 4px,rgba(139,69,19,0.04) 4px,rgba(139,69,19,0.04) 8px);padding:4px;margin:8px 0}
[data-theme="magazine"] .multi-quotes blockquote{margin:6px 0;padding:10px 16px;border-left:2px solid #8b4513;background:rgba(139,69,19,0.04);color:#6b6b6b;font-style:italic;font-size:15px;font-family:Georgia,serif}
[data-theme="magazine"] .multi-quotes blockquote:nth-child(2){border-left-color:#5b7c5b;background:rgba(91,124,91,0.04)}
[data-theme="magazine"] .multi-quotes blockquote:nth-child(3){border-left-color:#a0522d;background:rgba(160,82,45,0.03)}

/* ── 新粗野（卡通）主题 ── */
[data-theme="neo-brutalism"] .task-list{list-style:none;margin-left:0;padding:0}
[data-theme="neo-brutalism"] .task-list li{padding-left:30px;position:relative;font-size:14px;margin:4px 0;color:#08080D}
[data-theme="neo-brutalism"] .task-list .task-check{position:absolute;left:0;top:1px;width:18px;height:18px;border:2px solid #08080D;border-radius:2px;background:#fff;box-shadow:2px 2px 0 #08080D}
[data-theme="neo-brutalism"] .task-list li.done{color:#555;text-decoration:line-through;text-decoration-color:#E1306C}
[data-theme="neo-brutalism"] .task-list li.done .task-check{background:#5200FF;border-color:#08080D}
[data-theme="neo-brutalism"] .task-list li.done .task-check::after{content:'✓';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:800}
[data-theme="neo-brutalism"] .nested-list > li > ul{margin:4px 0 4px 20px;padding-left:12px;border-left:2px solid rgba(82,0,255,0.2)}
[data-theme="neo-brutalism"] .nested-list > li > ul > li{font-size:13px;color:#555}
[data-theme="neo-brutalism"] .stat-line{font-family:var(--font-mono);font-size:12px;color:#08080D;background:rgba(248,224,0,0.08);padding:4px 10px;border-left:3px solid #5200FF;margin:2px 0;border-radius:0 2px 2px 0}
[data-theme="neo-brutalism"] .tool-ref{display:inline-flex;align-items:center;gap:3px;background:#fff;border:2px solid #08080D;box-shadow:2px 2px 0 #5200FF;padding:1px 8px;font-size:12px;font-family:var(--font-mono);color:#5200FF;font-weight:600;border-radius:2px}
[data-theme="neo-brutalism"] .btn-ref{display:inline-block;background:#fff;border:2px solid #08080D;box-shadow:2px 2px 0 #5200FF;padding:2px 10px;font-size:12px;font-weight:600;color:#08080D;border-radius:2px;margin:2px 4px 2px 0}
[data-theme="neo-brutalism"] .comment-marker{text-align:center;font-size:11px;font-family:var(--font-mono);color:#555;background:repeating-linear-gradient(90deg,#f0f0f0,#f0f0f0 4px,transparent 4px,transparent 8px);padding:4px;margin:8px 0;border-top:2px solid #08080D;border-bottom:2px solid #08080D}
[data-theme="neo-brutalism"] .multi-quotes blockquote{margin:6px 0;padding:10px 16px;border-left:4px solid #5200FF;background:rgba(82,0,255,0.05);color:#08080D;font-style:italic;font-size:14px;border-radius:0 2px 2px 0}
[data-theme="neo-brutalism"] .multi-quotes blockquote:nth-child(2){border-left-color:#E1306C;background:rgba(225,48,108,0.05)}
[data-theme="neo-brutalism"] .multi-quotes blockquote:nth-child(3){border-left-color:#F8E000;background:rgba(248,224,0,0.08)}

/* ── 瑞士黑白主题 ── */
[data-theme="swiss-mono"] .task-list{list-style:none;margin-left:0;padding:0}
[data-theme="swiss-mono"] .task-list li{padding-left:28px;position:relative;font-size:14px;margin:4px 0;color:#000}
[data-theme="swiss-mono"] .task-list .task-check{position:absolute;left:0;top:2px;width:16px;height:16px;border:1.5px solid #000;border-radius:0;background:transparent}
[data-theme="swiss-mono"] .task-list li.done{color:#888;text-decoration:line-through}
[data-theme="swiss-mono"] .task-list li.done .task-check{background:#000}
[data-theme="swiss-mono"] .task-list li.done .task-check::after{content:'✓';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700}
[data-theme="swiss-mono"] .nested-list > li > ul{margin:4px 0 4px 18px;padding-left:12px;border-left:1px solid #e8e8e8}
[data-theme="swiss-mono"] .nested-list > li > ul > li{font-size:13px;color:#888}
[data-theme="swiss-mono"] .stat-line{font-family:var(--font-mono);font-size:11px;color:#888;background:transparent;padding:4px 10px;border-left:2px solid #000;margin:2px 0}
[data-theme="swiss-mono"] .tool-ref{display:inline-flex;align-items:center;gap:3px;background:transparent;border:1px solid #000;padding:1px 7px;font-size:11px;font-family:var(--font-mono);color:#000;text-transform:uppercase;letter-spacing:0.5px}
[data-theme="swiss-mono"] .btn-ref{display:inline-block;background:transparent;border:1px solid #000;padding:2px 10px;font-size:12px;font-weight:600;color:#000;margin:2px 4px 2px 0;letter-spacing:0.5px}
[data-theme="swiss-mono"] .comment-marker{text-align:center;font-size:10px;font-family:var(--font-mono);color:#888;background:#f5f5f5;padding:4px;margin:8px 0;text-transform:uppercase;letter-spacing:1px}
[data-theme="swiss-mono"] .multi-quotes blockquote{margin:6px 0;padding:10px 16px;border-left:2px solid #000;background:#fafafa;color:#888;font-style:italic;font-size:14px}
[data-theme="swiss-mono"] .multi-quotes blockquote:nth-child(2){border-left-color:#888;background:#f0f0f0}
[data-theme="swiss-mono"] .multi-quotes blockquote:nth-child(3){border-left-color:#ccc;background:transparent}

/* 极光·底部栏 */
[data-theme="aurora-glass"] .bottom-bar{background:rgba(15,12,41,0.82);color:#a0aec0}
[data-theme="aurora-glass"] .bottom-bar .bb-progress{background:linear-gradient(90deg,#64ffda,#ff6b9d);box-shadow:0 0 8px rgba(100,255,218,0.4)}
[data-theme="aurora-glass"] .bottom-bar .bb-percent{color:#64ffda;font-weight:700}

/* 杂志·底部栏 */
[data-theme="magazine"] .bottom-bar{background:rgba(250,248,245,0.88);font-family:Georgia,serif;font-style:italic;font-size:12px;color:#6b6b6b}
[data-theme="magazine"] .bottom-bar .bb-progress{background:#8b4513}
[data-theme="magazine"] .bottom-bar .bb-progress-wrap{border-top:1px solid #d6cfc1;height:1px}
[data-theme="magazine"] .bottom-bar .bb-percent{color:#8b4513;font-style:normal;font-weight:700}

/* 新粗野·底部栏 */
[data-theme="neo-brutalism"] .bottom-bar{background:rgba(248,248,248,0.92);font-weight:600;color:#08080D;border-top:3px solid #08080D}
[data-theme="neo-brutalism"] .bottom-bar .bb-progress-wrap{height:6px;border-top:2px solid #08080D}
[data-theme="neo-brutalism"] .bottom-bar .bb-progress{background:#F8E000;border-right:2px solid #08080D;box-shadow:2px 0 0 #5200FF}
[data-theme="neo-brutalism"] .bottom-bar .bb-percent{background:#F8E000;border:2px solid #08080D;padding:1px 6px;box-shadow:2px 2px 0 #08080D;font-weight:800;color:#08080D}

/* 瑞士黑白·底部栏 */
[data-theme="swiss-mono"] .bottom-bar{background:rgba(255,255,255,0.92);font-family:'Geist Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888}
[data-theme="swiss-mono"] .bottom-bar .bb-progress-wrap{height:2px;background:#f0f0f0}
[data-theme="swiss-mono"] .bottom-bar .bb-progress{background:#000}
[data-theme="swiss-mono"] .bottom-bar .bb-percent{color:#000;font-weight:700}
`;
}

var __mdToWebCSS;
if (typeof module !== 'undefined' && module.exports) {
  __mdToWebCSS = { getCss: getCss };
  module.exports = __mdToWebCSS;
}
if (typeof window !== 'undefined') {
  window.__mdToWebCSS = __mdToWebCSS || { getCss: getCss };
}

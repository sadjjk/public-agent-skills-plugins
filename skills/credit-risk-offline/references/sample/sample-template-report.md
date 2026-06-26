# 样本数据报告模板

## 执行约束

> ⚠️ **Agent 必读**：生成报告时，将下方「Markdown 模板」中所有 `{{PLACEHOLDER}}` 替换为真实内容后写入文件。
> 每个占位符都必须替换，禁止遗漏任何一个。写入前自检：文件中不得出现任何 `{{` 或 `}}` 字符串。
> 本文件只负责报告展示规则；字段语义与来源职责统一以 `references/sample/sample.md` 的样本字段与确认卡规则为准。

---

## 报告生成标准步骤

1. 执行 `get --key <key>` 与 `info --key <key>` 获取报告所需基础数据。
2. 优先尝试执行 `monthly --key <key> --format md` 获取按月统计分布；若当前样本缺少 `sample_file_path`、时间列不可用，或当前环境无法稳定提供该子命令输出，则按下文降级规则处理。
3. 完成 Markdown 渲染。
4. 执行 `set_report --key <key>` 登记并获取脚本返回的标准报告路径。
5. 将渲染内容写入该路径。
6. 执行 `status --key <key>` 将样本状态刷新到 `S4`。

---

## 数据来源说明

样本数据报告生成时，统一基于以下命令获取数据：

```bash
$SAMPLE_SCRIPT get --key <key>
$SAMPLE_SCRIPT info --key <key>
$SAMPLE_SCRIPT monthly --key <key> --format md
```

说明：
- `get --key <key>`：用于获取「一、样本定义」所需字段
- `info --key <key>`：用于获取「二、数据概览」「标签分布」「标签修复摘要」所需数据
- `monthly --key <key> --format md`：优先用于获取「三、按月统计分布」内容；仅在样本具备 `sample_file_path`、时间列可用且当前环境能稳定产出月度分布时使用


---

## Markdown 模板

````markdown
# 📊 样本数据报告：{{SAMPLE_DESC_OR_KEY}}

> 生成时间：{{DATETIME}}  |  key: `{{KEY}}`

## 一、样本定义

{{SAMPLE_DEFINITION_TABLE}}

## 二、数据概览

{{SAMPLE_STATS_TABLE}}

### 标签分布

{{LABEL_DISTRIBUTION}}

{{FIX_SUMMARY_SECTION}}

## 三、按月统计分布

{{MONTHLY_STATS}}

## 四、关键发现

{{KEY_FINDINGS}}
````

---

## 占位符填充规则

### `{{SAMPLE_DESC_OR_KEY}}`
取 `sample_desc`；若为空则用 `key`。

### `{{DATETIME}}`
当前时间，格式 `YYYY-MM-DD HH:MM`。

### `{{KEY}}`
样本 key，原样填入。

### `{{SAMPLE_DEFINITION_TABLE}}`
来自 `get <key>`，渲染为 Markdown 表格。有值则展示，无值跳过。

字段中文映射：

| 字段名 | 中文名 |
|--------|--------|
| sample_desc | 样本描述 |
| sample_pk | 主键字段 |
| source_type | 来源类型 |
| source_ref | 来源引用 |
| labels | 标签列 |
| date_col | 时间字段 |
| date_format | 时间格式 |
| sample_file_path | 本地文件路径 |
| sample_table_name | 原始表名（table 来源） |
| update_datetime | 最后更新时间 |
| standard_library_options.business_scene | 业务场景 |
| standard_library_options.sample_date_start | 样本起始日期 |
| standard_library_options.sample_date_end | 样本截止日期 |
| standard_library_options.sample_ratio | 取样比例 |
| standard_library_options.sample_num | 取样条数 |
| standard_library_options.where_sql | 额外过滤条件 |
| standard_library_options.sample_standard_tmp_table_name | 临时表名 |

不展示的字段：`key`、`create_datetime`

特殊处理规则：
- `source_type`：`standard_library` → 标准样本库；`file` → 本地文件；`table` → 数据库表
- `standard_library_options`：展开子字段逐行展示，`business_scene` 用中文
- `labels`：用反引号包裹每个值，逗号分隔
- `sample_file_path`：路径较短时可原样展示；若路径过长，可保留末尾 2~3 级目录与文件名，并用 `...` 折叠前缀，例如 `.../testdata_sample_complex/demo.parquet`，避免表格过宽

### `{{SAMPLE_STATS_TABLE}}`
来自 `info <key>`，渲染为 Markdown 表格；建议至少包含以下指标：
- 样本量
- 字段数
- 时间范围（最小日期 ~ 最大日期，共 N 天）
- 字段列表（字段较多时可同一格内逗号展示）

要求：
- 样本量使用原始条数，不额外换算“万”
- 时间范围优先写成一行结论，避免把 min/max/date_num 拆成三行碎片
- 若 `sample_info` 中存在 `fix_summary`，不要把修复动作混进本表，统一放到 `{{FIX_SUMMARY_SECTION}}`

### `{{LABEL_DISTRIBUTION}}`
来自 `sample_label_stat`，按当前生效标签列展示。

要求：
- 正常二值标签优先格式化为自然语言，如：`好样本 111 条(74.00%)，坏样本 39 条(26.00%)`
- 若仍存在 `missing` 或非 `0/1` 取值，必须如实展示，不得美化或省略
- 多标签样本按标签分组展示，每个标签单独成段

### `{{FIX_SUMMARY_SECTION}}`
当 `info <key>` 中存在 `fix_summary` 时必须展示；否则整节省略。

建议标题：`### 标签修复摘要`

最少包含：
- 修复时间
- 修复前条数 / 修复后条数 / 删除条数
- 操作明细（逐条列出 `ops_desc`）

附加要求：
- 这是正式分析小节，不是脚注；位置固定在“二、数据概览”下
- 若存在修复，后续 `{{KEY_FINDINGS}}` 应优先引用这里的结果，说明修复后标签是否已满足 0/1 要求、删除比例是否值得关注

### `{{MONTHLY_STATS}}`
优先来自 `monthly <key> --format md` 的输出，直接嵌入 Markdown 表格。

降级规则：
- 若当前运行环境未提供 `monthly` 子命令或无法稳定获取月度分布，则必须明确写：
  - `当前环境未提供 monthly 输出，暂缺按月分布分析。`
- 月度分布缺失时，不得凭空写“整体稳定”“月度趋势正常”等结论
- 若样本无 `sample_file_path` 或不具备时间列，也应明确说明无法生成该部分，而不是留空

### `{{KEY_FINDINGS}}`
基于“一、样本定义 / 二、数据概览 / 三、按月统计分布”客观归纳，必须输出 2-4 条结论型发现；若确实无异常，可直接写 1 条“🟢 暂无明显异常”。禁止编造问题，也不能只是把前文数字机械重复一遍。

格式要求：
- 每条以前缀 emoji 标注严重程度：`🔴` / `🟡` / `🟢`
- 结论前置：先写结论，再补 1 句数据佐证
- 操作提示、建议动作统一放到报告末尾 `> ⚠️` 区块，不混入发现条目
- 若月度分布缺失，只能基于已有信息下结论，不得虚构趋势判断

严重程度参考：
- `🔴`：bad_rate 超 30%、标签分布接近 1:1、样本量 < 500、missing 明显偏高或骤增
- `🟡`：月度趋势明显波动、样本量 500~3000、某月坏率跳变超 5pp
- `🟢`：分布符合预期、无明显异常、可继续下一步

提炼优先级：
1. 标签质量：是否已满足 0/1，是否仍有异常值 / missing
2. 样本规模：是否明显偏少
3. 坏样本率：是否偏高、是否接近 1:1
4. 时间覆盖：跨度是否过短，是否覆盖多个自然月
5. 修复影响：删除/映射是否较多，是否可能影响样本代表性
6. 月度分布：若有月度统计，再判断是否稳定或是否存在跳变
7. 可推进性：是否具备进入确认 / 特征阶段条件

写法示例：
- `🔴 坏样本率偏高。当前坏样本占比 34.9%，已超过 30%，需确认是否符合业务预期。`
- `🟡 样本量偏少。当前仅 150 条，低于常见建模样本规模，后续建模前建议评估是否扩量。`
- `🟢 暂无明显异常。当前标签已满足 0/1，月度分布未见明显失衡，可进入确认环节。`

### 符号约束
- 数值范围使用 en-dash `–`（如 `0.5–1.0`、`3–4`），禁止使用波浪号 `~`（会渲染为删除线）

# sample-template-reply.md — 样本标准回复模板

> 本文件由 `sample.md` 按需引用，包含样本流程中的交互模板。

---

## 统一入口模板

```
📂 项目 <proj> 已进入样本新增入口，请选择来源类型开始添加：

1. 📁 本地文件 — 已有 CSV / Parquet 文件
2. 🗄️ 数据表 — 从 Hive / MySQL 等导出
3. 📚 标准样本库 — 使用标准建模样本

回复序号或来源类型名称即可。
```


### 标准样本库业务场景选择卡模板

```text
📚 先选 `business_scene`（业务场景）：

1. <scene_key_1（中文名）>
2. <scene_key_2（中文名）>
...

回复序号或场景名即可。
```

### 标准样本库参数确认卡模板

```text
📚 标准样本库参数确认卡
- `business_scene`（业务场景）: <scene_key（中文名）>
- `sample_date_start`（样本开始日期）: <YYYY-MM-DD>（默认当天-365天；用户说"近N年/月"时由 Agent 换算为绝对日期后再传入 CLI，禁止传相对描述）
- `sample_date_end`（样本结束日期）: <YYYY-MM-DD>（默认当天；用户说"近N年/月"时由 Agent 换算为绝对日期后再传入 CLI，禁止传相对描述）
- `labels`（标签字段）: <value>（默认 ["fpd_k30_ever"] /用户指定）
- `sample_ratio`（抽样比例）: <value>
- `sample_num`（抽样条数）: <value 或 未设置>
- `where_sql`（附加过滤条件）: <value 或 无额外过滤条件>
- `extra_cols`（额外字段）: <value 或 []>

<若 `sample_ratio` 与 `sample_num` 同时存在，则补一行：说明：仅 `sample_num` 生效，`sample_ratio` 仅作记录展示>

你可以直接回复要修改的字段；如果这组参数没问题，我就继续生成取样 SQL。
```

### 样本添加确认卡模板

```text
📌 样本添加确认卡

- `name`（样本英文名）: <value>
- `sample_desc`（样本中文描述）: <value>
- `labels`（标签字段）: <value>
- `sample_pk`（样本主键）: <value>（如果是 row_id 则补充【系统自动生成】）
- `date_col`（日期列）: <value>
- `date_format`（日期格式）: <value>
- `source_type`（来源类型）: <file|table|standard_library>

<按来源补充字段：>
- file：
  - `source_ref`（来源引用）: <原始文件绝对路径>
  - `sample_file_path`（样本文件路径）: <本地文件路径>
- table：
  - `source_ref`（来源引用）: <库名.表名>
  - `sample_file_path`（样本文件路径）: <导出文件路径>
  - `sample_table_name`（样本表名）: <库名.表名>
- standard_library：
  - `source_ref`（来源引用）: <标准库源表>
  - `sample_file_path`（样本文件路径）: <导出文件路径>
  - `business_scene`（业务场景）: <scene_key（中文名）>
  - `sample_date_start`（样本开始日期）: <value>
  - `sample_date_end`（样本结束日期）: <value>
  - `sample_standard_tmp_table_name`（标准库临时表）: <tmp_table>
  - `sample_ratio`（抽样比例）: <value，可选>
  - `sample_num`（抽样条数）: <value，可选>
  - `where_sql`（附加过滤条件）: <value，可选>
  - `extra_cols`（额外字段）: <value，可选>

说明：以上为模板骨架，实际回复时按当前来源与已确认值裁剪展示，不把无关字段一并展开。

如果这张卡没问题，我就按这组参数执行 add。
```



### 样本报告生成标准回复模板

```text
样本报告已生成

🔍 关键发现:
- <关键发现>

📂 文件路径：
- 样本报告：<报告路径>

👀 建议你先看一下这份报告：
- 样本定义、标签分布和按月统计分布
- 重点看报告里的关键发现，确认这个样本是否适合继续使用

如果你觉得这份样本报告已经没问题了，我再继续帮你进入确认环节。
```

### 数据表导出 SQL 回复模板

<若为标准样本库来源，先展示取样 SQL：>

```text
📝 取样 SQL（标准样本库）：

```sql
<sampling_sql>
```

-- tmp_table: <tmp_table>
```

📂 导出信息：
- 来源表：`<table_name>`
- S3 路径：`<s3_path>`
- 本地路径：`<local_path>`

```sql
<export_sql>
```

⚠️ 请依次执行以上 SQL，完成后把导出的本地文件路径发给我继续处理：
→ `<local_path>`

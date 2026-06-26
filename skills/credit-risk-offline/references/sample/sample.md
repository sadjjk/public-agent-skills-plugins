# references/sample/sample.md - 样本层

> 由 `SKILL.md` 路由到此文件后加载。本文负责样本层流程编排与执行约束

---

## 样本层定位
- 本文件负责样本层流程编排,并补充样本执行所需的最小字段约束
- 当前进入本文件前,`project_root` 应已由 `references/common/project-bootstrap.md` 确认完成
- CLI脚本别名定义在 SKILL.md「命令别名」，直接使用 `$SAMPLE_SCRIPT`
---

## 模板文件
- **流程开始前必须读取** `references/sample/sample-template-reply.md`（所有交互模板）
- 流程三执行前读取 `references/sample/sample-template-report.md`（样本报告内容模板）

---

## 样本状态机与推进边界

| 状态 | 含义 | 推进方式 | 是否停留等待人工 |
|------|------|----------|------------------|
| S0 | 初始化,空状态 | 流程一:添加样本 推进到 S1 | 否 |
| S1 | 样本已添加,待检查 label | label异常 推进到 S2 ; label正常 推进到 S3 | 否 |
| S2 | label 存在异常值,待修复 | 流程二:修复异常标签 推进到 S3 | 是 |
| S3 | label 正常,待生成报告 | 流程三:生成样本报告 推进到 S4 | 否 |
| S4 | 已登记报告,待确认样本 | 流程四:确认样本 推进到 S5 | 是 |
| S5 | 样本已确认 | 可继续进入特征层 | 视后续流程而定 |

- 样本查询能力(如查看样本列表、状态、详情、统计信息、报告)不推进状态机,可在 `S1 ~ S5` 任意阶段调用,详细见 `references/sample/sample-query.md`

---

## 流程一:添加样本

> 触发条件:用户明确要求新增样本 / 添加样本 / 开始样本,或当前会话处于未完成的 `add` 流程并继续补充来源参数、导出文件路径或确认信息。
> 这里的"当前会话"只指本轮对话内已建立的上下文,不包含 memory、系统注入的历史摘要或旧会话检索结果。

### 边界说明

- 统一覆盖三类来源(本地文件/数据表/标准样本库),不拆并列流程;来源不同只影响取数准备与来源专属参数
- 只处理 `S0 → S1`
- 未完成 add 流程上下文必须继承,不得误判来源切换
- 数据表/标准样本库等待导出文件期间,后续本地文件路径默认继续当前流程;只有用户明确说"改为本地文件"才允许切换来源
- 来源锁定后 add 参数必须继续用锁定口径,不得退化
- `precheck` 不通过时停止 add,不得跳过检查直接执行

### 执行步骤

1. 确认项目与入口
   - 只说"新增样本/添加样本" → 先项目确认/选择,并使用 `references/common/project-bootstrap.md` 中的项目选择模板;不得改写为自由表述,也不得直接抛出绝对路径列表
   - 明确指定项目名/项目路径/可唯一匹配的关键词,或说"继续当前项目新增样本"且存在合法 `project_root` → 直接进入样本入口
   - 统一入口模板见 `sample-template-reply.md`「统一入口模板」
2. 确认来源类型(本地文件 / 数据表 / 标准样本库)
  2.1 **本地文件**:直接使用原文件;文件不存在则告知并终止
  2.2 **数据表**:
    - 执行 `$SAMPLE_SCRIPT export_sample_table_sql --table <库名.表名>`
    - 按 `sample-template-reply.md`「数据表导出 SQL 回复模板」展示
    - 用户执行 SQL 后,把导出的文件路径发回
  2.3 **标准样本库**:
    - 执行 `list_scenes`,按场景选择卡模板(见 `sample-template-reply.md`「标准样本库业务场景选择卡模板」)展示,用户选场景
    - 展示参数确认卡(见 `sample-template-reply.md`「标准样本库参数确认卡模板」);默认值规则:
      - `sample_date_start`:当天 -365 天
      - `sample_date_end`:当天
      - `labels`:`["fpd_k30_ever"]`
      - `sample_ratio`:`1.0`
      - 其余参数默认为空
    - 用户直接确认：执行 `get_standard_library_sql ...`,必须保留原始输出
    - 用户修改了任意参数：用修改后的值重新渲染参数确认卡，等用户二次确认后，再执行 `get_standard_library_sql ...`,必须保留原始输出
    - 从原始输出的 `-- tmp_table: ...` 行提取临时表名;`tmp_table` 是唯一真源,禁止自行拼接/猜测/改写;提取失败则停止报错
    - **立即自动执行** `$SAMPLE_SCRIPT export_sample_table_sql --table <临时表名>`;此步骤不依赖用户操作,获取 tmp_table 后必须紧接着执行,不得跳过或延迟
    - `where_sql` 中字符串值必须自动加单引号(如 `app_api=app` → `app_api='app'`);Agent 在拼入 SQL 前负责转义,不得将用户原始输入直接拼接
    - 回复用户时必须同时展示"取样 SQL"和"基于同一 tmp_table 的导出 SQL"
    - 等用户回传导出文件路径;`tmp_table` 属于已锁定上下文,后续所有导出/追问/确认都必须沿用
3. 执行 `precheck --file <路径>`
   - Agent 按字段推断规则补齐字段,推断过程内化,不对用户输出推断中间结果
   - **字段推断**:
     - `source_ref` / `sample_file_path`:直接取 `precheck` 返回值,不做推断
     - `sample_name`:文件名/表名去扩展名 → 英文小写 → 非字母数字转下划线 → 连续下划线折叠 → 去首尾下划线;超 50 字符精简保留核心词
     - `sample_desc`:本地文件/数据表 → 根据文件名或表名语义生成中文简短描述;标准样本库 → 优先根据已确认的标准库参数生成
     - `labels`:字段名含 `bad_/fraud_/fpd/dpd/mob/is_/target/label` 等风险词;推断不出则暂停,明确告知用户
     - `sample_pk`:从 `precheck` 返回的 `sample_pk_candidates` 中选取;仅一候选时直接使用,多候选时优先选业务含义明确的列并给出备选项
     - `date_col`:含 `time/date/dt/apply/create/close` 等时间词;优先 `close_date > apply_date > apply_time > create_time`
     - `date_format`:根据样例值推断,如 `yyyy-MM-dd` / `yyyy-MM-dd HH:mm:ss` / `yyyyMMdd`
   - precheck 不通过:停止 add,列出不一致项,提示用户修正后重新预检查
4. 展示样本添加确认卡(见 `sample-template-reply.md`「样本添加确认卡模板」);按当前来源只展示该来源允许出现的字段
5. 标准样本库专项校验(仅标准样本库来源):
   - `business_scene` 非空
   - `source_ref` 必须落为当前 `business_scene` 对应的标准库源表(优先使用 `list_scenes` 或场景配置返回的 `source_ref`,也可用 `get_standard_library_sql` 原始输出中的 `-- source_ref: ...` 校验或回填);禁止把 `tmp_table`、导出文件路径或其他中间产物误写到 `source_ref`
   - `sample_standard_tmp_table_name` 非空
   - 三者语义不混用:`business_scene` = 场景,`source_ref` = 标准库源表,`sample_standard_tmp_table_name` = 本次取样临时表
6. 用户确认后执行 add，注意：
   - 有歧义的参数名映射：`name`→`--sample-name`、`desc`→`--sample-desc`、`pk`→`--sample-pk`、`table_name`→`--sample-table-name`、`file_path`→`--sample-file-path`、`date_start`→`--sample-date-start`、`date_end`→`--sample-date-end`、`ratio`→`--sample-ratio`、`num`→`--sample-num`、`tmp_table_name`→`--sample-standard-tmp-table-name`
   - JSON 类参数必须传 JSON 数组字符串：`--labels`、`--extra-cols`
7. 执行 `info --key <key> --force` + `status --key <key>` 刷新状态
8. 若进入 S3(首次检查通过),默认衔接「流程三:生成样本报告」;若进入 S2,衔接「流程二:修复异常标签」

### 标准回复模板

见 `sample-template-reply.md` 以下模板:
- 步骤 1:统一入口模板
- 步骤 2.3 选场景后:标准样本库业务场景选择卡模板
- 步骤 2.3 确认参数:标准样本库参数确认卡模板
- 步骤 4:样本添加确认卡模板
- add 成功后:返回 `key` / 状态

## 流程二：修复异常标签

> 触发条件：样本状态进入 `S2`。

### 边界说明

- `S2` 是人工确认关口；未得到用户确认前，不得执行 `fix_label`
- 修复策略属于业务判断；Agent 应先检查冲突，再给出建议修复方案并收敛参数，但不能替用户决定最终修复口径
- 只处理 `S2 → S3`

### 执行步骤

1. 执行 `info --key <sample_key>`，从 `sample_label_stat` 提取异常标签分布并格式化展示
2. 告知用户支持两类策略（删除行/值映射），可混用；都支持生效日期范围，省略日期列时默认用 YAML 的 `date_col`
3. 收集用户操作意图：
   - 删除策略（strategy=drop）：异常值可选（不指定则删全部非0/1），日期范围可选
   - 映射策略（strategy=remap）：异常值必填、目标值必填，日期范围可选
4. 按label分组做冲突检查；有冲突必须先收敛，再允许执行
   - 硬冲突：同label同一异常值，删除策略排在映射策略之前；同label同一异常值多次映射且目标值不同（日期无交集除外）
   - 软冲突：同label同一异常值重复映射且目标值相同；同label同一异常值同时有映射和删除策略（日期有交集）
   - 处理：列出冲突及原因 → 给出建议方案 → 用户确认或修改后更新 → 无冲突后继续
5. 用户确认后执行 `fix_label --key <key> '<json数组>'`
   - JSON 结构：`[{"label":"<列名>","strategy":"drop|remap","from_val":<异常值>,"to_val":<目标值>}]`
   - `strategy=drop` 时省略 `to_val`；`strategy=remap` 时 `to_val` 必填
6. 执行 `info --key <key> --force` + `status --key <key>` 刷新状态
7. 若仍为 `S2`：展示剩余问题，回到步骤3继续收敛
8. 若进入 `S3`：提示用户可继续生成样本报告

---

## 流程三:生成样本报告

> 触发条件:样本状态进入 `S3`,或用户明确要求「生成报告 / 继续生成报告 / 刷新报告」。
- 若 `S3` 来自 `S1` 首次检查通过,可由 Agent 默认接续进入本流程
- 若 `S3` 来自 `S2` 修复完成,仅在用户明确表示继续后进入本流程

### 边界说明

- 流程三是样本报告生成与反馈流程,不是最终确认流程
- 当前流程只处理 `S3 -> S4`

### 执行步骤

1. 先确认 `project_root` 与 `sample_key`
   > ⚠️ 执行前必须读取 `references/sample/sample-template-report.md`
2. 获取报告数据：依次执行 `get --key <key>`、`info --key <key>`、`monthly --key <key> --format md`
3. 按 `references/sample/sample-template-report.md` 渲染 Markdown 内容，提炼关键发现（保留在上下文中备用）
4. 执行 `set_report --key <key>` 登记并获取报告路径，将渲染内容写入该路径
5. 执行 `status --key <key>` 刷新状态，校验是否进入 S4
6. 基于步骤3提炼的关键发现，严格按 `sample-template-reply.md`「样本报告生成标准回复模板」逐项对齐反馈；不得自行简化或改写措辞

### 标准回复模板

> 模板见 `sample-template-reply.md` → 「样本报告生成标准回复模板」

---

## 流程四:确认样本

> 触发条件:用户明确表达要确认当前样本,或在样本报告生成完成后进入确认引导。

### 边界说明

- 流程四只处理 `S4 → S5`
- 若当前状态不是 `S4`,不得执行 `confirm`
- `confirm` 前必须先提醒用户查看报告

### 执行步骤

1. 先确认 `project_root` 与 `sample_key`
2. 执行 `status --key <key>`,检查当前状态
3. 按状态分流:
   - `S1 / S2`:当前还不能确认,需先继续 label 检查或修复流程
   - `S3`:当前还不能确认,需先继续生成并登记样本报告
   - `S4`:进入确认前摘要环节
   - `S5`:样本已确认,直接提示可进入下一层
4. 若当前状态为 `S4`:
   - 先提示用户查看报告后再决定是否确认
   - 若用户需要快速判断,可读取报告并提炼 2~4 条关键发现作为辅助信息
   - 关键发现必须直接摘录报告原文结论,不自行发挥;若无法定位「四、关键发现」章节,则回退展示报告路径并提示用户手动确认
   - 等待用户二次确认
5. 用户明确确认后,执行 `confirm --key <key>`
6. `confirm` 成功后引导保持不变:
   - 若当前在 feature / model 上下文:继续原流程
   - 否则提示:「✅ 样本 `{key}` 已确认(S5)。下一步可以开始特征工程,要继续为这个样本添加对应特征吗?」

---

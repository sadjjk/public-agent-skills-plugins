# references/common/project-bootstrap.md

> 本文件只负责项目发现、选择与初始化。进入 sample / feature / model 之前,先在这里确认 `project_root`。

## 核心定义

- `skill_dir`:当前 skill 所在目录
- `data_dir`:风控项目工作区根目录,记录在 `{skill_dir}/.data_dir`
- `proj`:`data_dir` 下一级具体项目目录名
- `project_root`:`{data_dir}/{proj}`,也是传给 `--project` 的真实路径

硬规则:
- `.data_dir` 只代表工作区根目录,不能直接当项目
- 只有确认到具体项目目录后,才能进入 sample / feature / model 层

## 前置:读取工作区根目录

无论执行哪个功能,必须先完成此步骤。

检查 `{skill_dir}/.data_dir`:

```bash
cat {skill_dir}/.data_dir
```

- 若文件不存在或结果为空:让用户提供工作区根目录路径,并写回 `.data_dir`
- 若有值:记录为 `data_dir`

扫描 `data_dir` 获取项目目录列表:
- 只取一级子目录,忽略隐藏目录和 `testdata_*`
- 按目录名中的 `YYYYMMDD` 日期前缀降序排列;无日期前缀的排在后面
- ⚠️ 必须用 `ls` 实际扫描,禁止凭"刚创建/刚写入"推断目录为空

## 意图分支

根据用户意图进入对应功能:

- 用户说"有哪些项目/查看项目/项目列表/风控项目"等纯查看意图 → **功能二:查看项目概览**
- 用户要做事(样本/特征/模型)或说"新建项目" → **功能一:确认项目**

## 功能一:确认项目

目标:确认 `project_root`,然后进入 sample / feature / model 流程。

### 已有项目流程

判断顺序(命中即停):
1. 用户给了项目名/路径/关键词 → 模糊匹配(唯一命中直接用,多个候选让用户选,无匹配进新建项目流程)
2. 本轮有合法继承证据 → 直接继承
3. 都没有 → 列候选项目让用户选

继承证据只认本轮:
- 用户本轮明确指定项目
- 本轮成功执行过带 `--project` 的 sample / feature / model 命令
- 本轮刚完成项目选择或项目新建初始化
- 下列内容不能单独作为当前项目证据:memory / session_search 命中的旧会话 / 系统注入的历史摘要

轻入口规则:
- 用户只说"新增样本/添加特征/训练模型"等且未说"继续当前项目" → 先列项目
- 展示项目选择模板,不得改写或用绝对路径列表替代

项目选择模板:

```text
📂 先选一个项目:
1. 20260413_贷中测试
2. 20260407_贷中分层模型

回复序号或项目名都可以。
```

### 新建项目流程

触发条件:用户明确说"新建/创建/初始化项目",或已有项目流程中无匹配。

1. **命名**:目录名格式 `YYYYMMDD_中文项目名`,默认今天日期 + 用户描述提炼的短中文名,先给建议再等用户确认或修改
2. **初始化**:若 `{project_root}/config/sample.yaml` 不存在,视为未初始化
   - 创建目录:`config / data / report / logs`
   - 用 example 初始化:`config/sample.yaml`、`config/feature.yaml`
   - 若 `config/model.yaml` 不存在则创建空文件

   参考命令:

   ```bash
   PROJ_DIR="{data_dir}/{proj}"
   SKILL_DIR="{skill_dir}"
   mkdir -p "$PROJ_DIR/config" "$PROJ_DIR/data" "$PROJ_DIR/report" "$PROJ_DIR/logs"
   sed '/^[[:space:]]*#/d' "$SKILL_DIR/scripts/config/sample.yaml.example" > "$PROJ_DIR/config/sample.yaml"
   sed '/^[[:space:]]*#/d' "$SKILL_DIR/scripts/config/feature.yaml.example" > "$PROJ_DIR/config/feature.yaml"
   sed '/^[[:space:]]*#/d' "$SKILL_DIR/scripts/config/model.yaml.example" > "$PROJ_DIR/config/model.yaml"
   ```

3. **初始化后**:收敛到当前意图入口(样本/特征/模型)

## 功能二：查看项目概览

触发：纯查看意图（有哪些项目/查看项目/风控项目等），不进入具体流程。

### 1. 确定项目

- 用户指定了项目名/关键词 → 模糊匹配，展示匹配项目（多个都展示）
- 用户提到时间词 → 按项目目录名的 `YYYYMMDD` 前缀过滤，过滤后无匹配则提示"没有符合条件的项目"并展示全部供参考
- 未指定 → 展示全部

**时间词解析规则：**

| 用户说法 | 匹配逻辑 |
|---|---|
| 今天/今日 | 当天 `YYYYMMDD` 前缀 |
| 昨天 | 前一天 |
| 本周 | 本周一~今天 |
| 最近N天 | N天前~今天 |
| 6月12日/0612 | 对应 `YYYYMMDD` 或 `MMDD` 后缀匹配 |


### 2. 数据采集

读取 `data_dir`（复用前置步骤的 `.data_dir` 逻辑），扫描一级子目录（排除隐藏目录和 `testdata_*`），按日期降序。指定项目时只取匹配目录。

每个项目调用 3 条 CLI status 命令：

```bash
$SAMPLE_SCRIPT status
$FEATURE_SCRIPT status
$MODEL_SCRIPT status
```


### 3. 去重逻辑

从模型层往下逐层去重，避免重复展示：

- 被模型引用的样本 key 和特征 key → 特征行、样本行不重复展示
- 被特征引用的样本 key → 样本行不重复展示
- 某层全部被上层引用 → 该层标签整行省略
- 某层数据为空 → 该层整行省略不显示
- 同层级多个条目引用相同子项 → 子项只在最后一个条目下展示一次，括号内追加 `← 序号1,序号2共用`

### 4. 展示模板

```
📂 风控项目概览

━━ {项目名} ━━ 
　🔬 模型 
　　模型1: `{model_key}`（{model_desc}·{state}·{state_desc精简}·{icon}） 
　　　🧬 特征1: `{feat_key}`（{feature_desc}·{num}个）; 🧬 特征2: `{feat_key2}`（{desc2}·{num2}个） 
　　　📋 样本: `{sample_key}`（{sample_desc}） 
　
 🧬 特征  
　　特征1: `{feature_key}`（{feature_desc}·{state}·{state_desc精简}·{icon}） 
　　　📋 样本: `{sample_key}`（{sample_desc}） 
　
 📋 样本 
　　样本1: `{sample_key}`（{sample_desc}·{state}·{icon}） 
```

**格式规则**：

| 项 | 规则 |
|---|---|
| **层级顺序** | 模型 → 特征 → 样本 |
| **层级标题** | emoji + 层名（🔬 模型、🧬 特征、📋 样本） |
| **条目** | `类型序号:` + 反引号key + 括号(desc·state·state_desc精简·icon) |
| **关联子项** | 用对应层级 emoji + 类型名 + `:` + 反引号key + 括号(desc·num个) |
| **模型多特征组** | 同一行分号分隔，每个带 🧬 序号 |
| **key 省略** | 多条目时找共同前缀，第一个展示 `前缀..后缀`，后续只展示 `..后缀` |
| **desc 省略** | 多条目 desc 有共同前缀时，后续省略共同部分 |
| **icon** | 独立用 `·` 分隔（如 `已确认·✅`） |
| **特征数量** | 用“X个” |
| **去重** | 被上层引用的 key 不在下方层级重复展示；某层全部被引用则整层省略 |
| **同层重复子项** | 多条目引用相同子项时，子项只在最后一个条目下展示一次，括号内追加 `← 序号1,序号2共用` |
| **无数据** | 整层省略不显示 |
| **state_desc 精简** | 逗号前半段（如“已确认，可进入特征/建模环节”→“已确认”） |
| **项目排序** | 日期降序 |

**示例**：

```
📂 风控项目概览

━━ 20260421_贷前测试 ━━ 
　🔬 模型 
　　模型1: `1_is_approved_1_feature_1_lgb`（贷前测试v1·M2·划分完成·❌） 
　　　🧬 特征1: `1_is_approved_1_pre_loan_..features`（贷前特征·17个）; 🧬 特征2: `..features_b`（特征B·23个） 
　　　📋 样本: `1_pre_loan`（贷前标准样本库-pcr场景） 

　🧬 特征 
　　特征1: `2_is_overdue_1_2_in_loan_features_a`（贷中特征组A·F3·筛选完成·❌） 
　　　📋 样本: `2_in_loan`（贷中样本） 
　 
 📋 样本 
　　样本1: `3_in_loan_abnormal`（贷中异常标签样本·S5·✅） 

━━ 20260622_贷中调额模型 ━━
　🧬 特征 
　　特征1: `1_is_overdue_1_in_loan_..a_merged`（贷中调额特征A合并·F5·已确认·✅）
　　特征2: `..b_merged`（特征B合并·F4·探查完成·❌）
　　　📋 样本: `1_in_loan`（贷中调额样本·← 特征1,2共用） 
 
━━ 20260612_贷前多头测试 ━━ 
　📋 样本 
　　样本1: `1_pre_loan_test`（贷前多头测试样本·S3·❌） 
　　样本2: `2_in_loan_test`（贷中多头测试样本·S2·❌） 
```

## 禁止动作

- 未确认 `project_root` 不得进入 sample / feature / model 流程
- `.data_dir` 不得当项目路径传给 `--project`
- 项目选择必须用模板,不得用绝对路径列表替代
- 禁止不扫描 `data_dir` 就声称"没有任何项目"



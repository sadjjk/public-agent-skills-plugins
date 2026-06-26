---
name: myself-credit-risk-offline
description: >-
  风控离线建模辅助工具（Credit Risk Offline Modeling），管理样本/特征/模型三层全流程。

  **当以下情况时使用此 Skill**：
  (1) 查看风控项目、新建风控项目、按日期或名称筛选项目
  (2) 样本操作：添加样本、生成样本报告、样本确认
  (3) 特征操作：添加特征、特征筛选、特征探查、特征确认
  (4) 模型操作：模型训练、模型评估、模型确认
  (5) 需要查看样本状态、特征状态、模型状态
---

# 风控离线建模助手

## 作用范围

用于风控离线建模项目的三层协作:`sample / feature / model`。

当前支持:
- sample 层完整流程
- feature 层完整流程
- model 层完整流程

## 命令别名

所有 references 文件统一使用以下别名，不再写完整命令：

- `$SAMPLE_SCRIPT` = `cd {skill_dir}/scripts && python3 -m cli sample --project <project_root>`
- `$FEATURE_SCRIPT` = `cd {skill_dir}/scripts && python3 -m cli feature --project <project_root>`
- `$MODEL_SCRIPT` = `cd {skill_dir}/scripts && python3 -m cli model --project <project_root>`

## 核心流程

1. 先识别用户意图属于项目、样本、特征还是模型
2. 先确认 `project_root`;只有命中本轮会话内的明确继承条件时,轻入口才允许跳过项目选择
3. 若 `project_root` 未确认,立即读取 `references/common/project-bootstrap.md`
   - 对"新增样本""新增特征""模型训练"这类轻入口,默认先按 `project-bootstrap` 自动发现并列出候选项目
   - 只有在没有候选项目,或用户明确要求直接给路径时,才向用户索要绝对路径
4. 项目确认后,根据意图类型加载对应 knowledge：
   - **流程意图**（添加/筛选/确认等推进状态的动作）：`references/sample/sample.md`、`references/feature/feature.md`、`references/model/model.md`
   - **查询意图**（查列表/查状态/查详情，不推进状态）：`references/sample/sample-query.md`、`references/feature/feature-query.md`
5. 只有当前动作确实需要时,才补读对应 `references/*`

## 核心约束

- 先确认 `project_root`,再进入具体层级流程;不能把 workspace 当成业务项目目录
- 轻入口默认先选项目;不要因为历史绑定或想象中的"当前项目"直接继承
- 只认本轮会话内建立的项目绑定;不要把 memory、系统注入摘要或旧会话记录当作当前项目证据
- 项目确认后遵循最小推进:只进入当前入口的下一步必填信息或必要动作
- 项目内 `sample.yaml / feature.yaml / model.yaml` 只通过脚本访问,不手工编辑
- 只有项目来自已有项目选择或本轮合法继承时,才可展开样本/特征/模型多入口菜单

## 按需补读

- 风控项目 (查看/确认/选择/初始化):`references/common/project-bootstrap.md`
- 样本流程（添加/修复/报告/确认）：`references/sample/sample.md`
- 样本通用查询（查列表/查状态/查详情）：`references/sample/sample-query.md`
- 特征流程（添加/筛选/报告/确认）:`references/feature/feature.md`
- 特征通用查询（查列表/查状态/查详情）:`references/feature/feature-query.md`
- 模型流程:`references/model/model.md`

## 硬停止

出现以下念头时,立即停下并回到最小推进路径:
- 还没确认项目,就直接进入 sample / feature / model 流程
- 用户只给了轻入口动作,却跳过项目选择直接默认继承历史项目

# 复习卡片扩展：同反义词释义统一化设计说明

**日期**: 2026-04-09  
**状态**: 待评审

## 目标

修复当前复习卡中“同义词/反义词仅有词面、无具体释义”的问题，并保证以下两条链路一致：

1. **AI 生成链路**：所有相关卡片类型返回的同/反义词都携带释义
2. **知识库入库链路**：用户点击“存入”后，最终写入 `Note.synonyms` / `Note.antonyms` 的内容都携带释义

约束：保持现有知识库字段不变（`String[]`），采用兼容格式 `word (meaning)`。

## 范围

- **包含**：
  - `word-speech` / `phrase` / `spelling` / `synonym` 四类复习卡的同反义生成与展示
  - 复习页“存入同义/反义”的保存逻辑
  - 关联去重逻辑的兼容升级
  - 相关前后端测试补充
- **不包含**：
  - Prisma `Note.synonyms` / `Note.antonyms` 字段类型升级为对象数组
  - 知识库历史数据批量迁移
  - 句子卡（`sentence`）新增同反义模块

## 设计原则

1. **存储兼容优先**：数据库继续使用 `String[]`，避免大迁移风险。
2. **生成结构化优先**：AI 输出与前端展示优先使用结构化对象，降低格式抖动。
3. **保存单点收口**：所有同反义保存都经过统一格式化函数，确保落库一致。
4. **旧数据可共存**：历史纯字符串项可继续展示，新写入统一为 `word (meaning)`。

## 数据契约设计

### 1) 统一关联对象

新增逻辑模型：

```ts
type AssociationItem = {
  word: string
  meaning: string
}
```

### 2) 各卡片 AI 内容契约（逻辑）

- `word-speech` / `phrase` / `spelling`
  - `synonyms: AssociationItem[]`
  - `antonyms: AssociationItem[]`
- `synonym`
  - 保留 `wordMeanings: Array<{ word; phonetic; meaning }>`
  - `antonymGroup: AssociationItem[]`
  - `moreSynonyms: AssociationItem[]`

### 3) 落库存储格式

- `formatAssociationItem({ word, meaning }) => "word (meaning)"`
- 规则：
  - `word`、`meaning` 均需 `trim`
  - `meaning` 为空则拒绝保存（满足“必须带释义”目标）

## 生成链路改造

### Prompt 改造（后端）

在 `review-ai` 的 prompt 中，要求所有目标字段按对象结构返回，不再返回纯字符串数组；并强调：

- `meaning` 必填、不可为空
- 优先中文释义，可附“语义细微差别”
- 仅返回 JSON

### 解析改造（后端）

在 `review-ai-content` 解析器增加统一 `AssociationItem[]` 校验：

- 每项必须有非空 `word`、`meaning`
- 非法结构按现有策略进入 fallback

### fallback 策略

- fallback 时可继续使用已有 `note.synonyms/antonyms`（兼容历史数据）
- 但 fallback 内容不作为“新扩展带释义生成结果”的依据

## 前端展示与保存链路改造

### 展示层

复习卡同反义模块改为展示二元信息：

- 主文本：`word`
- 次文本：`meaning`

`synonym` 卡中的 `wordMeanings`、`moreSynonyms`、`antonymGroup` 统一按“词 + 释义”展示。

### 保存层

将当前 `onSaveSyn(string)` / `onSaveAnt(string)` 升级为基于对象入参（或等价内部对象化），并在保存前统一执行：

1. `formatAssociationItem` 序列化为 `word (meaning)`
2. 与现有列表执行去重合并
3. 通过 `updateNote` 写入 `synonyms` / `antonyms`

### 去重与冲突确认

继续沿用现有“词头冲突确认弹窗”能力，但升级为兼容两种输入：

- 历史纯词条（如 `luxurious`）
- 新词条格式（如 `luxurious (高雅奢华的)`）

核心对比键仍使用词头（leading token），保证交互习惯不变。

## 错误处理与降级

1. **AI 返回缺少 meaning**：解析失败，进入 fallback
2. **用户点击保存时数据不完整**：阻止保存并提示
3. **updateNote 失败**：回滚本地“已存入”状态，保留重试
4. **旧数据无释义**：允许展示，不强制改写

## 测试计划

### 后端

- `review-ai-content`：
  - `AssociationItem` 合法结构可通过
  - 缺 `meaning` 或空字符串时失败
- `review-ai`：
  - 各卡片类型 prompt 包含新结构要求

### 前端

- `ReviewCards`：
  - 同反义展示包含释义
  - 点击“存入”后 `updateNote` 载荷为 `word (meaning)`
  - 保存失败会回滚状态
- `associationDedup`：
  - 对 `word` 与 `word (meaning)` 冲突识别一致

### 回归

- 复习流程（翻卡、评分、切卡、重试）不受影响
- 知识库详情页仍可编辑/展示 `synonyms` 与 `antonyms`

## 风险与缓解

- **风险**：模型偶发返回旧格式字符串数组  
  **缓解**：解析器严格校验 + fallback 保底
- **风险**：新旧混存导致去重异常  
  **缓解**：统一解析词头键，冲突时弹窗确认
- **风险**：前端类型变更影响范围较大  
  **缓解**：先收口在 `ReviewCards`，通过工具函数隔离改动面

## 验收标准

1. 四类目标卡片的同/反义均可看到具体释义
2. 通过“存入”写入知识库后，条目均为 `word (meaning)` 形式
3. 去重与冲突确认仍可正确工作
4. 旧数据可正常展示，主要复习流程无回归

## 实施结果（2026-04-09）

- [x] 四类卡片同反义生成结构化并带释义（`word + meaning`）
- [x] 复习页保存落库统一为 `word (meaning)`
- [x] 去重与冲突确认兼容新旧数据（纯词条与带括号释义共存）
- [x] 前后端回归测试通过（本次改动相关测试集）
- [ ] 仓库全量前端 lint 全绿（存在既有历史 lint 问题，改动文件未新增 lint 错误）


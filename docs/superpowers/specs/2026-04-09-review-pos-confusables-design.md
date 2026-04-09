# 复习卡片扩展：词性 + 易混淆词（单词/拼写）设计说明

**日期**: 2026-04-09  
**状态**: 待评审

## 目标

在不破坏现有复习链路的前提下，为 `单词(word-speech)` 与 `拼写(spelling)` 卡片背面新增两类学习内容：

1. **词性展示**（如名词/动词/形容词），并附对应中文义（可选例句）
2. **易混淆词展示**（有多少展示多少），覆盖：
   - **形近混淆**：词形相似但含义不同（如 `strip` vs `stripe`）
   - **义近混淆**：意思/用法容易混淆（如 `affect` vs `effect`），必须提供差异说明

新增内容需支持“存入知识库”，且保持既有同义/反义“存入”逻辑不变。

## 范围

- **包含**：
  - 仅 `word-speech` 与 `spelling` 两类复习卡背面
  - 后端 `Note` 模型新增结构化字段（JSON 可选字段）
  - AI 生成协议扩展
  - 前端卡背面新增“内容视图切换”并接入保存动作
  - 回归测试与兼容策略
- **不包含**：
  - `phrase` / `synonym` / `sentence` 三类卡片背面扩展
  - 全库检索型易混淆推荐（仅按 AI 返回内容展示）
  - 旧同义/反义字段语义重定义

## 设计原则（兼容护栏）

1. **新增而非替换**：旧字段、旧接口、旧展示逻辑全部保留。
2. **新字段可缺省**：后端允许 `null`/空数组；前端按“有则展示、无则降级”。
3. **隔离写入语义**：词性/易混淆仅写入新字段，不污染 `synonyms/antonyms`。
4. **不影响主流程**：翻卡、评分、切卡、AI 重试、关联查重逻辑保持既有行为。

## 数据模型设计

在 `Note` 上新增两个 JSON 可选字段：

- `partsOfSpeech Json?`
- `confusables Json?`

### 类型定义（逻辑模型）

```ts
type PartOfSpeechItem = {
  pos: 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'phrase' | 'other'
  label: string
  phonetic?: string
  meaning: string
  example?: string
  exampleTranslation?: string
}

type ConfusableWord = {
  word: string
  phonetic?: string
  meaning: string
}

type ConfusableGroup = {
  kind: 'form' | 'meaning'
  words: ConfusableWord[]
  difference?: string
}
```

### 约束规则

- `partsOfSpeech`：
  - 空数组允许
  - 每项至少包含 `pos`、`label`、`meaning`
- `confusables`：
  - 空数组允许
  - 每组 `words.length >= 2`
  - 当 `kind = meaning` 时，`difference` 不能为空字符串

## AI 协议扩展

仅扩展 `word-speech` 与 `spelling` 的返回 JSON（旧字段保持原样）：

- 新增 `partsOfSpeech: PartOfSpeechItem[]`
- 新增 `confusables: ConfusableGroup[]`

解析策略：

1. 若 AI 返回完整合法结构：使用新结构渲染
2. 若 AI 仅返回旧结构：新字段视为空（前端不展示新块）
3. 若 JSON 非法：沿用现有 fallback 机制

## 前端交互与排版

为避免卡背面信息过载，采用**双视图切换**：

- 视图 1：`学习内容`（默认，保留现有模块）
- 视图 2：`词性&易混淆`（新增）

### 交互细节

1. 仅在 `word-speech` / `spelling` 展示切换控件
2. 每次切换到新卡时默认回到 `学习内容`
3. 视图切换不触发翻卡，不影响评分按钮与进度状态
4. 新视图内容可滚动，避免挤压既有布局

### 新视图信息结构

1. **词性区块**
   - 词性标签（名词/动词等）
   - 中文义
   - 可选音标、例句与译文
   - 每项提供“存入知识库”动作
2. **易混淆区块**
   - 按组展示，全部展示（不限制数量）
   - `form`：展示词 + 音标 + 含义
   - `meaning`：展示词 + 音标 + 含义 + 差异说明
   - 每组提供“存入知识库”动作

## 存入知识库策略

新增两个独立保存动作：

- `savePartOfSpeech(item)`
- `saveConfusable(group)`

写入目标：`Note.partsOfSpeech` / `Note.confusables`

### 去重规则

- 词性项去重键：`pos + meaning`（`trim + lower` 归一化）
- 易混淆组去重键：`kind + words(按词面归一化后排序拼接)`  
  说明：排序后对比可规避同组词顺序不同导致重复。

### 失败处理

- 保存失败仅影响该次“存入”状态，不影响卡片翻转、评分、切卡
- UI 给出失败提示并允许再次点击重试

## 后端接口变更

在现有 `CreateNoteDto` / `UpdateNoteDto` 增加可选字段：

- `partsOfSpeech?: PartOfSpeechItem[]`
- `confusables?: ConfusableGroup[]`

`NotesService.update` 增加新字段写入与基础归一化（去空白项、去重）。

## 错误处理与降级

1. **新字段缺失**：前端仅显示旧视图内容
2. **新字段格式不合法**：忽略该字段并记录日志，不中断页面
3. **AI 超时/失败**：继续沿用当前 fallback；新模块可不展示
4. **保存新字段失败**：局部失败提示，不阻塞复习主流程

## 测试计划

### 前端

- `word-speech`/`spelling` 显示视图切换；其他类型不显示
- 切换视图不影响翻卡、评分、进度
- 新字段为空时页面正常、旧内容完整
- 词性与易混淆“存入”状态正确（含去重与重试）

### 后端

- DTO 校验：合法结构可写入，非法结构被拒绝或清洗
- 更新逻辑：不破坏旧字段读写
- 去重逻辑：重复写入同词性项/同易混淆组不重复增长

### 回归重点

- 复习 AI 重试机制正常
- 同义/反义“存入”与关联查重弹窗逻辑保持原行为
- 用户备注展示与加载逻辑不受影响

## 里程碑与实施顺序

1. Prisma schema 增加 JSON 字段并迁移
2. 后端 DTO + service 写入支持
3. Review AI prompt/解析扩展（仅两类卡）
4. 前端卡背面切换 UI 与新视图渲染
5. 新增“存入”动作与状态管理
6. 回归测试与兼容验证

## 风险与缓解

- **风险**：AI 输出结构不稳定导致前端解析异常  
  **缓解**：字段级容错，非法结构忽略，保底显示旧内容
- **风险**：新旧“存入”交织导致状态复杂  
  **缓解**：新旧保存状态分离，动作分层
- **风险**：背面信息过多影响阅读  
  **缓解**：双视图切换 + 新视图滚动容器

## 验收标准

1. `word-speech`/`spelling` 可查看并保存“词性 + 易混淆词”
2. 易混淆词支持两类：形近混淆、义近混淆（含差异说明）
3. 全量展示 AI 返回项（不做数量截断）
4. 旧功能无回归：翻卡、评分、AI 重试、同反义存入与查重、备注展示均正常

## 实施结果（2026-04-09）

- [x] `Note` 新增 `partsOfSpeech` / `confusables` 可选 JSON 字段
- [x] 后端 DTO 与 `NotesService` 支持新字段校验、归一化与去重
- [x] `review-ai` 在 `word-speech` / `spelling` 扩展新字段，并兼容旧结构
- [x] 复习卡背面新增「学习内容 / 词性&易混淆」双视图切换（仅目标两类）
- [x] 新增“存入知识库”动作，写入新字段且不污染 `synonyms` / `antonyms`
- [x] 保存失败给出局部提示并支持重试
- [x] 前后端关键测试通过（本地验证命令已执行）

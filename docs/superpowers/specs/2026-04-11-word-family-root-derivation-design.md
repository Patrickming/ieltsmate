# 词性&词根派生拆分 + partsOfSpeech 必填 + 易混淆词修正

日期：2026-04-11

## 问题背景

当前复习卡片的 AI 生成存在三个关联问题：

1. **partsOfSpeech 生成不稳定**：prompt 将 partsOfSpeech 标为"可选"，导致 AI 经常只返回一个主词性，甚至跳过。用户期望穷举所有真实词性。
2. **词性派生与词根派生混为一谈**：`wordFamily.derivedByPos` 只有一个维度（按词性分组），AI 把词形变化派生（continent → continental）和词根关联词（continent → continue, contiguity）混在一起。
3. **易混淆词内容不合理**：Tab 名称为"易混小词"不准确；AI 把共享词根的词当成"形近易混"塞入 confusables（如 continent vs continue），而这些应属于词根派生。

## 设计目标

- partsOfSpeech 成为必填字段，AI 穷举所有真实存在的词性和义项
- wordFamily 拆分为"词性派生"和"词根派生"两个独立区块
- confusables 排除词根派生关系，只保留真正的拼写/语义易混淆词
- 向后兼容现有数据

## 数据模型变更

### WordFamily 接口扩展

文件：`backend/src/notes/types/word-family.ts`

```typescript
// 现有
interface WordFamily {
  base: WordFamilyBase
  derivedByPos: Record<Pos4, WordFamilyItem[]>
}

// 改为
interface WordFamily {
  base: WordFamilyBase
  derivedByPos: Record<Pos4, WordFamilyItem[]>
  rootDerived: WordFamilyItem[]
}
```

`rootDerived` 复用现有 `WordFamilyItem` 类型（`word`、`pos`、`meaning`、`phonetic`），不需要新类型。

### normalizeWordFamily 变更

- 解析 `rootDerived` 数组：遍历每项，用现有 `normalizeItemForBucket` 类似逻辑校验（但不按 bucket 过滤 pos，因为 rootDerived 是平铺列表）
- 去重：与 `derivedByPos` 共享 `globalSeen` Set，避免同一个词同时出现在两个区块
- 向后兼容：输入中无 `rootDerived` 字段时，返回 `rootDerived: []`

### mergeWordFamilyItems 变更

扩展签名以同时合并 `rootDerived`：

```typescript
function mergeWordFamilyItems(
  base: WordFamily,
  incomingDerivedItems: WordFamilyItem[],
  incomingRootItems?: WordFamilyItem[],
): WordFamily
```

- `incomingRootItems` 可选，默认 `[]`
- 用 `wordFamilyItemDedupKey` 跨 derivedByPos + rootDerived 全局去重

### 前端类型与工具函数同步

前端有独立的类型定义和工具函数，需同步改动：

**`frontend/src/types/wordFamily.ts`**：`WordFamily` 接口新增 `rootDerived: WordFamilyItem[]`。

**`frontend/src/lib/wordFamilyDedup.ts`**：
- `normalizeWordFamilyForUI`：新增 `rootDerived` 解析逻辑。遍历 `root.rootDerived` 数组，对每项校验 word/meaning 非空、pos 为合法 Pos4（不合法则跳过该项），与 `derivedByPos` 共享 `seen` Set 去重。输入中无 `rootDerived` 字段时返回 `rootDerived: []`。
- `mergeWordFamilyItems`：扩展签名新增 `incomingRootItems?: WordFamilyItem[]`，合并时跨 derivedByPos + rootDerived 全局去重。
- `flattenWordFamilyItems`：保持现有行为（只展平 derivedByPos），不包含 rootDerived。调用方直接读取 `wf.rootDerived` 获取词根派生项。

## Prompt 改动

### partsOfSpeech 从可选改为必填

约束段落从：

> `partsOfSpeech/confusables/wordFamily 可选`

改为：

> `partsOfSpeech 必填，穷举该词所有真实存在的词性及义项（依据词典判断，若确实只有一种词性则只返回该词性）；confusables/wordFamily 可选`

### wordFamily JSON 模板扩展

在 prompt 的 wordFamily 示例 JSON 中，新增 `rootDerived` 字段：

```json
"wordFamily": {
  "base": { "word": "目标词", "pos": "noun", "meaning": "义项", "phonetic": "/音标/" },
  "derivedByPos": {
    "noun": [],
    "verb": [],
    "adjective": [{ "word": "continental", "pos": "adjective", "meaning": "大陆的", "phonetic": "/ˌkɒntɪˈnentl/" }],
    "adverb": []
  },
  "rootDerived": [
    { "word": "continue", "pos": "verb", "meaning": "继续", "phonetic": "/kənˈtɪnjuː/" }
  ]
}
```

### wordFamily 约束文本更新

原约束中关于派生的部分替换为：

> `derivedByPos 只放词形变化派生（加前缀/后缀改变词性，意思与目标词紧密相关）；rootDerived 放同词根/词缀但意思已分化的关联词（平铺数组，不按词性分组）；两者不要重复。`

### confusables 约束强化

在现有 confusables 约束后追加：

> `confusables 中 form 类只放拼写极相似、真正容易看错的词（如 strip vs stripe），不要放共享词根的派生词（那些属于 wordFamily.rootDerived）。`

### 影响的 cardType

| cardType | partsOfSpeech 改动 | wordFamily 改动 | confusables 排除约束 |
|----------|-------------------|----------------|---------------------|
| word-speech | 必填 | rootDerived 扩展 | 追加 |
| spelling | 必填 | rootDerived 扩展 | 追加 |
| phrase | 不涉及 | 不涉及 | 不涉及 |
| synonym | 不涉及 | 不涉及 | 不涉及 |
| sentence | 不涉及 | 不涉及 | 不涉及 |

## 前端展示改动

### Tab 名称修改

| 现有 | 改为 |
|------|------|
| `词性派生` | `词性&词根派生` |
| `易混小词` | `易混淆词` |

位置：`ReviewBackTabBar` 组件中的 label 字符串。

### WordFamilyPanel 拆成两个区块

面板内容纵向分为两个区块，用分隔线隔开：

**区块 A：词性派生**（保持现有布局不变）
- 顶部："词性"标题 + partsOfSpeech 卡片列表
- 下方：按 名词/动词/形容词/副词 四组展示 `derivedByPos`，每组无内容显示"无"
- 底部："一键存入本组派生"按钮（只存 derivedByPos 部分）

**区块 B：词根派生**（新增区块）
- 标题："词根派生"
- 平铺列表展示 `rootDerived`，每项显示：word + pos 标签 + meaning + phonetic
- 每项右侧有"存入"按钮，逻辑与词性派生项一致
- 无内容时显示"无"
- 底部"一键存入本组派生"按钮（只存 rootDerived 部分）

### ConfusablePanel 文本修改

- 标题 `易混小词` → `易混淆词`
- 空状态文案 `暂无易混小词内容` → `暂无易混淆词内容`
- `form` 类标签 `形近 / 拼写易混` 保持不变

### KnowledgeDetail 页面同步

`KnowledgeDetail.tsx` 中已有 `🧩 词性派生` 展示区块，需同步：
- 新增 `rootDerived` 的渲染区块
- 标题改为 `🧩 词性&词根派生` 或保持一致性

## 测试

### 后端测试

- `review-ai-content.e2e-spec.ts`：
  - `word-speech` prompt 断言：包含 `rootDerived`；`partsOfSpeech` 相关约束含"必填"
  - `spelling` prompt 断言：同上
  - confusables 约束断言：包含"不要放共享词根的派生词"

- `word-family.ts` 单元测试：
  - `normalizeWordFamily` 处理含 `rootDerived` 的输入：正确解析
  - `normalizeWordFamily` 处理不含 `rootDerived` 的旧数据：返回 `rootDerived: []`
  - `mergeWordFamilyItems` 正确合并 `rootDerived`，跨区块去重

### 前端测试

- `ReviewCards.extensions.test.tsx`：更新 `易混小词` → `易混淆词` 的断言
- `ReviewCards.word-family.test.tsx`：
  - 新增 rootDerived 渲染测试（有数据时显示列表，无数据时显示"无"）
  - Tab 名称断言更新

## 向后兼容

- `wordFamily` 是 JSON 字段，结构变更在应用层处理，不需要数据库迁移
- 已存在的 `wordFamily` 数据缺少 `rootDerived` 时，`normalizeWordFamily` 自动补充为 `[]`
- 前端 `rootDerived` 为空数组时正常显示"无"

## 不做的事情（YAGNI）

- 不为 `rootDerived` 单独创建数据库表
- 不修改 `phrase`/`synonym`/`sentence` 的 prompt 加 wordFamily
- 不做"词根拆解"功能（如 con- = 一起, -tin- = 持有）

## 受影响文件清单

| 文件 | 改动类型 |
|------|---------|
| `backend/src/notes/types/word-family.ts` | 接口 + normalize + merge |
| `backend/src/review/review-ai.service.ts` | prompt 模板 |
| `backend/test/review-ai-content.e2e-spec.ts` | 断言更新 |
| `frontend/src/types/wordFamily.ts` | 接口新增 rootDerived |
| `frontend/src/lib/wordFamilyDedup.ts` | normalize + merge + 去重 |
| `frontend/src/pages/ReviewCards.tsx` | TabBar label + WordFamilyPanel + ConfusablePanel |
| `frontend/src/pages/KnowledgeDetail.tsx` | rootDerived 展示 |
| `frontend/src/pages/__tests__/ReviewCards.extensions.test.tsx` | 断言更新 |
| `frontend/src/pages/__tests__/ReviewCards.word-family.test.tsx` | 新增测试 |

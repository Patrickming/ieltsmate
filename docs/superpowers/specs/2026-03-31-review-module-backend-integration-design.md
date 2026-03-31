# 复习模块后端 + 前后端联调 设计文档

> 日期：2026-03-31
> 状态：待实施

---

## 1. 概述

为 IELTSmate 复习系统编写后端剩余接口（评分、结束、中止、AI 内容生成），并完成前后端联调，替换当前纯前端 Zustand 本地状态驱动的复习流程。

### 1.1 设计决策汇总

| 决策项 | 结论 |
|--------|------|
| AI 生成策略 | 实时生成，提前预取 2 张卡片，UI 保留 AI 生成动画 |
| 同义替换释义 | 每个词独立列出，附差异化中文释义 |
| 替换句子数量 | 2-3 个，分别体现不同维度（换词汇/换句式/换结构） |
| 缓存策略 | 不缓存，每次复习都重新生成 |
| 拼写卡背面 | 单词类内容 + 额外例句及上下文解析 |
| "存入"按钮 | 追加到原 Note 的 synonyms[]/antonyms[] 并持久化到数据库 |
| 句子结构解析 | 以理解句意为主的自然语言解释，结构标注为辅 |
| AI 失败处理 | 阻塞等待，15 秒超时或 JSON 解析失败后降级到数据库基础内容 |
| 整体架构 | 薄后端（前端驱动预取和会话流程，后端提供服务端点） |
| cardType 映射 | 后端负责将中文 category（口语/单词/短语/…）映射为英文 cardType（word-speech/phrase/…） |
| 空会话 | totalCards === 0 时后端不创建 session，返回错误提示，前端不跳转 |
| 预取窗口 | 始终维持当前卡片起共 3 张已就绪（即当前 + 未来 2 张） |

---

## 2. 后端 API 设计

### 2.0 开始会话接口（已有，补充规格）

```
POST /review/sessions/start
```

**请求体：**

```typescript
interface StartReviewDto {
  source: 'notes' | 'favorites'
  categories?: string[]
  range: 'all' | 'wrong'
  mode: 'random' | 'continue'
}
```

**响应（成功，totalCards > 0）：**

```typescript
interface StartReviewResponse {
  sessionId: string
  totalCards: number
  cards: Note[]
}
```

**空列表（totalCards === 0）：** 返回 HTTP 400 `{ message: '当前筛选条件下暂无可复习内容' }`，不创建 session。

### 2.1 评分接口

```
PATCH /review/sessions/:sessionId/rate
```

**请求体：**

```typescript
interface RateDto {
  noteId: string
  rating: 'easy' | 'again'
  spellingAnswer?: string   // 仅拼写类卡片
}
```

**事务逻辑：**

1. 查找 `ReviewSessionCard`（by sessionId + noteId），更新 `isDone=true`、`rating`、`spellingAnswer`、`answeredAt=now()`
2. 创建 `ReviewLog` 记录（含 `isSpellingCorrect` 判断：`spellingAnswer.trim().toLowerCase() === note.content.toLowerCase()`）
3. 更新 `Note` 统计字段：
   - `reviewCount += 1`
   - easy → `correctCount += 1`
   - again → `wrongCount += 1`
   - `lastReviewedAt = now()`
4. 掌握度升降：
   - 原 status 为 'new' → `reviewStatus = 'learning'`（任何评分触发）
   - `correctCount >= 3` 且本次 rating === 'easy' → `reviewStatus = 'mastered'`
   - 本次 rating === 'again'，无论当前 status 是什么 → `reviewStatus = 'learning'`（mastered 也会降回 learning）
   - `correctCount` / `wrongCount` 为累计值，不清零

**拼写正确性判断：** `spellingAnswer.trim().toLowerCase() === note.content.trim().toLowerCase()`，两侧均 trim + 小写后比较。

**失败处理：** fire-and-forget 模式下评分请求失败时不重试、不回滚本地状态。前端保持乐观更新，容忍极少数情况下本地与后端的微小不一致（如网络闪断丢失 1 条评分记录）。

**响应：** `{ ok: true }`

### 2.2 结束会话接口

```
POST /review/sessions/:sessionId/end
```

**逻辑：** `status = 'completed'`，`endedAt = now()`

**响应：** 会话统计摘要

```typescript
interface SessionSummary {
  totalCards: number
  correctCount: number
  wrongCount: number
  categoryStats: Array<{
    category: string
    total: number
    correct: number
    wrong: number
  }>
}
```

统计来源：聚合该 session 下所有 `ReviewSessionCard`（`isDone=true`）的 `rating` 字段，按关联 Note 的 `category` 分组。

### 2.3 中止会话接口

```
POST /review/sessions/:sessionId/abort
```

**逻辑：** `status = 'aborted'`，`endedAt = now()`，已评分记录保留不删除。

**响应：** `{ ok: true }`

### 2.4 AI 内容生成接口

```
POST /review/ai/generate
```

**请求体：**

```typescript
interface GenerateDto {
  noteId: string
  cardType: 'word-speech' | 'phrase' | 'synonym' | 'sentence' | 'spelling'
}
```

**逻辑：**

1. 从数据库查出 Note 完整数据（content, translation, category, phonetic, synonyms, antonyms, example）
2. 后端将 Note.category（中文）映射为 cardType 枚举：口语/单词 → word-speech，短语 → phrase，同义替换 → synonym，句子 → sentence，拼写 → spelling。如果请求中的 cardType 与 Note.category 不匹配则返回 400。
3. `review-ai.service.ts` 内部**复用 `AiService`** 的调用链（模型解析、鉴权、日志），通过 `reviewModel` slot 调 AI
4. 要求 AI 返回严格 JSON，后端解析并校验
5. 成功 → 返回结构化内容（带 `fallback: false`）
6. 超时（15 秒）、AI 调用失败、或 JSON 解析失败 → 均返回 `fallback: true` + 数据库已有基础字段

**超时：** 15 秒

### 2.5 存入扩展词

复用现有 `PATCH /notes/:id`，前端发送追加后的完整 `synonyms[]` 或 `antonyms[]` 数组。无需新端点。

---

## 3. AI Prompt 设计与返回结构

每种卡片类型对应一个 prompt 模板，AI 必须返回严格 JSON。

### 3.1 word-speech（口语/单词）

**Prompt 核心指令：** 给定英文单词/短语及其中文翻译，生成同义词、反义词、音标、记忆技巧、例句。

**返回结构：**

```typescript
interface WordSpeechAI {
  phonetic: string                  // 音标
  synonyms: string[]                // 同义词/短语（3-5 个）
  antonyms: string[]                // 反义词（2-3 个）
  example: string                   // 例句
  memoryTip: string                 // 记忆技巧
}
```

### 3.2 phrase（短语）

**Prompt 核心指令：** 给定英文短语及其中文翻译，生成同义短语、反义短语、音标、例句。

**返回结构：**

```typescript
interface PhraseAI {
  phonetic: string
  synonyms: string[]                // 同义短语（3-5 个）
  antonyms: string[]                // 反义短语（2-3 个）
  example: string
  memoryTip: string
}
```

### 3.3 synonym（同义替换）

**Prompt 核心指令：** 给定一组同义替换词，为每个词生成独立的差异化中文释义，并生成反义同义替换、更多同义替换。

**返回结构：**

```typescript
interface SynonymAI {
  wordMeanings: Array<{             // 原词组中每个词的独立释义
    word: string
    phonetic: string
    meaning: string                 // 差异化中文释义（含使用语境说明）
  }>
  antonymGroup: string[]            // 反义同义替换组（2-3 个）
  moreSynonyms: string[]            // 更多同义替换（3-5 个）
}
```

### 3.4 sentence（句子）

**Prompt 核心指令：** 给定英文句子及中文翻译，生成句意理解解析和 2-3 个不同维度的同义替换句。

**返回结构：**

```typescript
interface SentenceAI {
  analysis: string                  // 句意理解解析（自然语言，帮助读懂句子）
  paraphrases: Array<{              // 2-3 个替换句
    sentence: string                // 替换后的英文句子
    dimension: string               // 替换维度说明（如"换词汇"、"换句式-被动"、"换结构-主语从句"）
  }>
}
```

### 3.5 spelling（拼写）

**Prompt 核心指令：** 给定英文单词及中文翻译，生成单词类扩展内容 + 一个包含该词的例句及其上下文解析。

**返回结构：**

```typescript
interface SpellingAI {
  phonetic: string
  synonyms: string[]                // 同义词（3-5 个）
  antonyms: string[]                // 反义词（2-3 个）
  memoryTip: string
  contextExample: {                 // 上下文例句
    sentence: string                // 包含该词的例句
    analysis: string                // 例句解析（帮助理解该词在句中的用法）
  }
}
```

### 3.6 响应判别与降级

所有成功响应带 `fallback: false` + 对应 cardType 的 AI 结构。
所有降级响应带 `fallback: true` + 数据库基础字段。
前端用 `response.fallback` 作为 discriminant 区分。

**降级响应统一结构：**

```typescript
interface FallbackResponse {
  fallback: true
  phonetic: string | null           // 来自 Note 数据库
  translation: string               // 来自 Note 数据库
  synonyms: string[]                // 来自 Note 数据库
  antonyms: string[]                // 来自 Note 数据库
  example: string | null            // 来自 Note 数据库
  memoryTip: string | null          // 来自 Note 数据库
}
```

**各 cardType 降级时的 UI 表现：**

| cardType | 降级时展示 |
|----------|-----------|
| word-speech | 音标 + 中文意思 + 已有 synonyms/antonyms + memoryTip + example |
| phrase | 同 word-speech |
| synonym | 只展示中文翻译 + 已有 synonyms/antonyms（无独立释义） |
| sentence | 只展示中文翻译 + example（无结构解析和替换句） |
| spelling | 拼写对比 + 音标 + 中文意思 + 已有 synonyms/antonyms + example |

---

## 4. 前端 Store 改造

### 4.1 ReviewSession 类型变更

```typescript
// 改造前（当前代码）
interface ReviewSession {
  cards: Note[]
  current: number
  results: { id: string; rating: 'easy' | 'hard' | 'again' }[]
}

// 改造后
interface ReviewSession {
  sessionId: string                 // 后端会话 ID
  cards: Note[]
  current: number
  results: { id: string; rating: 'easy' | 'again' }[]
  params: StartReviewDto             // 保存筛选参数，供"再来一轮"使用（字段名与后端 DTO 完全一致：source / categories / range / mode）
  aiContent: Record<string, CardAIContent | null>  // noteId → AI 生成内容缓存（会话内）
  aiLoading: Set<string>            // 正在生成 AI 的 noteId 集合
  savedExtensionCount: number       // 会话内"存入"成功的累计次数
}
```

### 4.2 核心 Action 改造

| Action | 改造前 | 改造后 |
|--------|--------|--------|
| `startReview(cards)` | 同步，直接写入 cards | `startReviewSession(params: StartReviewDto)` → async，调 `POST /review/sessions/start`，拿到 sessionId + cards，触发 ensureWindow(0) |
| `rateCard(id, rating)` | 同步，追加 results | `rateCard(noteId, rating, spellingAnswer?)` → 本地先更新 results 保 UI 流畅，fire-and-forget 调 `PATCH /review/sessions/:sessionId/rate`（sessionId 从 session 状态中取） |
| `nextCard()` | current++ | 不变 + 触发 ensureWindow(newCurrent) |
| `endReview()` | 清除 session | `endReviewSession()` → async，调 `POST /review/sessions/:sessionId/end`，返回统计数据 |
| — | — | 新增 `abortReviewSession()` → async，调 `POST /review/sessions/:sessionId/abort` |
| — | — | 新增 `fetchAIContent(noteId, cardType)` → async，调 `POST /review/ai/generate`，结果存入 `aiContent` |
| — | — | 新增 `prefetchAI(startIndex)` → 预取 startIndex 起后续 2 张的 AI 内容 |

### 4.3 预取队列逻辑

**策略：始终维持当前卡片起共 3 张已就绪（当前 + 未来 2 张）。**

```
会话开始 → ensureWindow(0)  → 为 card[0], card[1], card[2] 发起 AI 生成
评分 card[0]，current 变为 1 → ensureWindow(1) → card[1]、card[2] 已有，补 card[3]
评分 card[1]，current 变为 2 → ensureWindow(2) → card[2] 已有，补 card[3]（已有则跳过）、card[4]
...以此类推

ensureWindow(currentIdx):
  for i in [currentIdx, currentIdx+1, currentIdx+2]:
    - 如果 i >= total，跳过
    - 如果 aiContent 已有该 noteId，跳过
    - 如果 aiLoading 已有该 noteId，跳过
    - 否则调 fetchAIContent(noteId, cardType)
```

---

## 5. 前端页面改造

### 5.1 ReviewSelection 页

- `handleStart` 改为 async
- 调 `startReviewSession(params)` 替代同步 `startReview(cards)`
- 成功后 `navigate('/review/cards')`
- 失败时 toast 提示，不跳转

### 5.2 ReviewCards 页

**卡片翻转时的 AI 内容展示逻辑：**

```
翻转卡片 →
  aiContent[noteId] 已就绪？
    → 播放短暂 AI 生成动画（200-400ms，纯视觉效果）→ 渲染 AI 内容
  aiContent[noteId] 为 null（正在加载）？
    → 显示 AI 生成动画（真实等待）→ 15 秒超时降级
  aiContent[noteId] 降级？
    → 渲染数据库基础内容 + "AI 生成失败" 提示
```

**CardBack 组件按 cardType 分支渲染：**

| cardType | 背面内容 |
|----------|---------|
| word-speech | 音标 + 中文意思 + 同义词（可存入）+ 反义词（可存入）+ 记忆技巧 + 例句 |
| phrase | 音标 + 中文意思 + 同义短语（可存入）+ 反义短语（可存入）+ 记忆技巧 + 例句 |
| synonym | 每个词的独立释义列表 + 反义同义替换组 + 更多同义替换 |
| sentence | 中文意思 + 句意理解解析 + 2-3 个同义替换句（标注替换维度） |
| spelling | 拼写对比结果 + 音标 + 中文意思 + 同义词 + 反义词 + 记忆技巧 + 上下文例句及解析 |

**"存入"按钮改造：**
- 点击后调 `PATCH /notes/:id`，将 AI 生成的词追加到 `synonyms[]` 或 `antonyms[]`
- 成功后按钮变为"✓ 已存入"
- 失败时 toast 提示，按钮恢复可点击

**退出确认：**
- 点击"确认退出"后调 `abortReviewSession()`

### 5.3 ReviewSummary 页

- 从 `endReviewSession()` 返回值获取真实统计数据（替代本地计算）
- `savedExtensions` 改为 `session.savedExtensionCount`（会话中每次"存入"成功时 +1）
- "再来一轮"复用 `session.params` 调 `startReviewSession({ ...session.params, range: hasWrong ? 'wrong' : 'all' })`

---

## 6. 数据流全览

```
用户点击"开始复习"
  │
  ├─ POST /review/sessions/start ──→ 返回 { sessionId, totalCards, cards }
  │   └─ totalCards === 0 → 后端返回 400，前端 toast 提示，不跳转
  │
  ├─ 前端 ensureWindow(0) ──→ POST /review/ai/generate × 3（card 0, 1, 2）
  │
  ▼
展示 card[0] 正面
  │
  ├─ 用户翻卡 → 检查 aiContent[card[0].id]
  │   ├─ 就绪 → 短暂动画 → 渲染 AI 内容
  │   └─ 未就绪 → 真实等待动画 → 超时降级
  │
  ├─ 用户点"存入" → PATCH /notes/:id（追加 synonyms/antonyms）
  │
  ├─ 用户评分 "记得"/"不记得"
  │   ├─ 本地更新 results（即时 UI 反馈）
  │   ├─ fire-and-forget: PATCH /review/sessions/:sessionId/rate
  │   └─ ensureWindow(current + 1)
  │
  ├─ 翻回正面 → 切换到下一张
  │
  ▼
最后一张评完
  │
  ├─ POST /review/sessions/:sessionId/end ──→ 返回 SessionSummary
  │
  ▼
展示 ReviewSummary 页面（使用后端返回的统计数据）
  │
  ├─ "再来一轮" → startReviewSession(session.params, range 调整)
  └─ "返回首页" → 清除会话 → navigate('/')


退出流程：
  用户点"退出" → 确认弹窗 → POST /review/sessions/:sessionId/abort → navigate('/review')
```

---

## 7. 后端文件结构

```
backend/src/review/
├── review.module.ts          # 已有
├── review.controller.ts      # 扩展：rate / end / abort / generate 路由
├── review.service.ts         # 扩展：rate / end / abort 业务逻辑
├── review-ai.service.ts      # 新建：AI 内容生成逻辑 + prompt 模板
├── dto/
│   ├── start-review.dto.ts   # 已有
│   ├── rate-review.dto.ts    # 新建
│   └── generate-review.dto.ts # 新建
└── types/
    └── card-ai-content.ts    # 新建：各 cardType 的 AI 返回类型定义
```

---

## 8. 不在本次范围内

- DailyActivity 联动（评分时 studyCount++）→ 归入大功能 5
- Dashboard 统计接口 → 归入大功能 6
- 复习历史回放 / 复习报告页面
- AI prompt 的 A/B 测试 / 效果优化

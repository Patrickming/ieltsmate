# 复习模块后端 + 前后端联调 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成复习系统的后端剩余接口（评分/结束/中止/AI生成）并联调前端，替换纯本地 Zustand 复习流程。

**Architecture:** 薄后端模式——后端提供 4 个新端点（rate / end / abort / ai-generate），前端 Zustand store 驱动会话流程和 AI 预取队列。AI 内容每次实时生成、不缓存，前端提前预取当前卡片起 3 张的 AI 内容。

**Tech Stack:** NestJS + Prisma + PostgreSQL（后端），React + Zustand + Vite（前端），OpenAI-compatible API（AI 调用）

**Spec:** `docs/superpowers/specs/2026-03-31-review-module-backend-integration-design.md`

---

## File Structure

### 后端新建/修改文件

| 文件 | 操作 | 职责 |
|------|------|------|
| `backend/src/review/dto/rate-review.dto.ts` | 新建 | 评分请求 DTO |
| `backend/src/review/dto/generate-review.dto.ts` | 新建 | AI 生成请求 DTO |
| `backend/src/review/types/card-ai-content.ts` | 新建 | 各 cardType 的 AI 返回类型 + cardType 映射工具 |
| `backend/src/review/review-ai.service.ts` | 新建 | AI 内容生成服务（prompt 模板 + AI 调用 + 超时降级） |
| `backend/src/review/review.service.ts` | 修改 | 新增 rate / end / abort 方法，start 增加空列表校验 |
| `backend/src/review/review.controller.ts` | 修改 | 新增 4 个路由 |
| `backend/src/review/review.module.ts` | 修改 | 引入 AiModule 依赖 + 注册 ReviewAiService |

### 前端新建/修改文件

| 文件 | 操作 | 职责 |
|------|------|------|
| `frontend/src/store/useAppStore.ts` | 修改 | ReviewSession 类型重构 + 新增异步 actions + AI 预取 |
| `frontend/src/pages/ReviewSelection.tsx` | 修改 | handleStart 改异步调后端 |
| `frontend/src/pages/ReviewCards.tsx` | 修改 | CardBack 按 cardType 分支渲染 + AI 加载动画 + "存入"持久化 + abort |
| `frontend/src/pages/ReviewSummary.tsx` | 修改 | 使用后端统计 + 真实 savedExtensionCount + 再来一轮用 params |

---

### Task 1: 后端 DTO 和类型定义

**Files:**
- Create: `backend/src/review/dto/rate-review.dto.ts`
- Create: `backend/src/review/dto/generate-review.dto.ts`
- Create: `backend/src/review/types/card-ai-content.ts`

- [ ] **Step 1: 创建 rate-review.dto.ts**

```typescript
// backend/src/review/dto/rate-review.dto.ts
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator'

export class RateReviewDto {
  @IsUUID()
  noteId!: string

  @IsIn(['easy', 'again'])
  rating!: 'easy' | 'again'

  @IsOptional()
  @IsString()
  spellingAnswer?: string
}
```

- [ ] **Step 2: 创建 generate-review.dto.ts**

```typescript
// backend/src/review/dto/generate-review.dto.ts
import { IsIn, IsUUID } from 'class-validator'

export class GenerateReviewDto {
  @IsUUID()
  noteId!: string

  @IsIn(['word-speech', 'phrase', 'synonym', 'sentence', 'spelling'])
  cardType!: 'word-speech' | 'phrase' | 'synonym' | 'sentence' | 'spelling'
}
```

- [ ] **Step 3: 创建 card-ai-content.ts（类型 + 映射工具）**

```typescript
// backend/src/review/types/card-ai-content.ts

export type CardType = 'word-speech' | 'phrase' | 'synonym' | 'sentence' | 'spelling'

const CATEGORY_TO_CARD_TYPE: Record<string, CardType> = {
  '口语': 'word-speech',
  '单词': 'word-speech',
  '短语': 'phrase',
  '同义替换': 'synonym',
  '句子': 'sentence',
  '拼写': 'spelling',
}

export function categoryToCardType(category: string): CardType | null {
  return CATEGORY_TO_CARD_TYPE[category] ?? null
}

export interface WordSpeechAI {
  fallback: false
  phonetic: string
  synonyms: string[]
  antonyms: string[]
  example: string
  memoryTip: string
}

export interface PhraseAI {
  fallback: false
  phonetic: string
  synonyms: string[]
  antonyms: string[]
  example: string
  memoryTip: string
}

export interface SynonymAI {
  fallback: false
  wordMeanings: Array<{ word: string; phonetic: string; meaning: string }>
  antonymGroup: string[]
  moreSynonyms: string[]
}

export interface SentenceAI {
  fallback: false
  analysis: string
  paraphrases: Array<{ sentence: string; dimension: string }>
}

export interface SpellingAI {
  fallback: false
  phonetic: string
  synonyms: string[]
  antonyms: string[]
  memoryTip: string
  contextExample: { sentence: string; analysis: string }
}

export interface FallbackResponse {
  fallback: true
  phonetic: string | null
  translation: string
  synonyms: string[]
  antonyms: string[]
  example: string | null
  memoryTip: string | null
}

export type CardAIContent = WordSpeechAI | PhraseAI | SynonymAI | SentenceAI | SpellingAI | FallbackResponse
```

- [ ] **Step 4: 验证编译通过**

Run: `cd backend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add backend/src/review/dto/rate-review.dto.ts backend/src/review/dto/generate-review.dto.ts backend/src/review/types/card-ai-content.ts
git commit -m "feat(review): add DTOs and type definitions for rate, generate, and card AI content"
```

---

### Task 2: 后端评分接口

**Files:**
- Modify: `backend/src/review/review.service.ts`
- Modify: `backend/src/review/review.controller.ts`

- [ ] **Step 1: 在 review.service.ts 中添加 rate 方法**

在 `ReviewService` 类中 `start()` 方法后面添加：

```typescript
async rate(sessionId: string, dto: RateReviewDto) {
  return this.prisma.$transaction(async (tx) => {
    const card = await tx.reviewSessionCard.findFirst({
      where: { sessionId, noteId: dto.noteId },
    })
    if (!card) throw new NotFoundException('Card not found in session')

    await tx.reviewSessionCard.update({
      where: { id: card.id },
      data: {
        isDone: true,
        rating: dto.rating,
        spellingAnswer: dto.spellingAnswer ?? null,
        answeredAt: new Date(),
      },
    })

    const note = await tx.note.findUniqueOrThrow({ where: { id: dto.noteId } })

    const isSpellingCorrect = dto.spellingAnswer
      ? dto.spellingAnswer.trim().toLowerCase() === note.content.trim().toLowerCase()
      : null

    await tx.reviewLog.create({
      data: {
        noteId: dto.noteId,
        sessionId,
        rating: dto.rating,
        spellingAnswer: dto.spellingAnswer ?? null,
        isSpellingCorrect,
      },
    })

    const newCorrect = note.correctCount + (dto.rating === 'easy' ? 1 : 0)
    const newWrong = note.wrongCount + (dto.rating === 'again' ? 1 : 0)

    let newStatus = note.reviewStatus
    if (note.reviewStatus === 'new') {
      newStatus = 'learning'
    }
    if (dto.rating === 'again') {
      newStatus = 'learning'
    } else if (dto.rating === 'easy' && newCorrect >= 3) {
      newStatus = 'mastered'
    }

    await tx.note.update({
      where: { id: dto.noteId },
      data: {
        reviewCount: { increment: 1 },
        correctCount: newCorrect,
        wrongCount: newWrong,
        reviewStatus: newStatus,
        lastReviewedAt: new Date(),
      },
    })

    return { ok: true }
  })
}
```

添加对应 import：

```typescript
import { NotFoundException } from '@nestjs/common'
import { RateReviewDto } from './dto/rate-review.dto'
```

- [ ] **Step 2: 在 review.controller.ts 中添加 rate 路由**

```typescript
@Patch('sessions/:sessionId/rate')
@HttpCode(HttpStatus.OK)
rate(
  @Param('sessionId') sessionId: string,
  @Body() dto: RateReviewDto,
) {
  return this.reviewService.rate(sessionId, dto)
}
```

添加 import：`Param, Patch` 到 `@nestjs/common`，以及 `RateReviewDto`。

- [ ] **Step 3: 验证编译**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add backend/src/review/review.service.ts backend/src/review/review.controller.ts
git commit -m "feat(review): add PATCH /review/sessions/:sessionId/rate endpoint"
```

---

### Task 3: 后端结束/中止接口 + Start 空列表校验

**Files:**
- Modify: `backend/src/review/review.service.ts`
- Modify: `backend/src/review/review.controller.ts`

- [ ] **Step 1: 在 review.service.ts 添加 end 方法**

```typescript
async end(sessionId: string) {
  const session = await this.prisma.reviewSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new NotFoundException('Session not found')

  await this.prisma.reviewSession.update({
    where: { id: sessionId },
    data: { status: 'completed', endedAt: new Date() },
  })

  const cards = await this.prisma.reviewSessionCard.findMany({
    where: { sessionId, isDone: true },
    include: { note: { select: { category: true } } },
  })

  const categoryMap = new Map<string, { total: number; correct: number; wrong: number }>()
  for (const c of cards) {
    const cat = c.note.category
    const entry = categoryMap.get(cat) ?? { total: 0, correct: 0, wrong: 0 }
    entry.total++
    if (c.rating === 'easy') entry.correct++
    else entry.wrong++
    categoryMap.set(cat, entry)
  }

  return {
    totalCards: cards.length,
    correctCount: cards.filter((c) => c.rating === 'easy').length,
    wrongCount: cards.filter((c) => c.rating === 'again').length,
    categoryStats: Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      ...stats,
    })),
  }
}
```

- [ ] **Step 2: 在 review.service.ts 添加 abort 方法**

```typescript
async abort(sessionId: string) {
  const session = await this.prisma.reviewSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new NotFoundException('Session not found')

  await this.prisma.reviewSession.update({
    where: { id: sessionId },
    data: { status: 'aborted', endedAt: new Date() },
  })

  return { ok: true }
}
```

- [ ] **Step 3: 修改 start 方法添加空列表校验**

在 `start()` 方法中，`const cards = ...` 行之后，`const session = ...` 事务之前添加：

```typescript
import { BadRequestException } from '@nestjs/common'

// 在 start() 方法内, cards 获取后:
if (cards.length === 0) {
  throw new BadRequestException('当前筛选条件下暂无可复习内容')
}
```

- [ ] **Step 4: 在 review.controller.ts 添加 end 和 abort 路由**

```typescript
@Post('sessions/:sessionId/end')
@HttpCode(HttpStatus.OK)
end(@Param('sessionId') sessionId: string) {
  return this.reviewService.end(sessionId)
}

@Post('sessions/:sessionId/abort')
@HttpCode(HttpStatus.OK)
abort(@Param('sessionId') sessionId: string) {
  return this.reviewService.abort(sessionId)
}
```

- [ ] **Step 5: 验证编译**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add backend/src/review/review.service.ts backend/src/review/review.controller.ts
git commit -m "feat(review): add end/abort endpoints + empty session validation"
```

---

### Task 4: 后端 ReviewAiService（AI 内容生成）

**Files:**
- Create: `backend/src/review/review-ai.service.ts`
- Modify: `backend/src/review/review.module.ts`
- Modify: `backend/src/ai/ai.module.ts`（导出 AiService）

- [ ] **Step 1: 修改 ai.module.ts 导出 AiService**

在 `backend/src/ai/ai.module.ts` 的 `@Module` 中添加 `exports: [AiService]`：

```typescript
@Module({
  imports: [SettingsModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
```

- [ ] **Step 2: 创建 review-ai.service.ts**

```typescript
// backend/src/review/review-ai.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AiService } from '../ai/ai.service'
import type { CardType, CardAIContent, FallbackResponse } from './types/card-ai-content'
import { categoryToCardType } from './types/card-ai-content'

@Injectable()
export class ReviewAiService {
  private readonly logger = new Logger(ReviewAiService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async generate(noteId: string, cardType: CardType): Promise<CardAIContent> {
    const note = await this.prisma.note.findUnique({ where: { id: noteId } })
    if (!note) return this.buildFallbackFromEmpty()

    const expectedCardType = categoryToCardType(note.category)
    if (expectedCardType && expectedCardType !== cardType) {
      throw new BadRequestException(`cardType "${cardType}" does not match note category "${note.category}"`)
    }

    const prompt = this.buildPrompt(cardType, note)

    try {
      // 用 Promise.race 实现 15 秒硬超时，因为 AiService.chat 内部的 fetch 不接受 AbortSignal
      const aiPromise = this.aiService.chat({
        messages: [
          { role: 'system', content: 'You are a helpful IELTS vocabulary assistant. Always respond with valid JSON only, no markdown fences.' },
          { role: 'user', content: prompt },
        ],
        slot: 'review',
      })
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI generation timeout (15s)')), 15_000),
      )
      const result = await Promise.race([aiPromise, timeoutPromise])

      const parsed = this.parseAIResponse(result.content, cardType)
      if (parsed) return parsed

      this.logger.warn(`AI JSON parse failed for note ${noteId}, falling back`)
      return this.buildFallback(note)
    } catch (err) {
      this.logger.warn(`AI generation failed for note ${noteId}: ${err}`)
      return this.buildFallback(note)
    }
  }

  private buildPrompt(cardType: CardType, note: { content: string; translation: string; phonetic?: string | null; synonyms?: string[]; antonyms?: string[] }): string {
    const base = `英文: "${note.content}"\n中文翻译: "${note.translation}"`

    switch (cardType) {
      case 'word-speech':
        return `${base}\n\n请为这个英文单词/短语生成以下内容，返回严格 JSON（不要 markdown）：\n{\n  "phonetic": "音标",\n  "synonyms": ["同义词1", "同义词2", "同义词3"],\n  "antonyms": ["反义词1", "反义词2"],\n  "example": "一个使用该词的英文例句",\n  "memoryTip": "记忆技巧（中文，简短实用）"\n}\n\nsynonyms 提供 3-5 个，antonyms 提供 2-3 个。`

      case 'phrase':
        return `${base}\n\n请为这个英文短语生成以下内容，返回严格 JSON（不要 markdown）：\n{\n  "phonetic": "音标",\n  "synonyms": ["同义短语1", "同义短语2", "同义短语3"],\n  "antonyms": ["反义短语1", "反义短语2"],\n  "example": "一个使用该短语的英文例句",\n  "memoryTip": "记忆技巧（中文，简短实用）"\n}\n\nsynonyms 提供 3-5 个同义短语，antonyms 提供 2-3 个反义短语。`

      case 'synonym':
        return `${base}\n\n这是一组同义替换词。请为每个词生成独立的差异化中文释义（说明使用语境和细微差异），并生成反义同义替换和更多同义替换。返回严格 JSON（不要 markdown）：\n{\n  "wordMeanings": [\n    { "word": "词1", "phonetic": "音标", "meaning": "差异化中文释义（含语境说明）" },\n    { "word": "词2", "phonetic": "音标", "meaning": "差异化中文释义（含语境说明）" }\n  ],\n  "antonymGroup": ["反义替换词1", "反义替换词2"],\n  "moreSynonyms": ["更多同义词1", "更多同义词2", "更多同义词3"]\n}\n\n每个词的 meaning 需要体现与其他同义词的差异。antonymGroup 提供 2-3 个，moreSynonyms 提供 3-5 个。`

      case 'sentence':
        return `${base}\n\n请为这个英文句子生成以下内容，返回严格 JSON（不要 markdown）：\n{\n  "analysis": "用通俗的中文解释这个句子在说什么、为什么这么说，帮助理解句意（结构标注为辅）",\n  "paraphrases": [\n    { "sentence": "替换句1（换词汇）", "dimension": "换词汇" },\n    { "sentence": "替换句2（换句式）", "dimension": "换句式" },\n    { "sentence": "替换句3（换结构）", "dimension": "换结构" }\n  ]\n}\n\n提供 2-3 个不同维度的同义替换句。analysis 重点在帮助读懂句意。`

      case 'spelling':
        return `${base}\n\n请为这个英文单词生成以下内容（用于拼写练习的背面展示），返回严格 JSON（不要 markdown）：\n{\n  "phonetic": "音标",\n  "synonyms": ["同义词1", "同义词2", "同义词3"],\n  "antonyms": ["反义词1", "反义词2"],\n  "memoryTip": "记忆技巧（中文，简短实用）",\n  "contextExample": {\n    "sentence": "一个包含该词的英文例句",\n    "analysis": "解析该词在例句中的用法和语境（中文）"\n  }\n}\n\nsynonyms 提供 3-5 个，antonyms 提供 2-3 个。`
    }
  }

  private parseAIResponse(content: string, cardType: CardType): CardAIContent | null {
    try {
      let cleaned = content.trim()
      // Strip markdown code fences if present
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
      }
      const parsed = JSON.parse(cleaned)

      switch (cardType) {
        case 'word-speech':
        case 'phrase':
          if (parsed.phonetic && Array.isArray(parsed.synonyms) && Array.isArray(parsed.antonyms)) {
            return { fallback: false, ...parsed }
          }
          return null
        case 'synonym':
          if (Array.isArray(parsed.wordMeanings) && Array.isArray(parsed.antonymGroup)) {
            return { fallback: false, ...parsed }
          }
          return null
        case 'sentence':
          if (parsed.analysis && Array.isArray(parsed.paraphrases)) {
            return { fallback: false, ...parsed }
          }
          return null
        case 'spelling':
          if (parsed.phonetic && parsed.contextExample) {
            return { fallback: false, ...parsed }
          }
          return null
      }
    } catch {
      return null
    }
  }

  private buildFallback(note: { translation: string; phonetic?: string | null; synonyms?: string[]; antonyms?: string[]; example?: string | null; memoryTip?: string | null }): FallbackResponse {
    return {
      fallback: true,
      phonetic: note.phonetic ?? null,
      translation: note.translation,
      synonyms: note.synonyms ?? [],
      antonyms: note.antonyms ?? [],
      example: note.example ?? null,
      memoryTip: note.memoryTip ?? null,
    }
  }

  private buildFallbackFromEmpty(): FallbackResponse {
    return {
      fallback: true,
      phonetic: null,
      translation: '',
      synonyms: [],
      antonyms: [],
      example: null,
      memoryTip: null,
    }
  }
}
```

- [ ] **Step 3: 更新 review.module.ts**

```typescript
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { AiModule } from '../ai/ai.module'
import { ReviewController } from './review.controller'
import { ReviewService } from './review.service'
import { ReviewAiService } from './review-ai.service'

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [ReviewController],
  providers: [ReviewService, ReviewAiService],
})
export class ReviewModule {}
```

- [ ] **Step 4: 验证编译**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add backend/src/review/review-ai.service.ts backend/src/review/review.module.ts backend/src/ai/ai.module.ts
git commit -m "feat(review): add ReviewAiService with prompt templates and fallback"
```

---

### Task 5: 后端 Generate 端点

**Files:**
- Modify: `backend/src/review/review.controller.ts`

- [ ] **Step 1: 在 review.controller.ts 添加 generate 路由**

注入 `ReviewAiService` 到 controller，添加路由：

```typescript
import { ReviewAiService } from './review-ai.service'
import { GenerateReviewDto } from './dto/generate-review.dto'

@Controller('review')
export class ReviewController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly reviewAiService: ReviewAiService,
  ) {}

  // ... existing routes ...

  @Post('ai/generate')
  @HttpCode(HttpStatus.OK)
  generate(@Body() dto: GenerateReviewDto) {
    return this.reviewAiService.generate(dto.noteId, dto.cardType)
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 3: 手动测试后端所有新端点**

启动后端 `cd backend && pnpm dev`，用 curl 逐一测试：

```bash
# 测试 start（应该返回 sessionId + cards）
curl -X POST http://127.0.0.1:3000/review/sessions/start \
  -H "Content-Type: application/json" \
  -d '{"source":"notes","range":"all","mode":"random"}'

# 测试 rate（用上面返回的 sessionId 和某张卡的 noteId）
curl -X PATCH http://127.0.0.1:3000/review/sessions/<sessionId>/rate \
  -H "Content-Type: application/json" \
  -d '{"noteId":"<noteId>","rating":"easy"}'

# 测试 end
curl -X POST http://127.0.0.1:3000/review/sessions/<sessionId>/end

# 测试 ai/generate
curl -X POST http://127.0.0.1:3000/review/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"noteId":"<noteId>","cardType":"word-speech"}'
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/review/review.controller.ts
git commit -m "feat(review): add POST /review/ai/generate endpoint"
```

---

### Task 6: 前端 Store 重构

**Files:**
- Modify: `frontend/src/store/useAppStore.ts`

这是最大的单个改动。核心变更：ReviewSession 类型 + 5 个新 async actions。

- [ ] **Step 1: 更新 ReviewSession 接口和 AppState 中的 action 签名**

在 `useAppStore.ts` 中，替换旧的 `ReviewSession` 接口：

```typescript
// 旧的:
// interface ReviewSession {
//   cards: Note[]
//   current: number
//   results: { id: string; rating: 'easy' | 'hard' | 'again' }[]
// }

// 新的:
interface StartReviewParams {
  source: 'notes' | 'favorites'
  categories?: string[]
  range: 'all' | 'wrong'
  mode: 'random' | 'continue'
}

interface CardAIContent {
  fallback: boolean
  [key: string]: unknown
}

interface ReviewSession {
  sessionId: string
  cards: Note[]
  current: number
  results: { id: string; rating: 'easy' | 'again' }[]
  params: StartReviewParams
  aiContent: Record<string, CardAIContent | null>
  aiLoading: Record<string, boolean>
  savedExtensionCount: number
}
```

更新 `AppState` 接口中的 review 部分：

```typescript
// Review session
reviewSession: ReviewSession | null
startReviewSession: (params: StartReviewParams) => Promise<boolean>
nextCard: () => void
rateCard: (noteId: string, rating: 'easy' | 'again', spellingAnswer?: string) => void
endReviewSession: () => Promise<{
  totalCards: number; correctCount: number; wrongCount: number
  categoryStats: Array<{ category: string; total: number; correct: number; wrong: number }>
} | null>
abortReviewSession: () => Promise<void>
fetchAIContent: (noteId: string, cardType: string) => Promise<void>
ensureAIWindow: (currentIdx: number) => void
incrementSavedExtensions: () => void
endReview: () => void
```

- [ ] **Step 2: 实现新的 store actions**

替换 `useAppStore` 中的 review 部分实现：

```typescript
reviewSession: null,

startReviewSession: async (params) => {
  try {
    const res = await fetch(apiUrl('/review/sessions/start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) return false
    const json = (await res.json()) as { data?: { sessionId: string; totalCards: number; cards: BackendNote[] } }
    const d = json.data
    if (!d || !d.sessionId) return false
    const cards = d.cards.map(mapBackendNote)
    set({
      reviewSession: {
        sessionId: d.sessionId,
        cards,
        current: 0,
        results: [],
        params,
        aiContent: {},
        aiLoading: {},
        savedExtensionCount: 0,
      },
    })
    // Trigger prefetch for first 3 cards
    setTimeout(() => get().ensureAIWindow(0), 0)
    return true
  } catch {
    return false
  }
},

nextCard: () => set((s) => {
  if (!s.reviewSession) return s
  const newCurrent = s.reviewSession.current + 1
  // Trigger prefetch
  setTimeout(() => get().ensureAIWindow(newCurrent), 0)
  return { reviewSession: { ...s.reviewSession, current: newCurrent } }
}),

rateCard: (noteId, rating, spellingAnswer) => {
  set((s) => {
    if (!s.reviewSession) return s
    return {
      reviewSession: {
        ...s.reviewSession,
        results: [...s.reviewSession.results, { id: noteId, rating }],
      },
    }
  })
  // Fire-and-forget backend call
  const session = get().reviewSession
  if (session) {
    fetch(apiUrl(`/review/sessions/${session.sessionId}/rate`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId, rating, spellingAnswer }),
    }).catch(() => { /* tolerate failure */ })
  }
},

endReviewSession: async () => {
  const session = get().reviewSession
  if (!session) return null
  try {
    const res = await fetch(apiUrl(`/review/sessions/${session.sessionId}/end`), {
      method: 'POST',
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: { totalCards: number; correctCount: number; wrongCount: number; categoryStats: Array<{ category: string; total: number; correct: number; wrong: number }> } }
    return json.data ?? null
  } catch {
    return null
  }
},

abortReviewSession: async () => {
  const session = get().reviewSession
  if (session) {
    await fetch(apiUrl(`/review/sessions/${session.sessionId}/abort`), {
      method: 'POST',
    }).catch(() => {})
  }
  set({ reviewSession: null })
},

fetchAIContent: async (noteId, cardType) => {
  set((s) => {
    if (!s.reviewSession) return s
    return {
      reviewSession: {
        ...s.reviewSession,
        aiLoading: { ...s.reviewSession.aiLoading, [noteId]: true },
      },
    }
  })
  try {
    const res = await fetch(apiUrl('/review/ai/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId, cardType }),
    })
    const json = (await res.json()) as { data?: CardAIContent }
    const content = json.data ?? { fallback: true }
    set((s) => {
      if (!s.reviewSession) return s
      return {
        reviewSession: {
          ...s.reviewSession,
          aiContent: { ...s.reviewSession.aiContent, [noteId]: content as CardAIContent },
          aiLoading: { ...s.reviewSession.aiLoading, [noteId]: false },
        },
      }
    })
  } catch {
    set((s) => {
      if (!s.reviewSession) return s
      return {
        reviewSession: {
          ...s.reviewSession,
          aiContent: { ...s.reviewSession.aiContent, [noteId]: { fallback: true } as CardAIContent },
          aiLoading: { ...s.reviewSession.aiLoading, [noteId]: false },
        },
      }
    })
  }
},

ensureAIWindow: (currentIdx) => {
  const session = get().reviewSession
  if (!session) return
  const { cards, aiContent, aiLoading } = session

  const getCardType = (cat: string) => {
    if (cat === '口语' || cat === '单词') return 'word-speech'
    if (cat === '短语') return 'phrase'
    if (cat === '同义替换') return 'synonym'
    if (cat === '句子') return 'sentence'
    if (cat === '拼写') return 'spelling'
    return 'word-speech'
  }

  for (let i = currentIdx; i < Math.min(currentIdx + 3, cards.length); i++) {
    const card = cards[i]
    if (!card) continue
    if (aiContent[card.id] !== undefined) continue
    if (aiLoading[card.id]) continue
    get().fetchAIContent(card.id, getCardType(card.category))
  }
},

incrementSavedExtensions: () => set((s) => {
  if (!s.reviewSession) return s
  return {
    reviewSession: {
      ...s.reviewSession,
      savedExtensionCount: s.reviewSession.savedExtensionCount + 1,
    },
  }
}),

endReview: () => set({ reviewSession: null }),
```

- [ ] **Step 3: 验证前端编译**

Run: `cd frontend && npx tsc --noEmit`

修复所有类型错误（主要是 ReviewCards / ReviewSelection / ReviewSummary 中引用旧 action 的地方会报错，暂时忽略，在后续 Task 中修复）。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/store/useAppStore.ts
git commit -m "feat(review): refactor Zustand store with async session management and AI prefetch"
```

---

### Task 7: 前端 ReviewSelection 页联调

**Files:**
- Modify: `frontend/src/pages/ReviewSelection.tsx`

- [ ] **Step 1: 改造 handleStart 为异步**

替换 `ReviewSelection` 组件中的相关代码：

1. 从 store 解构改为使用新 action：
```typescript
const { notes, favorites, startReviewSession } = useAppStore()
```

2. 添加 loading 状态：
```typescript
const [starting, setStarting] = useState(false)
```

3. 替换 `handleStart`：
```typescript
const handleStart = async () => {
  if (reviewCards.length === 0 || starting) return
  setStarting(true)
  const params: { source: 'notes' | 'favorites'; categories?: string[]; range: 'all' | 'wrong'; mode: 'random' | 'continue' } = {
    source: bigCat === '收藏夹' ? 'favorites' : 'notes',
    range,
    mode,
  }
  if (bigCat === '杂笔记' && !subCats.has('全部')) {
    params.categories = Array.from(subCats) as string[]
  }
  const ok = await startReviewSession(params)
  setStarting(false)
  if (ok) {
    navigate('/review/cards')
  } else {
    // toast 提示失败（可用简单 alert 或引入 toast 库）
    alert('当前筛选条件下暂无可复习内容')
  }
}
```

4. "开始复习"按钮添加 loading 状态：disabled 条件加 `|| starting`，文字改为 `starting ? '加载中...' : '开始复习'`。

- [ ] **Step 2: 移除旧的 `getFilteredNotes` 本地过滤逻辑的使用**

`getFilteredNotes` 仍保留用于前端预览卡片数量，但不再把 cards 传给 `startReview`——后端会做过滤。

- [ ] **Step 3: 验证前端编译**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ReviewSelection.tsx
git commit -m "feat(review): connect ReviewSelection to backend session start"
```

---

### Task 8: 前端 ReviewCards 页联调

**Files:**
- Modify: `frontend/src/pages/ReviewCards.tsx`

这是前端最大改动：CardBack 按 cardType 分支渲染 + AI 加载 + "存入"持久化 + abort。

- [ ] **Step 1: 更新 store 解构和评分逻辑**

```typescript
const { reviewSession, nextCard, rateCard, endReview, abortReviewSession, ensureAIWindow, incrementSavedExtensions, updateNote } = useAppStore()
```

更新 `handleRate`：
```typescript
const handleRate = (rating: 'easy' | 'again') => {
  rateCard(card.id, rating, cardType === 'spelling' ? spellingAnswer : undefined)
  setFlipped(false)
  setSavedSyn([])
  setSavedAnt([])
  setSpellingAnswer('')
  setTimeout(() => {
    if (current + 1 >= total) {
      navigate('/review/summary')
    } else {
      nextCard()
    }
  }, 300)
}
```

退出确认改调 abort：
```typescript
onClick={() => { abortReviewSession(); navigate('/review') }}
```

- [ ] **Step 2: 添加 AI 内容加载状态和动画组件**

在 `ReviewCards.tsx` 中添加 AI 加载组件：

```typescript
function AILoadingAnimation() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent"
      />
      <div className="flex items-center gap-1.5">
        <Sparkles size={14} className="text-primary" />
        <span className="text-sm text-text-dim">AI 正在生成内容...</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 重构 CardBack 按 cardType 分支渲染**

将 `CardBack` 组件改为接收 `aiContent` prop 并按 cardType 渲染不同内容：

```typescript
function CardBack({ note, cardType, aiContent, savedSyn, savedAnt, onSaveSyn, onSaveAnt, spellingAnswer }: {
  note: Note
  cardType: ReturnType<typeof getCardType>
  aiContent: CardAIContent | null | undefined
  savedSyn: string[]
  savedAnt: string[]
  onSaveSyn: (s: string) => void
  onSaveAnt: (s: string) => void
  spellingAnswer?: string
}) {
  // AI still loading
  if (aiContent === undefined || aiContent === null) {
    return <AILoadingAnimation />
  }

  // Fallback mode — render DB-only content + "AI 生成失败" 提示
  if (aiContent.fallback) {
    return <CardBackFallback note={note} cardType={cardType} spellingAnswer={spellingAnswer} aiContent={aiContent} />
    // CardBackFallback 顶部需显示一条提示：
    // <div className="text-xs text-yellow-500 mb-3">⚠ AI 内容生成失败，显示基础内容</div>
  }

  // AI content ready — render by cardType
  switch (cardType) {
    case 'word-speech':
    case 'phrase':
      return <CardBackWordPhrase note={note} ai={aiContent} savedSyn={savedSyn} savedAnt={savedAnt} onSaveSyn={onSaveSyn} onSaveAnt={onSaveAnt} />
    case 'synonym':
      return <CardBackSynonym note={note} ai={aiContent} />
    case 'sentence':
      return <CardBackSentence note={note} ai={aiContent} />
    case 'spelling':
      return <CardBackSpelling note={note} ai={aiContent} savedSyn={savedSyn} savedAnt={savedAnt} onSaveSyn={onSaveSyn} onSaveAnt={onSaveAnt} spellingAnswer={spellingAnswer} />
    default:
      return <CardBackWordPhrase note={note} ai={aiContent} savedSyn={savedSyn} savedAnt={savedAnt} onSaveSyn={onSaveSyn} onSaveAnt={onSaveAnt} />
  }
}
```

然后分别实现 `CardBackWordPhrase`、`CardBackSynonym`、`CardBackSentence`、`CardBackSpelling`、`CardBackFallback` 子组件。这些组件基于现有 `CardBack` 的 UI 风格，按设计文档 §5.2 的表格渲染不同内容。

**关键点：**
- `CardBackWordPhrase`：基本和现有 CardBack 相同，数据来源从 `note.*` 改为 `ai.*`
- `CardBackSynonym`：渲染 `ai.wordMeanings` 列表（每个词独立释义）+ `ai.antonymGroup` + `ai.moreSynonyms`
- `CardBackSentence`：渲染 `note.translation` + `ai.analysis` + `ai.paraphrases` 列表（带 dimension 标签）
- `CardBackSpelling`：拼写对比 + `CardBackWordPhrase` 内容 + `ai.contextExample`

- [ ] **Step 4: "存入"按钮改为调后端**

在 `onSaveSyn` / `onSaveAnt` 的处理中，除了更新本地 `savedSyn`/`savedAnt` 状态外，还需调 `PATCH /notes/:id`：

```typescript
const handleSaveSyn = async (syn: string) => {
  if (savedSyn.includes(syn)) return
  setSavedSyn((p) => [...p, syn])
  const note = card
  const newSynonyms = [...(note.synonyms ?? []), syn]
  try {
    const res = await fetch(apiUrl(`/notes/${note.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ synonyms: newSynonyms }),
    })
    if (res.ok) {
      incrementSavedExtensions()
    } else {
      setSavedSyn((p) => p.filter((s) => s !== syn))
      // TODO: toast 提示"存入失败"
    }
  } catch {
    setSavedSyn((p) => p.filter((s) => s !== syn))
    // TODO: toast 提示"存入失败"
  }
}
```

反义词 `handleSaveAnt` 同理，改 `antonyms` 字段。

- [ ] **Step 5: 传入 aiContent 到 CardBack**

在主组件翻转容器中，给 `CardBack` 传入 AI 内容：

```typescript
const aiContent = session?.aiContent[card.id]

// 在 CardBack 渲染处:
<CardBack
  note={card}
  cardType={cardType}
  aiContent={aiContent}
  savedSyn={savedSyn}
  savedAnt={savedAnt}
  onSaveSyn={handleSaveSyn}
  onSaveAnt={handleSaveAnt}
  spellingAnswer={spellingAnswer}
/>
```

- [ ] **Step 6: 验证前端编译**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/ReviewCards.tsx
git commit -m "feat(review): refactor CardBack with AI content per cardType + save to backend"
```

---

### Task 9: 前端 ReviewSummary 页联调

**Files:**
- Modify: `frontend/src/pages/ReviewSummary.tsx`

- [ ] **Step 1: 使用后端统计 + 真实 savedExtensionCount**

替换组件核心逻辑：

```typescript
export default function ReviewSummary() {
  const navigate = useNavigate()
  const { reviewSession, endReview, startReviewSession, endReviewSession } = useAppStore()
  const [summary, setSummary] = useState<{
    totalCards: number; correctCount: number; wrongCount: number
    categoryStats: Array<{ category: string; total: number; correct: number; wrong: number }>
  } | null>(null)

  // Call endReviewSession on mount (single data source)
  useEffect(() => {
    endReviewSession().then((data) => {
      if (data) setSummary(data)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const results = reviewSession?.results ?? []
  const cards = reviewSession?.cards ?? []

  // Use backend summary if available, else fall back to local
  const total = summary?.totalCards ?? results.length
  const correct = summary?.correctCount ?? results.filter((r) => r.rating === 'easy').length
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  const catStats = summary?.categoryStats ?? []
  const savedExtensions = reviewSession?.savedExtensionCount ?? 0

  const handleHome = () => {
    endReview()
    navigate('/')
  }

  const handleAgain = async () => {
    const params = reviewSession?.params
    if (!params) return
    const hasWrong = results.some((r) => r.rating === 'again')
    const ok = await startReviewSession({ ...params, range: hasWrong ? 'wrong' : 'all' })
    if (ok) navigate('/review/cards')
  }

  // ... rest of JSX, update catStats rendering to use array format
}
```

- [ ] **Step 2: 更新 catStats 渲染部分**

替换分类统计的 JSX，从 `Object.entries(catStats)` 改为直接遍历数组：

```typescript
{catStats.length > 0 && (
  <div className="bg-[#18181b] rounded-xl p-4 flex flex-col gap-2.5">
    <div className="text-xs font-semibold text-text-muted mb-1">分类统计</div>
    {catStats.map(({ category, correct: c, total: t }) => (
      <div key={category} className="flex items-center gap-3">
        <div className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: CATEGORY_BAR[category as Category] ?? '#71717a' }} />
        <span className="text-sm text-text-muted flex-1">{category}</span>
        <span className="text-sm font-medium" style={{ color: '#fbbf24' }}>
          {c}/{t} 正确
        </span>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 3: "再来一轮"按钮改为 async**

按钮的 `onClick` 改为 `handleAgain`（已在 Step 1 定义为 async）。

- [ ] **Step 4: 验证前端编译**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ReviewSummary.tsx
git commit -m "feat(review): connect ReviewSummary to backend stats and real savedExtensions"
```

---

### Task 10: 端到端联调测试

- [ ] **Step 1: 启动后端和前端**

```bash
cd /home/pdm/DEV/ieltsmate && bash start.sh
```

- [ ] **Step 2: 完整流程测试**

在浏览器中走完一轮完整复习流程：
1. 进入 `/review`，选择来源和分类，点击"开始复习"
2. 验证卡片加载成功（来自后端）
3. 翻转卡片，验证 AI 内容生成动画和内容展示
4. 测试"存入"按钮（点击后去笔记详情验证是否持久化）
5. 评分几张卡片（记得/不记得）
6. 测试"退出"→ 确认退出（验证 abort 调用）
7. 重新开始，完成全部卡片到总结页
8. 验证总结页的统计数据正确性
9. 测试"再来一轮"

- [ ] **Step 3: 修复发现的问题**

根据测试结果修复任何 bug。

- [ ] **Step 4: 最终 Commit**

```bash
git add -A
git commit -m "fix(review): polish review flow after integration testing"
```

---

### Task 11: 更新 project.md

**Files:**
- Modify: `project.md`

- [ ] **Step 1: 勾选大功能 4 中已完成的项目**

将所有已实现的待办项从 `- [ ]` 改为 `- [x]`：

```markdown
- [x] `PATCH /review/sessions/:sessionId/rate` 评分接口
- [x] `POST /review/sessions/:sessionId/end` 完成会话
- [x] `POST /review/sessions/:sessionId/abort` 中止会话
- [x] 前端 store 联调
- [x] 前端 ReviewSelection 页
- [x] 前端 ReviewCards 页
- [x] 前端 ReviewSummary 页
```

- [ ] **Step 2: Commit**

```bash
git add project.md
git commit -m "docs: mark review system tasks as complete in project.md"
```

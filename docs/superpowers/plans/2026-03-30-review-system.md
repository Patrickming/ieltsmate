# 大功能 4：复习系统全链路 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现复习系统后端评分/会话管理/总结接口，并完成前端全链路联调，替换所有本地临时状态为真实 API 调用。

**Architecture:** 后端新增评分（PATCH）、会话生命周期（GET/POST end/abort）、总结聚合（GET summary）共 5 个端点；前端 store 的 `startReview`/`rateCard`/`endReview` 全部改为异步后端驱动，UI 保持 fire-and-forget 保证流畅度；Vite proxy 增加 bypass 防止 HTML 导航被误代理。

**Tech Stack:** NestJS, Prisma, PostgreSQL（后端）；React, Zustand, Vite proxy（前端）

---

## 文件索引

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/src/review/dto/rate-card.dto.ts` | 新建 | 评分 DTO |
| `backend/src/review/dto/end-session.dto.ts` | 新建 | 结束会话 DTO（目前无字段，预留扩展）|
| `backend/src/review/review.service.ts` | 修改 | 加评分/结束/abort/summary 逻辑 |
| `backend/src/review/review.controller.ts` | 修改 | 注册新路由 |
| `backend/test/review-rate.e2e-spec.ts` | 新建 | 评分 + 总结 e2e 测试 |
| `frontend/vite.config.ts` | 修改 | 为 `/review` 代理加 bypass |
| `frontend/src/store/useAppStore.ts` | 修改 | ReviewSession 类型扩展 + 新 action |
| `frontend/src/pages/ReviewSelection.tsx` | 修改 | handleStart 改为异步调后端 |
| `frontend/src/pages/ReviewCards.tsx` | 修改 | handleRate/exit 接入后端 |
| `frontend/src/pages/ReviewSummary.tsx` | 修改 | "再来一轮" 调后端 startReviewSession |

---

## Task 1：后端 — 评分接口（4.2）

**Files:**
- 新建: `backend/src/review/dto/rate-card.dto.ts`
- 修改: `backend/src/review/review.service.ts`
- 修改: `backend/src/review/review.controller.ts`

- [ ] **Step 1.1：创建评分 DTO**

新建 `backend/src/review/dto/rate-card.dto.ts`：

```typescript
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'

export class RateCardDto {
  @IsIn(['easy', 'again'])
  rating!: 'easy' | 'again'

  @IsOptional()
  @IsString()
  @MaxLength(500)
  spellingAnswer?: string
}
```

- [ ] **Step 1.2：在 review.service.ts 实现 rate 方法**

在 `backend/src/review/review.service.ts` 末尾追加 `rate` 方法（保留原 `start` 方法不变）：

```typescript
// 在文件顶部 import 区补充
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { RateCardDto } from './dto/rate-card.dto'
```

在类内追加：

```typescript
  async rate(sessionId: string, noteId: string, dto: RateCardDto) {
    // 1. 会话必须存在且为 active
    const session = await this.prisma.reviewSession.findUnique({
      where: { id: sessionId },
    })
    if (!session) throw new NotFoundException('ReviewSession not found')
    if (session.status !== 'active') {
      throw new BadRequestException('Session is not active')
    }

    // 2. 找到对应的 SessionCard
    const card = await this.prisma.reviewSessionCard.findFirst({
      where: { sessionId, noteId },
    })
    if (!card) throw new NotFoundException('ReviewSessionCard not found')

    const isCorrect = dto.rating === 'easy'

    // 3. 事务：更新 card + note + 写 ReviewLog
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedCard = await tx.reviewSessionCard.update({
        where: { id: card.id },
        data: {
          isDone: true,
          rating: dto.rating,
          spellingAnswer: dto.spellingAnswer ?? null,
          answeredAt: new Date(),
        },
      })

      // 写 ReviewLog
      await tx.reviewLog.create({
        data: {
          noteId,
          sessionId,
          rating: dto.rating,
          spellingAnswer: dto.spellingAnswer ?? null,
          isSpellingCorrect:
            dto.spellingAnswer != null ? isCorrect : null,
        },
      })

      // 更新 Note 统计
      const note = await tx.note.findUnique({ where: { id: noteId } })
      if (!note) throw new NotFoundException('Note not found')

      const newCorrect = note.correctCount + (isCorrect ? 1 : 0)
      const newWrong = note.wrongCount + (isCorrect ? 0 : 1)
      const newCount = note.reviewCount + 1

      // reviewStatus 逻辑：easy 且 correctCount>=3 → mastered；again 倒回 learning
      let newStatus: 'new' | 'learning' | 'mastered' = 'learning'
      if (isCorrect && newCorrect >= 3) newStatus = 'mastered'

      const updatedNote = await tx.note.update({
        where: { id: noteId },
        data: {
          reviewCount: newCount,
          correctCount: newCorrect,
          wrongCount: newWrong,
          reviewStatus: newStatus,
          lastReviewedAt: new Date(),
        },
      })

      return { card: updatedCard, note: updatedNote }
    })

    return result
  }
```

- [ ] **Step 1.3：在 review.controller.ts 注册评分路由**

修改 `backend/src/review/review.controller.ts`：

```typescript
import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common'
import { RateCardDto } from './dto/rate-card.dto'
import { StartReviewDto } from './dto/start-review.dto'
import { ReviewService } from './review.service'

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post('sessions/start')
  @HttpCode(HttpStatus.CREATED)
  start(@Body() dto: StartReviewDto) {
    return this.reviewService.start(dto)
  }

  @Patch('sessions/:sessionId/notes/:noteId/rate')
  @HttpCode(HttpStatus.OK)
  rate(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Param('noteId', new ParseUUIDPipe()) noteId: string,
    @Body() dto: RateCardDto,
  ) {
    return this.reviewService.rate(sessionId, noteId, dto)
  }
}
```

- [ ] **Step 1.4：手动验证评分接口**

确认后端已重启后（或热重载），执行：

```bash
# 1. 先创建测试笔记
curl -s -X POST http://127.0.0.1:5173/notes \
  -H "Content-Type: application/json" \
  -d '{"content":"test rate","translation":"测试评分","category":"口语"}'

# 记录返回的 noteId，再启动复习会话
NOTE_ID=<上面的id>

curl -s -X POST http://127.0.0.1:5173/review/sessions/start \
  -H "Content-Type: application/json" \
  -d '{"source":"notes","categories":["口语"],"range":"all","mode":"continue"}'
# 记录返回的 sessionId

SESSION_ID=<上面的sessionId>

# 2. 评分
curl -s -X PATCH "http://127.0.0.1:5173/review/sessions/$SESSION_ID/notes/$NOTE_ID/rate" \
  -H "Content-Type: application/json" \
  -d '{"rating":"easy"}'
```

预期返回：`{ data: { card: {..., isDone: true, rating: "easy"}, note: {..., correctCount: 1, reviewStatus: "learning"} } }`

---

## Task 2：后端 — 会话生命周期接口（4.3）

**Files:**
- 修改: `backend/src/review/review.service.ts`
- 修改: `backend/src/review/review.controller.ts`

- [ ] **Step 2.1：在 review.service.ts 实现 end、abort、getSession 方法**

在 `review.service.ts` 的类内追加：

```typescript
  async endSession(sessionId: string) {
    const session = await this.prisma.reviewSession.findUnique({
      where: { id: sessionId },
    })
    if (!session) throw new NotFoundException('ReviewSession not found')

    return this.prisma.reviewSession.update({
      where: { id: sessionId },
      data: { status: 'completed', endedAt: new Date() },
    })
  }

  async abortSession(sessionId: string) {
    const session = await this.prisma.reviewSession.findUnique({
      where: { id: sessionId },
    })
    if (!session) throw new NotFoundException('ReviewSession not found')

    return this.prisma.reviewSession.update({
      where: { id: sessionId },
      data: { status: 'aborted', endedAt: new Date() },
    })
  }

  async getSession(sessionId: string) {
    const session = await this.prisma.reviewSession.findUnique({
      where: { id: sessionId },
      include: {
        cards: {
          orderBy: { orderIndex: 'asc' },
          include: { note: true },
        },
      },
    })
    if (!session) throw new NotFoundException('ReviewSession not found')
    return session
  }
```

- [ ] **Step 2.2：在 review.controller.ts 注册会话路由**

在 ReviewController 类内追加（放在 `rate` 路由之后）：

```typescript
  @Get('sessions/:sessionId')
  getSession(@Param('sessionId', new ParseUUIDPipe()) sessionId: string) {
    return this.reviewService.getSession(sessionId)
  }

  @Post('sessions/:sessionId/end')
  @HttpCode(HttpStatus.OK)
  endSession(@Param('sessionId', new ParseUUIDPipe()) sessionId: string) {
    return this.reviewService.endSession(sessionId)
  }

  @Post('sessions/:sessionId/abort')
  @HttpCode(HttpStatus.OK)
  abortSession(@Param('sessionId', new ParseUUIDPipe()) sessionId: string) {
    return this.reviewService.abortSession(sessionId)
  }
```

在文件顶部 import 里补充 `Get`：

```typescript
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common'
```

---

## Task 3：后端 — 复习总结接口（4.4）

**Files:**
- 修改: `backend/src/review/review.service.ts`
- 修改: `backend/src/review/review.controller.ts`

- [ ] **Step 3.1：在 review.service.ts 实现 getSummary 方法**

追加：

```typescript
  async getSummary(sessionId: string) {
    const session = await this.prisma.reviewSession.findUnique({
      where: { id: sessionId },
    })
    if (!session) throw new NotFoundException('ReviewSession not found')

    const doneCards = await this.prisma.reviewSessionCard.findMany({
      where: { sessionId, isDone: true },
      include: { note: { select: { category: true } } },
    })

    const total = doneCards.length
    const correct = doneCards.filter((c) => c.rating === 'easy').length
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

    // 分类统计
    const catMap: Record<string, { correct: number; total: number }> = {}
    for (const c of doneCards) {
      const cat = c.note.category
      if (!catMap[cat]) catMap[cat] = { correct: 0, total: 0 }
      catMap[cat].total++
      if (c.rating === 'easy') catMap[cat].correct++
    }
    const categoryStats = Object.entries(catMap).map(([category, stats]) => ({
      category,
      ...stats,
    }))

    return {
      sessionId,
      total,
      correct,
      accuracy,
      categoryStats,
    }
  }
```

- [ ] **Step 3.2：在 review.controller.ts 注册总结路由**

追加：

```typescript
  @Get('sessions/:sessionId/summary')
  getSummary(@Param('sessionId', new ParseUUIDPipe()) sessionId: string) {
    return this.reviewService.getSummary(sessionId)
  }
```

- [ ] **Step 3.3：手动验证总结接口**

使用 Task 1.4 中创建的 sessionId：

```bash
curl -s "http://127.0.0.1:5173/review/sessions/$SESSION_ID/summary"
```

预期：`{ data: { total: 1, correct: 1, accuracy: 100, categoryStats: [{category:"口语", correct:1, total:1}] } }`

---

## Task 4：前端基础设施 — 修复 Vite proxy bypass

**Files:**
- 修改: `frontend/vite.config.ts`

**问题：** Vite 的 `/review` 代理会拦截浏览器直接导航到 `/review`（硬刷新），返回后端 404 而不是 React SPA 页面。需要加 `bypass` 跳过 HTML 请求。

- [ ] **Step 4.1：更新 vite.config.ts 为所有代理加 bypass**

将 `frontend/vite.config.ts` 的 `server.proxy` 块替换为：

```typescript
  server: {
    proxy: {
      '/notes': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/favorites': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/review': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/health': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
    },
  },
```

- [ ] **Step 4.2：重启 Vite 验证**

硬刷新 `http://127.0.0.1:5173/review` 后页面仍正常显示 React 复习选择页（不显示 404）。

---

## Task 5：前端 Store 重构（4.5 part 1）

**Files:**
- 修改: `frontend/src/store/useAppStore.ts`

此 Task 只修改 store，不动页面。

- [ ] **Step 5.1：扩展 ReviewSession 类型，新增 action 声明**

在 `useAppStore.ts` 找到：

```typescript
interface ReviewSession {
  cards: Note[]
  current: number
  results: { id: string; rating: 'easy' | 'hard' | 'again' }[]
}
```

替换为：

```typescript
interface ReviewSession {
  sessionId: string
  source: 'notes' | 'favorites'
  categories: string[]
  range: 'all' | 'wrong'
  mode: 'random' | 'continue'
  cards: Note[]
  current: number
  results: { id: string; rating: 'easy' | 'again' }[]
}

type StartReviewParams = {
  source: 'notes' | 'favorites'
  categories: string[]
  range: 'all' | 'wrong'
  mode: 'random' | 'continue'
}
```

在 `AppState` 接口中找到 `// Review session` 区块：

```typescript
  // Review session
  reviewSession: ReviewSession | null
  startReview: (cards: Note[]) => void
  nextCard: () => void
  rateCard: (id: string, rating: 'easy' | 'hard' | 'again') => void
  endReview: () => void
```

替换为：

```typescript
  // Review session
  reviewSession: ReviewSession | null
  startReviewSession: (params: StartReviewParams) => Promise<boolean>
  nextCard: () => void
  rateCard: (id: string, rating: 'easy' | 'again') => void
  endReview: () => void
  endReviewSession: () => void
  abortReviewSession: () => void
```

- [ ] **Step 5.2：实现新 review action**

在 store 实现中找到：

```typescript
  reviewSession: null,
  startReview: (cards) => set({ reviewSession: { cards, current: 0, results: [] } }),
  nextCard: () => set((s) => {
    if (!s.reviewSession) return s
    return { reviewSession: { ...s.reviewSession, current: s.reviewSession.current + 1 } }
  }),
  rateCard: (id, rating) => set((s) => {
    if (!s.reviewSession) return s
    return {
      reviewSession: {
        ...s.reviewSession,
        results: [...s.reviewSession.results, { id, rating }],
      },
    }
  }),
  endReview: () => set({ reviewSession: null }),
```

替换为：

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
      const json = (await res.json()) as {
        data?: { sessionId: string; totalCards: number; cards: BackendNote[] }
      }
      const d = json.data
      if (!d?.sessionId) return false
      set({
        reviewSession: {
          sessionId: d.sessionId,
          source: params.source,
          categories: params.categories,
          range: params.range,
          mode: params.mode,
          cards: d.cards.map(mapBackendNote),
          current: 0,
          results: [],
        },
      })
      return true
    } catch {
      return false
    }
  },

  nextCard: () => set((s) => {
    if (!s.reviewSession) return s
    return { reviewSession: { ...s.reviewSession, current: s.reviewSession.current + 1 } }
  }),

  rateCard: (id, rating) => {
    // 1. 本地状态立即更新（保证 UI 流畅）
    set((s) => {
      if (!s.reviewSession) return s
      return {
        reviewSession: {
          ...s.reviewSession,
          results: [...s.reviewSession.results, { id, rating }],
        },
      }
    })
    // 2. 后端持久化（fire and forget，不阻塞 UI）
    const sessionId = useAppStore.getState().reviewSession?.sessionId
    if (sessionId && !id.startsWith('local-')) {
      void fetch(apiUrl(`/review/sessions/${sessionId}/notes/${id}/rate`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      }).catch(() => { /* 静默失败，本地结果已保留 */ })
    }
  },

  endReview: () => set({ reviewSession: null }),

  endReviewSession: () => {
    const sessionId = useAppStore.getState().reviewSession?.sessionId
    if (sessionId) {
      void fetch(apiUrl(`/review/sessions/${sessionId}/end`), { method: 'POST' })
        .catch(() => { /* 静默 */ })
    }
  },

  abortReviewSession: () => {
    const sessionId = useAppStore.getState().reviewSession?.sessionId
    if (sessionId) {
      void fetch(apiUrl(`/review/sessions/${sessionId}/abort`), { method: 'POST' })
        .catch(() => { /* 静默 */ })
    }
  },
```

> **注意：** `rateCard` 中调用 `useAppStore.getState()` 需要在 `create<AppState>((set, get) => ...)` 中改用 `get`（或直接用 `useAppStore.getState()`）。实际上目前 store 只用了 `set`。最简单的修改是在 `rateCard` 和 `endReviewSession`/`abortReviewSession` 中用闭包捕获 sessionId：

对于 `rateCard`，将其改为在 `set` 的回调里拿到 sessionId：

```typescript
  rateCard: (id, rating) => {
    let sessionId: string | undefined
    set((s) => {
      if (!s.reviewSession) return s
      sessionId = s.reviewSession.sessionId
      return {
        reviewSession: {
          ...s.reviewSession,
          results: [...s.reviewSession.results, { id, rating }],
        },
      }
    })
    if (sessionId && !id.startsWith('local-')) {
      void fetch(apiUrl(`/review/sessions/${sessionId}/notes/${id}/rate`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      }).catch(() => { /* 静默 */ })
    }
  },
```

对于 `endReviewSession` 和 `abortReviewSession`，类似地先 `get()` sessionId。需要在 `create` 里改用 `(set, get)`：

将 `export const useAppStore = create<AppState>((set) => ({` 改为：

```typescript
export const useAppStore = create<AppState>((set, get) => ({
```

然后这两个 action 可以用 `get().reviewSession?.sessionId`：

```typescript
  endReviewSession: () => {
    const sessionId = get().reviewSession?.sessionId
    if (sessionId) {
      void fetch(apiUrl(`/review/sessions/${sessionId}/end`), { method: 'POST' })
        .catch(() => { /* 静默 */ })
    }
  },

  abortReviewSession: () => {
    const sessionId = get().reviewSession?.sessionId
    if (sessionId) {
      void fetch(apiUrl(`/review/sessions/${sessionId}/abort`), { method: 'POST' })
        .catch(() => { /* 静默 */ })
    }
  },
```

- [ ] **Step 5.3：确认无 lint 错误**

运行（或查看 IDE lint）确认 `useAppStore.ts` 无 TypeScript 错误。

---

## Task 6：前端联调 — ReviewSelection（4.5 part 2）

**Files:**
- 修改: `frontend/src/pages/ReviewSelection.tsx`

- [ ] **Step 6.1：将 handleStart 改为异步，调用 startReviewSession**

在 `ReviewSelection.tsx` 中：

找到：
```typescript
  const { notes, favorites, startReview } = useAppStore()
```
替换为：
```typescript
  const { notes, favorites, startReviewSession } = useAppStore()
  const [starting, setStarting] = useState(false)
```

找到：
```typescript
  const handleStart = () => {
    if (reviewCards.length === 0) return
    startReview(reviewCards)
    navigate('/review/cards')
  }
```

替换为：
```typescript
  const handleStart = async () => {
    if (reviewCards.length === 0 || starting) return
    setStarting(true)
    const ok = await startReviewSession({
      source: bigCat === '收藏夹' ? 'favorites' : 'notes',
      categories: bigCat === '杂笔记' && !subCats.has('全部')
        ? Array.from(subCats).filter((c): c is string => c !== '全部')
        : [],
      range,
      mode,
    })
    setStarting(false)
    if (ok) navigate('/review/cards')
  }
```

找到"开始复习"按钮的 `onClick={handleStart}`，改为：

```typescript
onClick={() => { void handleStart() }}
```

并把按钮的 `disabled` 条件改为：

```typescript
disabled={reviewCards.length === 0 || starting}
```

按钮文字改为：

```typescript
{starting ? '准备中...' : '开始复习'}
```

---

## Task 7：前端联调 — ReviewCards（4.5 part 3）

**Files:**
- 修改: `frontend/src/pages/ReviewCards.tsx`

- [ ] **Step 7.1：接入 endReviewSession 和 abortReviewSession**

找到：
```typescript
  const { reviewSession, nextCard, rateCard, endReview } = useAppStore()
```
替换为：
```typescript
  const { reviewSession, nextCard, rateCard, endReview, endReviewSession, abortReviewSession } = useAppStore()
```

- [ ] **Step 7.2：在最后一张卡评分时调用 endReviewSession**

找到：
```typescript
  const handleRate = (rating: 'easy' | 'again') => {
    rateCard(card.id, rating)
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

替换为：
```typescript
  const handleRate = (rating: 'easy' | 'again') => {
    rateCard(card.id, rating)
    setFlipped(false)
    setSavedSyn([])
    setSavedAnt([])
    setSpellingAnswer('')
    setTimeout(() => {
      if (current + 1 >= total) {
        endReviewSession()   // 通知后端会话已完成（fire and forget）
        navigate('/review/summary')
      } else {
        nextCard()
      }
    }, 300)
  }
```

- [ ] **Step 7.3：退出时调用 abortReviewSession**

找到确认退出按钮的 `onClick`：
```typescript
onClick={() => { endReview(); navigate('/review') }}
```
替换为：
```typescript
onClick={() => { abortReviewSession(); endReview(); navigate('/review') }}
```

---

## Task 8：前端联调 — ReviewSummary（4.5 part 4）

**Files:**
- 修改: `frontend/src/pages/ReviewSummary.tsx`

ReviewSummary 当前从本地 `reviewSession.results` 读取数据，这依然有效（不需要改总结展示逻辑）。只需修改：
1. "返回首页"调用 `endReview()` 清本地状态
2. "再来一轮"用新的 `startReviewSession`，复用已存储的会话参数

- [ ] **Step 8.1：更新 store action 引用**

找到：
```typescript
  const { reviewSession, endReview, startReview, notes } = useAppStore()
```
替换为：
```typescript
  const { reviewSession, endReview, startReviewSession } = useAppStore()
```

（注：`notes` 不再需要，"再来一轮"不依赖 notes 数组，直接调后端）

- [ ] **Step 8.2：修改 handleHome**

`handleHome` 已经调用 `endReview()`，保持不变。

- [ ] **Step 8.3：修改 handleAgain**

找到：
```typescript
  const handleAgain = () => {
    const wrongCards = results
      .filter((r) => r.rating === 'again')
      .map((r) => notes.find((n) => n.id === r.id))
      .filter(Boolean) as typeof notes

    if (wrongCards.length > 0) {
      startReview(wrongCards)
      navigate('/review/cards')
    } else {
      startReview(cards)
      navigate('/review/cards')
    }
  }
```

替换为：
```typescript
  const [restarting, setRestarting] = useState(false)

  const handleAgain = async () => {
    if (!reviewSession || restarting) return
    const hasWrong = results.some((r) => r.rating === 'again')
    setRestarting(true)
    const ok = await startReviewSession({
      source: reviewSession.source,
      categories: reviewSession.categories,
      range: hasWrong ? 'wrong' : 'all',
      mode: reviewSession.mode,
    })
    setRestarting(false)
    if (ok) navigate('/review/cards')
  }
```

找到"再来一轮"按钮的 `onClick`：
```typescript
onClick={handleAgain}
```
替换为：
```typescript
onClick={() => { void handleAgain() }}
disabled={restarting}
```

按钮文字：
```typescript
{restarting ? '准备中...' : '再来一轮'}
```

---

## Task 9：e2e 测试（4.2 + 4.4）

**Files:**
- 新建: `backend/test/review-rate.e2e-spec.ts`

- [ ] **Step 9.1：新建 review-rate.e2e-spec.ts**

```typescript
import 'reflect-metadata'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { HttpExceptionFilter } from '../src/common/http-exception.filter'
import { ResponseInterceptor } from '../src/common/response.interceptor'

describe('Review Rate & Summary API', () => {
  const prisma = new PrismaClient()
  let app: INestApplication
  const noteIds: string[] = []
  const sessionIds: string[] = []

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    app.useGlobalInterceptors(new ResponseInterceptor())
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.init()
  })

  afterAll(async () => {
    if (noteIds.length > 0) {
      await prisma.reviewSessionCard.deleteMany({ where: { noteId: { in: noteIds } } })
      await prisma.reviewLog.deleteMany({ where: { noteId: { in: noteIds } } })
      await prisma.note.deleteMany({ where: { id: { in: noteIds } } })
    }
    if (sessionIds.length > 0) {
      await prisma.reviewSession.deleteMany({ where: { id: { in: sessionIds } } })
    }
    await app.close()
    await prisma.$disconnect()
  })

  it('PATCH /review/sessions/:id/notes/:noteId/rate records easy rating and updates note stats', async () => {
    // 创建笔记
    const nr = await request(app.getHttpServer())
      .post('/notes')
      .send({ content: 'rate-easy', translation: '记得', category: 'RateTest' })
      .expect(201)
    const noteId = nr.body.data.id as string
    noteIds.push(noteId)

    // 开始会话
    const sr = await request(app.getHttpServer())
      .post('/review/sessions/start')
      .send({ source: 'notes', categories: ['RateTest'], range: 'all', mode: 'continue' })
      .expect(201)
    const sessionId = sr.body.data.sessionId as string
    sessionIds.push(sessionId)

    // 评分 easy
    const rr = await request(app.getHttpServer())
      .patch(`/review/sessions/${sessionId}/notes/${noteId}/rate`)
      .send({ rating: 'easy' })
      .expect(200)

    expect(rr.body.data.card.isDone).toBe(true)
    expect(rr.body.data.card.rating).toBe('easy')
    expect(rr.body.data.note.correctCount).toBe(1)
    expect(rr.body.data.note.reviewCount).toBe(1)
    expect(rr.body.data.note.reviewStatus).toBe('learning')

    // 验证 DB
    const note = await prisma.note.findUnique({ where: { id: noteId } })
    expect(note?.correctCount).toBe(1)
    expect(note?.reviewStatus).toBe('learning')
  })

  it('PATCH /review/sessions/:id/notes/:noteId/rate mastered after 3 correct', async () => {
    const nr = await request(app.getHttpServer())
      .post('/notes')
      .send({ content: 'rate-mastered', translation: '已掌握', category: 'MasteredTest' })
      .expect(201)
    const noteId = nr.body.data.id as string
    noteIds.push(noteId)

    // 预置 correctCount = 2
    await prisma.note.update({ where: { id: noteId }, data: { correctCount: 2, reviewCount: 2 } })

    const sr = await request(app.getHttpServer())
      .post('/review/sessions/start')
      .send({ source: 'notes', categories: ['MasteredTest'], range: 'all', mode: 'continue' })
      .expect(201)
    const sessionId = sr.body.data.sessionId as string
    sessionIds.push(sessionId)

    const rr = await request(app.getHttpServer())
      .patch(`/review/sessions/${sessionId}/notes/${noteId}/rate`)
      .send({ rating: 'easy' })
      .expect(200)

    expect(rr.body.data.note.correctCount).toBe(3)
    expect(rr.body.data.note.reviewStatus).toBe('mastered')
  })

  it('POST /review/sessions/:id/end marks session as completed', async () => {
    const nr = await request(app.getHttpServer())
      .post('/notes')
      .send({ content: 'rate-end', translation: '结束', category: 'EndTest' })
      .expect(201)
    const noteId = nr.body.data.id as string
    noteIds.push(noteId)

    const sr = await request(app.getHttpServer())
      .post('/review/sessions/start')
      .send({ source: 'notes', categories: ['EndTest'], range: 'all', mode: 'continue' })
      .expect(201)
    const sessionId = sr.body.data.sessionId as string
    sessionIds.push(sessionId)

    await request(app.getHttpServer())
      .post(`/review/sessions/${sessionId}/end`)
      .expect(200)

    const session = await prisma.reviewSession.findUnique({ where: { id: sessionId } })
    expect(session?.status).toBe('completed')
    expect(session?.endedAt).not.toBeNull()
  })

  it('POST /review/sessions/:id/abort marks session as aborted', async () => {
    const nr = await request(app.getHttpServer())
      .post('/notes')
      .send({ content: 'rate-abort', translation: '中止', category: 'AbortTest' })
      .expect(201)
    const noteId = nr.body.data.id as string
    noteIds.push(noteId)

    const sr = await request(app.getHttpServer())
      .post('/review/sessions/start')
      .send({ source: 'notes', categories: ['AbortTest'], range: 'all', mode: 'continue' })
      .expect(201)
    const sessionId = sr.body.data.sessionId as string
    sessionIds.push(sessionId)

    await request(app.getHttpServer())
      .post(`/review/sessions/${sessionId}/abort`)
      .expect(200)

    const session = await prisma.reviewSession.findUnique({ where: { id: sessionId } })
    expect(session?.status).toBe('aborted')
  })

  it('GET /review/sessions/:id/summary returns aggregated stats', async () => {
    const nr = await request(app.getHttpServer())
      .post('/notes')
      .send({ content: 'rate-summary', translation: '总结', category: 'SummaryTest' })
      .expect(201)
    const noteId = nr.body.data.id as string
    noteIds.push(noteId)

    const sr = await request(app.getHttpServer())
      .post('/review/sessions/start')
      .send({ source: 'notes', categories: ['SummaryTest'], range: 'all', mode: 'continue' })
      .expect(201)
    const sessionId = sr.body.data.sessionId as string
    sessionIds.push(sessionId)

    await request(app.getHttpServer())
      .patch(`/review/sessions/${sessionId}/notes/${noteId}/rate`)
      .send({ rating: 'easy' })
      .expect(200)

    const sumRes = await request(app.getHttpServer())
      .get(`/review/sessions/${sessionId}/summary`)
      .expect(200)

    expect(sumRes.body.data.total).toBe(1)
    expect(sumRes.body.data.correct).toBe(1)
    expect(sumRes.body.data.accuracy).toBe(100)
    expect(sumRes.body.data.categoryStats).toHaveLength(1)
    expect(sumRes.body.data.categoryStats[0].category).toBe('SummaryTest')
  })
})
```

- [ ] **Step 9.2：运行 e2e 测试**

```bash
cd /home/pdm/DEV/ieltsmate/backend
pnpm test:e2e --testPathPattern="review-rate"
```

预期：所有 5 个测试 PASS。

---

## Self-Review 检查清单

- [x] **Spec coverage:**
  - Task 4.2（评分接口）→ Task 1 ✓
  - Task 4.3（进度/结束接口）→ Task 2 ✓
  - Task 4.4（总结接口）→ Task 3 ✓
  - Task 4.5（前端全链路联调）→ Task 6-8 ✓
  - Task 4.6（评分口径：首期 easy/again）→ RateCardDto `@IsIn(['easy','again'])` ✓
  - Task 4.7（中途退出语义：aborted 保留记录）→ abort endpoint + ReviewCards Task 7 ✓
  - Vite proxy bypass → Task 4 ✓

- [x] **类型一致性：**
  - `StartReviewParams.source` 与 `ReviewSession.source` 均为 `'notes' | 'favorites'` ✓
  - `rateCard(id, rating)` 签名前后一致（`'easy' | 'again'`）✓
  - `startReviewSession` 返回 `Promise<boolean>`，调用方用 `if (ok)` ✓

- [x] **No Placeholders:** 所有步骤含完整代码 ✓

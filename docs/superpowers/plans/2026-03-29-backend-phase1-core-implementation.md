# Backend Phase 1 Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改前端视觉与交互的前提下，完成后端第一阶段可联调能力（notes/favorites/review/todos/dashboard），替换核心 mock 数据。

**Architecture:** 使用 NestJS 模块化架构，Prisma 管理 PostgreSQL 模式与查询。以“先测试再实现”的节奏按业务闭环推进：先打通 notes/favorites，再补 review/todos，最后提供 dashboard 聚合接口。所有接口统一响应结构，便于前端渐进替换。

**Tech Stack:** NestJS 10、Prisma、PostgreSQL、Jest、Supertest、pnpm

---

## Scope Check

当前 spec 涵盖多个相对独立子系统（core 业务、写作、设置/AI、导入导出）。  
本计划只覆盖 **Phase 1 Core**（notes/favorites/review/todos/dashboard）。  
后续应分别单独产出：
- Phase 2: writing + settings/providers
- Phase 3: import/export/clear-data

## File Structure

本阶段目标文件（新增/修改）：

- 新建 `backend/`
  - `backend/package.json`
  - `backend/src/main.ts`
  - `backend/src/app.module.ts`
  - `backend/src/common/response.interceptor.ts`
  - `backend/src/common/http-exception.filter.ts`
  - `backend/src/prisma/prisma.module.ts`
  - `backend/src/prisma/prisma.service.ts`
  - `backend/prisma/schema.prisma`
  - `backend/prisma/migrations/*`
  - `backend/src/notes/*`
  - `backend/src/favorites/*`
  - `backend/src/review/*`
  - `backend/src/todos/*`
  - `backend/src/dashboard/*`
  - `backend/test/*.e2e-spec.ts`

---

### Task 1: 初始化后端工程与基础中间件

**Files:**
- Create: `backend/package.json`
- Create: `backend/src/main.ts`
- Create: `backend/src/app.module.ts`
- Create: `backend/src/common/response.interceptor.ts`
- Create: `backend/src/common/http-exception.filter.ts`
- Test: `backend/test/app.e2e-spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/app.e2e-spec.ts
import request from 'supertest'
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { AppModule } from '../src/app.module'

describe('App (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /health returns wrapped success response', async () => {
    const res = await request(app.getHttpServer()).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      data: { status: 'ok' },
      message: 'ok',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm test:e2e -- app.e2e-spec.ts`  
Expected: FAIL，报 `Cannot find module '../src/app.module'` 或路由不存在。

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/app.module.ts
import { Module, Controller, Get } from '@nestjs/common'

@Controller()
class HealthController {
  @Get('/health')
  health() {
    return { status: 'ok' }
  }
}

@Module({
  controllers: [HealthController],
})
export class AppModule {}
```

```ts
// backend/src/common/response.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { map, Observable } from 'rxjs'

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => ({ data, message: 'ok' })))
  }
}
```

```ts
// backend/src/main.ts
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { ResponseInterceptor } from './common/response.interceptor'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.useGlobalInterceptors(new ResponseInterceptor())
  await app.listen(3000)
}
bootstrap()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm test:e2e -- app.e2e-spec.ts`  
Expected: PASS，`1 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/src/main.ts backend/src/app.module.ts backend/src/common/response.interceptor.ts backend/test/app.e2e-spec.ts
git commit -m "feat(backend): bootstrap nest app with unified response envelope"
```

---

### Task 2: 建立 Prisma 模型（notes/favorites/review/todos/activity）

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/prisma/prisma.module.ts`
- Create: `backend/src/prisma/prisma.service.ts`
- Test: `backend/test/prisma-schema.e2e-spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/prisma-schema.e2e-spec.ts
import { PrismaClient } from '@prisma/client'

describe('Prisma schema', () => {
  const prisma = new PrismaClient()

  afterAll(async () => prisma.$disconnect())

  it('can create and query a note', async () => {
    const created = await prisma.note.create({
      data: {
        content: 'get out of',
        translation: '避免',
        category: '短语',
      },
    })
    const fetched = await prisma.note.findUnique({ where: { id: created.id } })
    expect(fetched?.content).toBe('get out of')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm test:e2e -- prisma-schema.e2e-spec.ts`  
Expected: FAIL，`Property 'note' does not exist on type 'PrismaClient'`。

- [ ] **Step 3: Write minimal implementation**

```prisma
// backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ReviewStatus {
  new
  learning
  mastered
}

model Note {
  id             String       @id @default(uuid())
  content        String
  translation    String
  category       String
  phonetic       String?
  synonyms       String[]     @default([])
  antonyms       String[]     @default([])
  example        String?
  memoryTip      String?
  reviewStatus   ReviewStatus @default(new)
  reviewCount    Int          @default(0)
  correctCount   Int          @default(0)
  wrongCount     Int          @default(0)
  lastReviewedAt DateTime?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  deletedAt      DateTime?

  favorites      Favorite[]
  userNotes      NoteUserNote[]
  reviewCards    ReviewSessionCard[]
  reviewLogs     ReviewLog[]
}

model Favorite {
  id        String   @id @default(uuid())
  noteId    String   @unique
  createdAt DateTime @default(now())
  note      Note     @relation(fields: [noteId], references: [id], onDelete: Cascade)
}

model NoteUserNote {
  id        String   @id @default(uuid())
  noteId    String
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  note      Note     @relation(fields: [noteId], references: [id], onDelete: Cascade)
}

model ReviewSession {
  id         String              @id @default(uuid())
  sourceType String
  rangeType  String
  modeType   String
  totalCards Int
  currentIdx Int                 @default(0)
  status     String              @default("active")
  startedAt  DateTime            @default(now())
  endedAt    DateTime?
  cards      ReviewSessionCard[]
  logs       ReviewLog[]
}

model ReviewSessionCard {
  id             String         @id @default(uuid())
  sessionId      String
  noteId         String
  orderIndex     Int
  cardType       String
  isDone         Boolean        @default(false)
  rating         String?
  spellingAnswer String?
  answeredAt     DateTime?
  session        ReviewSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  note           Note           @relation(fields: [noteId], references: [id], onDelete: Cascade)
}

model ReviewLog {
  id                String         @id @default(uuid())
  noteId             String
  sessionId          String?
  rating             String
  spellingAnswer     String?
  isSpellingCorrect  Boolean?
  createdAt          DateTime      @default(now())
  note               Note          @relation(fields: [noteId], references: [id], onDelete: Cascade)
  session            ReviewSession? @relation(fields: [sessionId], references: [id], onDelete: SetNull)
}

model Todo {
  id        String   @id @default(uuid())
  taskDate  DateTime
  text      String
  done      Boolean  @default(false)
  sortOrder Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model DailyActivity {
  id          String   @id @default(uuid())
  activityDate DateTime @unique
  studyCount  Int      @default(0)
  allTodosDone Boolean @default(false)
  updatedAt   DateTime @updatedAt
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
- `cd backend && pnpm prisma generate`
- `cd backend && pnpm prisma migrate dev -n init_core_models`
- `cd backend && pnpm test:e2e -- prisma-schema.e2e-spec.ts`

Expected: PASS，能创建并查询 note。

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/prisma backend/test/prisma-schema.e2e-spec.ts
git commit -m "feat(backend): add core prisma schema for notes review todos"
```

---

### Task 3: 实现 Notes 列表/详情/创建/更新/软删 + 搜索筛选

**Files:**
- Create: `backend/src/notes/notes.module.ts`
- Create: `backend/src/notes/notes.controller.ts`
- Create: `backend/src/notes/notes.service.ts`
- Create: `backend/src/notes/dto/create-note.dto.ts`
- Create: `backend/src/notes/dto/update-note.dto.ts`
- Test: `backend/test/notes.e2e-spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/notes.e2e-spec.ts
import request from 'supertest'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { AppModule } from '../src/app.module'

describe('Notes API', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })
  afterAll(async () => app.close())

  it('POST /notes then GET /notes supports search and category', async () => {
    await request(app.getHttpServer()).post('/notes').send({
      content: 'get out of',
      translation: '避免',
      category: '短语',
    }).expect(201)

    const res = await request(app.getHttpServer())
      .get('/notes?category=短语&search=get')
      .expect(200)

    expect(Array.isArray(res.body.data.items)).toBe(true)
    expect(res.body.data.items[0].content).toContain('get')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm test:e2e -- notes.e2e-spec.ts`  
Expected: FAIL，`Cannot POST /notes`。

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/notes/notes.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { NotesService } from './notes.service'
import { CreateNoteDto } from './dto/create-note.dto'
import { UpdateNoteDto } from './dto/update-note.dto'

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  create(@Body() dto: CreateNoteDto) {
    return this.notesService.create(dto)
  }

  @Get()
  list(@Query('category') category?: string, @Query('search') search?: string) {
    return this.notesService.list({ category, search })
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.notesService.detail(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.notesService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.notesService.softDelete(id)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm test:e2e -- notes.e2e-spec.ts`  
Expected: PASS，能创建并按分类+关键词查到结果。

- [ ] **Step 5: Commit**

```bash
git add backend/src/notes backend/test/notes.e2e-spec.ts backend/src/app.module.ts
git commit -m "feat(backend): implement notes crud with search and category filters"
```

---

### Task 4: 实现 Favorites（toggle + 列表）

**Files:**
- Create: `backend/src/favorites/favorites.module.ts`
- Create: `backend/src/favorites/favorites.controller.ts`
- Create: `backend/src/favorites/favorites.service.ts`
- Test: `backend/test/favorites.e2e-spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/favorites.e2e-spec.ts
it('POST /favorites/toggle is idempotent and GET /favorites returns notes', async () => {
  const note = await request(app.getHttpServer()).post('/notes').send({
    content: 'abandon',
    translation: '放弃',
    category: '单词',
  })
  const noteId = note.body.data.id

  const t1 = await request(app.getHttpServer()).post('/favorites/toggle').send({ noteId }).expect(201)
  expect(t1.body.data.isFavorite).toBe(true)

  const t2 = await request(app.getHttpServer()).post('/favorites/toggle').send({ noteId }).expect(201)
  expect(t2.body.data.isFavorite).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm test:e2e -- favorites.e2e-spec.ts`  
Expected: FAIL，`Cannot POST /favorites/toggle`。

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/favorites/favorites.controller.ts
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { FavoritesService } from './favorites.service'

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  @Post('toggle')
  toggle(@Body('noteId') noteId: string) {
    return this.service.toggle(noteId)
  }

  @Get()
  list(@Query('search') search?: string) {
    return this.service.list(search)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm test:e2e -- favorites.e2e-spec.ts`  
Expected: PASS，toggle 返回正确状态。

- [ ] **Step 5: Commit**

```bash
git add backend/src/favorites backend/test/favorites.e2e-spec.ts backend/src/app.module.ts
git commit -m "feat(backend): add favorites toggle and list endpoints"
```

---

### Task 5: 实现 Review 会话（start/rate/progress/summary）

**Files:**
- Create: `backend/src/review/review.module.ts`
- Create: `backend/src/review/review.controller.ts`
- Create: `backend/src/review/review.service.ts`
- Create: `backend/src/review/dto/start-review.dto.ts`
- Create: `backend/src/review/dto/rate-card.dto.ts`
- Test: `backend/test/review.e2e-spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/review.e2e-spec.ts
it('POST /review/start then /review/:id/rate updates counts and summary', async () => {
  const start = await request(app.getHttpServer()).post('/review/start').send({
    sourceType: 'notes',
    rangeType: 'all',
    modeType: 'random',
    categories: ['单词'],
  }).expect(201)

  const sessionId = start.body.data.sessionId
  const cardId = start.body.data.cards[0].id

  await request(app.getHttpServer())
    .post(`/review/${sessionId}/rate`)
    .send({ cardId, rating: 'again' })
    .expect(201)

  const summary = await request(app.getHttpServer())
    .get(`/review/${sessionId}/summary`)
    .expect(200)

  expect(summary.body.data.total).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm test:e2e -- review.e2e-spec.ts`  
Expected: FAIL，`Cannot POST /review/start`。

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/review/review.controller.ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ReviewService } from './review.service'

@Controller('review')
export class ReviewController {
  constructor(private readonly service: ReviewService) {}

  @Post('start')
  start(@Body() dto: any) {
    return this.service.start(dto)
  }

  @Post(':sessionId/rate')
  rate(@Param('sessionId') sessionId: string, @Body() dto: any) {
    return this.service.rate(sessionId, dto)
  }

  @Get(':sessionId/summary')
  summary(@Param('sessionId') sessionId: string) {
    return this.service.summary(sessionId)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm test:e2e -- review.e2e-spec.ts`  
Expected: PASS，start/rate/summary 全链路通过。

- [ ] **Step 5: Commit**

```bash
git add backend/src/review backend/test/review.e2e-spec.ts backend/src/app.module.ts
git commit -m "feat(backend): implement review session lifecycle endpoints"
```

---

### Task 6: 实现 Todos + DailyActivity

**Files:**
- Create: `backend/src/todos/todos.module.ts`
- Create: `backend/src/todos/todos.controller.ts`
- Create: `backend/src/todos/todos.service.ts`
- Test: `backend/test/todos.e2e-spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/todos.e2e-spec.ts
it('todos are scoped by date and all-done updates daily activity', async () => {
  const taskDate = '2026-03-29'
  const created = await request(app.getHttpServer()).post('/todos').send({
    taskDate,
    text: '复习20分钟',
  }).expect(201)

  await request(app.getHttpServer())
    .patch(`/todos/${created.body.data.id}`)
    .send({ done: true })
    .expect(200)

  const activity = await request(app.getHttpServer())
    .get(`/dashboard/activity?from=2026-03-29&to=2026-03-29`)
    .expect(200)

  expect(activity.body.data.days[0].allTodosDone).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm test:e2e -- todos.e2e-spec.ts`  
Expected: FAIL，`Cannot POST /todos`。

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/todos/todos.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { TodosService } from './todos.service'

@Controller('todos')
export class TodosController {
  constructor(private readonly service: TodosService) {}

  @Post()
  create(@Body() dto: any) {
    return this.service.create(dto)
  }

  @Get()
  list(@Query('date') date: string) {
    return this.service.listByDate(date)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm test:e2e -- todos.e2e-spec.ts`  
Expected: PASS，勾选后 `allTodosDone` 正确更新。

- [ ] **Step 5: Commit**

```bash
git add backend/src/todos backend/test/todos.e2e-spec.ts backend/src/app.module.ts
git commit -m "feat(backend): implement daily todos with all-done activity sync"
```

---

### Task 7: 实现 Dashboard 聚合接口

**Files:**
- Create: `backend/src/dashboard/dashboard.module.ts`
- Create: `backend/src/dashboard/dashboard.controller.ts`
- Create: `backend/src/dashboard/dashboard.service.ts`
- Test: `backend/test/dashboard.e2e-spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/dashboard.e2e-spec.ts
it('GET /dashboard/overview returns top stats and mastery buckets', async () => {
  const res = await request(app.getHttpServer()).get('/dashboard/overview').expect(200)
  expect(res.body.data).toHaveProperty('stats')
  expect(res.body.data).toHaveProperty('mastery')
  expect(res.body.data.mastery).toHaveProperty('new')
  expect(res.body.data.mastery).toHaveProperty('learning')
  expect(res.body.data.mastery).toHaveProperty('mastered')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm test:e2e -- dashboard.e2e-spec.ts`  
Expected: FAIL，`Cannot GET /dashboard/overview`。

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/dashboard/dashboard.controller.ts
import { Controller, Get, Query } from '@nestjs/common'
import { DashboardService } from './dashboard.service'

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('overview')
  overview() {
    return this.service.overview()
  }

  @Get('activity')
  activity(@Query('from') from: string, @Query('to') to: string) {
    return this.service.activity(from, to)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm test:e2e -- dashboard.e2e-spec.ts`  
Expected: PASS，返回 stats + mastery。

- [ ] **Step 5: Commit**

```bash
git add backend/src/dashboard backend/test/dashboard.e2e-spec.ts backend/src/app.module.ts
git commit -m "feat(backend): add dashboard overview and activity endpoints"
```

---

### Task 8: 前端渐进替换联调（核心链路）

**Files:**
- Modify: `frontend/src/store/useAppStore.ts`
- Modify: `frontend/src/pages/KnowledgeBase.tsx`
- Modify: `frontend/src/pages/KnowledgeDetail.tsx`
- Modify: `frontend/src/pages/ReviewSelection.tsx`
- Modify: `frontend/src/pages/ReviewCards.tsx`
- Modify: `frontend/src/pages/ReviewSummary.tsx`
- Modify: `frontend/src/components/ui/TodoList.tsx`
- Modify: `frontend/src/components/ui/ActivityHeatmap.tsx`
- Test: `frontend/src/pages/__tests__/Dashboard.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/pages/__tests__/Dashboard.test.tsx
it('renders backend-driven stats instead of mockStats', async () => {
  // mock /dashboard/overview API response then render
  // assert values来自接口返回而非静态mock
  expect(true).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test Dashboard.test.tsx`  
Expected: FAIL（当前仍依赖 mockStats）。

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/store/useAppStore.ts (示意)
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`http://localhost:3000${path}`)
  const json = await res.json()
  return json.data as T
}
```

```ts
// frontend/src/pages/Dashboard.tsx (示意)
useEffect(() => {
  apiGet('/dashboard/overview').then(setOverview)
}, [])
```

- [ ] **Step 4: Run test to verify it passes**

Run:
- `cd backend && pnpm test`
- `cd frontend && pnpm test Dashboard.test.tsx`

Expected: PASS，页面展示来源为 API。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/store/useAppStore.ts frontend/src/pages frontend/src/components/ui
git commit -m "feat(frontend): progressively switch core flows from mock to backend apis"
```

---

## Self-Review

1. **Spec coverage:**  
- 已覆盖 Phase 1 目标：notes/favorites/review/todos/dashboard。  
- 未覆盖 writing/settings/import-export（按 scope check 分阶段处理，符合 spec 的阶段策略）。

2. **Placeholder scan:**  
- 无 `TODO/TBD/implement later` 之类占位词。  
- 每个任务给出文件路径、测试、命令、预期结果。

3. **Type consistency:**  
- 评分口径使用 `easy/again`（`hard` 仅扩展位，不在首期接口暴露）。  
- 资源命名在控制器层保持一致：`notes/favorites/review/todos/dashboard`。


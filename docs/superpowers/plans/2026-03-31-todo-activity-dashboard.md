# Todo / 学习热力图 / 仪表盘统计 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现大功能 5+6：Todo 接后端 + 学习热力图读真实数据 + 仪表盘 4 个 StatCard 读真实统计

**Architecture:** 后端新增 TodoModule（CRUD）和 DashboardModule（stats + activity），ReviewService.rate 事务中追加 DailyActivity.studyCount 写入，前端 store 扩展 todo/activity/dashboard 状态与 actions，TodoList / ActivityHeatmap / Dashboard 替换 mock 数据。

**Tech Stack:** NestJS 10 / Prisma / PostgreSQL / React 18 / Zustand / Vite / TypeScript

---

## 文件变更地图

**新建（后端）：**
- `backend/src/common/date.util.ts` — Asia/Shanghai 日期工具函数
- `backend/src/todos/todos.module.ts`
- `backend/src/todos/todos.controller.ts`
- `backend/src/todos/todos.service.ts`
- `backend/src/todos/dto/create-todo.dto.ts`
- `backend/src/todos/dto/update-todo.dto.ts`
- `backend/src/dashboard/dashboard.module.ts`
- `backend/src/dashboard/dashboard.controller.ts`
- `backend/src/dashboard/dashboard.service.ts`

**修改（后端）：**
- `backend/src/app.module.ts` — 注册 TodosModule / DashboardModule
- `backend/src/review/review.service.ts` — rateCard 事务加 DailyActivity upsert

**修改（前端）：**
- `frontend/vite.config.ts` — 新增 /todos /activity /dashboard 代理
- `frontend/src/store/useAppStore.ts` — 新增 todo/activity/dashboard state + actions
- `frontend/src/components/ui/StatCard.tsx` — 新增 tooltip prop，value 支持 string
- `frontend/src/components/ui/TodoList.tsx` — 移除 localStorage，接 store
- `frontend/src/components/ui/ActivityHeatmap.tsx` — 移除 mock，接 store
- `frontend/src/pages/Dashboard.tsx` — 接真实 stats，移除 mockStats

---

## Task 1: Vite 代理扩展

**Files:**
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: 在 vite.config.ts 的 proxy 对象中追加三个路由**

  打开 `frontend/vite.config.ts`，在已有的 `/health` 代理块后面追加：

  ```typescript
  '/todos': {
    target: 'http://127.0.0.1:3000',
    changeOrigin: true,
    bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
  },
  '/activity': {
    target: 'http://127.0.0.1:3000',
    changeOrigin: true,
    bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
  },
  '/dashboard': {
    target: 'http://127.0.0.1:3000',
    changeOrigin: true,
    bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
  },
  ```

- [ ] **Step 2: 验证 vite.config.ts 修改后语法无误**

  ```bash
  cd /home/pdm/DEV/ieltsmate/frontend && npx tsc --noEmit --project tsconfig.app.json 2>&1 | head -20
  ```
  期望：无错误输出（或仅有与本次无关的已知警告）

---

## Task 2: 后端日期工具函数

**Files:**
- Create: `backend/src/common/date.util.ts`

- [ ] **Step 1: 创建 `backend/src/common/date.util.ts`**

  ```typescript
  import { BadRequestException } from '@nestjs/common'

  const CST_TIMEZONE = 'Asia/Shanghai'

  function getCSTDateString(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: CST_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  }

  /** 返回上海当日 00:00 对应的 UTC Date（等价于 `YYYY-MM-DDT00:00:00+08:00`）*/
  export function todayCSTMidnight(): Date {
    const dateStr = getCSTDateString(new Date())
    return new Date(`${dateStr}T00:00:00+08:00`)
  }

  /**
   * 将 "YYYY-MM-DD" 解析为上海当日 00:00 的 UTC Date。
   * 格式非法或日期无效时抛 BadRequestException（400）。
   */
  export function parseCSTDate(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException(`日期格式非法，需为 YYYY-MM-DD: ${dateStr}`)
    }
    const d = new Date(`${dateStr}T00:00:00+08:00`)
    if (isNaN(d.getTime())) {
      throw new BadRequestException(`无效日期: ${dateStr}`)
    }
    return d
  }

  /** 将 UTC Date 格式化为上海日历日字符串 "YYYY-MM-DD"*/
  export function formatCSTDate(d: Date): string {
    return getCSTDateString(d)
  }
  ```

- [ ] **Step 2: 快速验证函数逻辑正确（手动推算）**

  在 Node.js 中运行一次快速校验：
  ```bash
  cd /home/pdm/DEV/ieltsmate/backend && node -e "
  const d = new Date('2026-03-31T00:00:00+08:00');
  console.log('UTC iso:', d.toISOString()); // 期望: 2026-03-30T16:00:00.000Z
  console.log('CST str:', new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit' }).format(d)); // 期望: 2026-03-31
  "
  ```
  期望输出：
  ```
  UTC iso: 2026-03-30T16:00:00.000Z
  CST str: 2026-03-31
  ```

---

## Task 3: TodoModule 后端

**Files:**
- Create: `backend/src/todos/dto/create-todo.dto.ts`
- Create: `backend/src/todos/dto/update-todo.dto.ts`
- Create: `backend/src/todos/todos.service.ts`
- Create: `backend/src/todos/todos.controller.ts`
- Create: `backend/src/todos/todos.module.ts`

- [ ] **Step 1: 创建 `backend/src/todos/dto/create-todo.dto.ts`**

  ```typescript
  import { IsInt, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator'

  export class CreateTodoDto {
    @IsString()
    @IsNotEmpty()
    text: string

    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '日期格式需为 YYYY-MM-DD' })
    taskDate: string

    @IsOptional()
    @IsInt()
    sortOrder?: number
  }
  ```

- [ ] **Step 2: 创建 `backend/src/todos/dto/update-todo.dto.ts`**

  ```typescript
  import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator'

  export class UpdateTodoDto {
    @IsOptional()
    @IsBoolean()
    done?: boolean

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    text?: string

    @IsOptional()
    @IsInt()
    sortOrder?: number
  }
  ```

- [ ] **Step 3: 创建 `backend/src/todos/todos.service.ts`**

  ```typescript
  import { Injectable, NotFoundException } from '@nestjs/common'
  import { Prisma } from '@prisma/client'
  import { parseCSTDate, formatCSTDate } from '../common/date.util'
  import { PrismaService } from '../prisma/prisma.service'
  import { CreateTodoDto } from './dto/create-todo.dto'
  import { UpdateTodoDto } from './dto/update-todo.dto'

  type TxClient = Prisma.TransactionClient

  function formatTodo(t: { id: string; text: string; done: boolean; sortOrder: number; taskDate: Date }) {
    return {
      id: t.id,
      text: t.text,
      done: t.done,
      sortOrder: t.sortOrder,
      taskDate: formatCSTDate(t.taskDate),
    }
  }

  @Injectable()
  export class TodosService {
    constructor(private readonly prisma: PrismaService) {}

    async listByDate(dateStr: string) {
      const taskDate = parseCSTDate(dateStr)
      const nextDay = new Date(taskDate.getTime() + 24 * 60 * 60 * 1000)
      const todos = await this.prisma.todo.findMany({
        where: { taskDate: { gte: taskDate, lt: nextDay } },
        orderBy: { sortOrder: 'asc' },
      })
      return todos.map(formatTodo)
    }

    async create(dto: CreateTodoDto) {
      const taskDate = parseCSTDate(dto.taskDate)
      return this.prisma.$transaction(async (tx) => {
        const todo = await tx.todo.create({
          data: {
            text: dto.text,
            taskDate,
            sortOrder: dto.sortOrder ?? 0,
          },
        })
        await this.syncAllTodosDoneForDate(taskDate, tx)
        return formatTodo(todo)
      })
    }

    async update(id: string, dto: UpdateTodoDto) {
      const existing = await this.prisma.todo.findUnique({ where: { id } })
      if (!existing) throw new NotFoundException('Todo not found')

      if (dto.done === undefined && dto.text === undefined && dto.sortOrder === undefined) {
        return formatTodo(existing)
      }

      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.todo.update({
          where: { id },
          data: {
            ...(dto.done !== undefined ? { done: dto.done } : {}),
            ...(dto.text !== undefined ? { text: dto.text } : {}),
            ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          },
        })
        await this.syncAllTodosDoneForDate(existing.taskDate, tx)
        return formatTodo(updated)
      })
    }

    async remove(id: string) {
      const existing = await this.prisma.todo.findUnique({ where: { id } })
      if (!existing) throw new NotFoundException('Todo not found')

      await this.prisma.$transaction(async (tx) => {
        await tx.todo.delete({ where: { id } })
        await this.syncAllTodosDoneForDate(existing.taskDate, tx)
      })

      return null
    }

    private async syncAllTodosDoneForDate(taskDate: Date, tx: TxClient) {
      const nextDay = new Date(taskDate.getTime() + 24 * 60 * 60 * 1000)
      const todos = await tx.todo.findMany({
        where: { taskDate: { gte: taskDate, lt: nextDay } },
      })
      const allDone = todos.length > 0 && todos.every((t) => t.done)
      await tx.dailyActivity.upsert({
        where: { activityDate: taskDate },
        create: { activityDate: taskDate, studyCount: 0, allTodosDone: allDone },
        update: { allTodosDone: allDone },
      })
    }
  }
  ```

- [ ] **Step 4: 创建 `backend/src/todos/todos.controller.ts`**

  ```typescript
  import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common'
  import { CreateTodoDto } from './dto/create-todo.dto'
  import { UpdateTodoDto } from './dto/update-todo.dto'
  import { TodosService } from './todos.service'

  @Controller('todos')
  export class TodosController {
    constructor(private readonly todosService: TodosService) {}

    @Get()
    list(@Query('date') date: string) {
      return this.todosService.listByDate(date)
    }

    @Post()
    create(@Body() dto: CreateTodoDto) {
      return this.todosService.create(dto)
    }

    @Patch(':id')
    update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateTodoDto) {
      return this.todosService.update(id, dto)
    }

    @Delete(':id')
    remove(@Param('id', new ParseUUIDPipe()) id: string) {
      return this.todosService.remove(id)
    }
  }
  ```

- [ ] **Step 5: 创建 `backend/src/todos/todos.module.ts`**

  ```typescript
  import { Module } from '@nestjs/common'
  import { TodosController } from './todos.controller'
  import { TodosService } from './todos.service'

  @Module({
    controllers: [TodosController],
    providers: [TodosService],
  })
  export class TodosModule {}
  ```

---

## Task 4: DashboardModule 后端

**Files:**
- Create: `backend/src/dashboard/dashboard.service.ts`
- Create: `backend/src/dashboard/dashboard.controller.ts`
- Create: `backend/src/dashboard/dashboard.module.ts`

- [ ] **Step 1: 创建 `backend/src/dashboard/dashboard.service.ts`**

  ```typescript
  import { Injectable } from '@nestjs/common'
  import { BadRequestException } from '@nestjs/common'
  import { parseCSTDate, todayCSTMidnight, formatCSTDate } from '../common/date.util'
  import { PrismaService } from '../prisma/prisma.service'

  @Injectable()
  export class DashboardService {
    constructor(private readonly prisma: PrismaService) {}

    async getStats() {
      const today = todayCSTMidnight()
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

      const [createdToday, mastered, total] = await Promise.all([
        this.prisma.note.count({
          where: { deletedAt: null, createdAt: { gte: today, lt: tomorrow } },
        }),
        this.prisma.note.count({
          where: { deletedAt: null, reviewStatus: 'mastered' },
        }),
        this.prisma.note.count({ where: { deletedAt: null } }),
      ])

      const streak = await this.calcStreak(today)

      return { createdToday, mastered, streak, total }
    }

    private async calcStreak(today: Date): Promise<number> {
      const MS_PER_DAY = 24 * 60 * 60 * 1000
      const since = new Date(today.getTime() - 364 * MS_PER_DAY)

      const rows = await this.prisma.dailyActivity.findMany({
        where: { activityDate: { gte: since } },
        select: { activityDate: true, studyCount: true },
      })

      const activityMap = new Map<string, number>()
      for (const row of rows) {
        activityMap.set(formatCSTDate(row.activityDate), row.studyCount)
      }

      const todayKey = formatCSTDate(today)
      const todayCount = activityMap.get(todayKey) ?? 0

      // 锚点：今天有复习则从今天算，否则从昨天算
      const anchorOffset = todayCount > 0 ? 0 : 1
      let streak = 0

      for (let i = anchorOffset; i <= 365; i++) {
        const checkDate = new Date(today.getTime() - i * MS_PER_DAY)
        const key = formatCSTDate(checkDate)
        const count = activityMap.get(key) ?? 0
        if (count === 0) break
        streak++
      }

      return streak
    }

    async getActivity(startStr: string, endStr: string) {
      const start = parseCSTDate(startStr)
      const end = parseCSTDate(endStr)

      if (start > end) {
        throw new BadRequestException('start 不能晚于 end')
      }

      const endNextDay = new Date(end.getTime() + 24 * 60 * 60 * 1000)

      const rows = await this.prisma.dailyActivity.findMany({
        where: { activityDate: { gte: start, lt: endNextDay } },
        select: { activityDate: true, studyCount: true, allTodosDone: true },
      })

      const result: Record<string, { studyCount: number; allTodosDone: boolean }> = {}
      for (const row of rows) {
        if (row.studyCount > 0 || row.allTodosDone) {
          result[formatCSTDate(row.activityDate)] = {
            studyCount: row.studyCount,
            allTodosDone: row.allTodosDone,
          }
        }
      }

      return result
    }
  }
  ```

- [ ] **Step 2: 创建 `backend/src/dashboard/dashboard.controller.ts`**

  ```typescript
  import { Controller, Get, Query } from '@nestjs/common'
  import { DashboardService } from './dashboard.service'

  @Controller()
  export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @Get('dashboard/stats')
    stats() {
      return this.dashboardService.getStats()
    }

    @Get('activity')
    activity(@Query('start') start: string, @Query('end') end: string) {
      return this.dashboardService.getActivity(start, end)
    }
  }
  ```

- [ ] **Step 3: 创建 `backend/src/dashboard/dashboard.module.ts`**

  ```typescript
  import { Module } from '@nestjs/common'
  import { DashboardController } from './dashboard.controller'
  import { DashboardService } from './dashboard.service'

  @Module({
    controllers: [DashboardController],
    providers: [DashboardService],
  })
  export class DashboardModule {}
  ```

---

## Task 5: 注册新模块 + ReviewService 修改

**Files:**
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/review/review.service.ts`

- [ ] **Step 1: 在 `backend/src/app.module.ts` 中注册两个新模块**

  将文件内容替换为：

  ```typescript
  import { Controller, Get, Module } from '@nestjs/common'
  import { AiModule } from './ai/ai.module'
  import { DashboardModule } from './dashboard/dashboard.module'
  import { FavoritesModule } from './favorites/favorites.module'
  import { NotesModule } from './notes/notes.module'
  import { PrismaModule } from './prisma/prisma.module'
  import { ReviewModule } from './review/review.module'
  import { SettingsModule } from './settings/settings.module'
  import { TodosModule } from './todos/todos.module'

  @Controller()
  class HealthController {
    @Get('/health')
    health() {
      return { status: 'ok' }
    }
  }

  @Module({
    imports: [
      PrismaModule,
      NotesModule,
      FavoritesModule,
      ReviewModule,
      SettingsModule,
      AiModule,
      TodosModule,
      DashboardModule,
    ],
    controllers: [HealthController],
  })
  export class AppModule {}
  ```

- [ ] **Step 2: 在 `backend/src/review/review.service.ts` 的 `rate` 方法事务末尾追加 DailyActivity upsert**

  在 `review.service.ts` 顶部 import 处追加：
  ```typescript
  import { todayCSTMidnight } from '../common/date.util'
  ```

  在 `rate` 方法的 `prisma.$transaction(async (tx) => { ... })` 内，紧接在最后的 `await tx.note.update(...)` 之后、`return { ok: true }` 之前追加：

  ```typescript
  const activityDate = todayCSTMidnight()
  await tx.dailyActivity.upsert({
    where: { activityDate },
    create: { activityDate, studyCount: 1, allTodosDone: false },
    update: { studyCount: { increment: 1 } },
  })
  ```

- [ ] **Step 3: 验证后端能编译**

  ```bash
  cd /home/pdm/DEV/ieltsmate/backend && npx tsc --noEmit 2>&1 | head -30
  ```
  期望：无错误

- [ ] **Step 4: 启动后端确认无运行时报错（如后端已停止）**

  ```bash
  cd /home/pdm/DEV/ieltsmate/backend && pnpm dev &
  sleep 5
  curl -s http://127.0.0.1:3000/health
  ```
  期望：`{"data":{"status":"ok"},"message":"ok"}`

- [ ] **Step 5: 快速 curl 验证新接口可访问**

  ```bash
  # 获取今日 todos（空列表）
  curl -s "http://127.0.0.1:3000/todos?date=$(date +%Y-%m-%d)"
  # 期望: {"data":[],"message":"ok"}

  # 获取 dashboard stats
  curl -s "http://127.0.0.1:3000/dashboard/stats"
  # 期望: {"data":{"createdToday":0,"mastered":...,"streak":...,"total":...},"message":"ok"}

  # 获取 activity（今日范围）
  TODAY=$(date +%Y-%m-%d)
  curl -s "http://127.0.0.1:3000/activity?start=$TODAY&end=$TODAY"
  # 期望: {"data":{},"message":"ok"} 或有记录时返回日期键
  ```

---

## Task 6: 前端 Store 扩展

**Files:**
- Modify: `frontend/src/store/useAppStore.ts`

- [ ] **Step 1: 在 `useAppStore.ts` 顶部添加 Todo 和 Dashboard 类型定义**

  在文件顶部（`import { create }` 之后，`interface BackendNote` 之前）插入：

  ```typescript
  // ── 上海当日 YYYY-MM-DD ───────────────────────────────────────────
  function getTodayCSTString(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
  }

  interface TodoItem {
    id: string
    text: string
    done: boolean
    sortOrder: number
    taskDate: string
  }

  interface DashboardStats {
    createdToday: number
    mastered: number
    streak: number
    total: number
  }
  ```

- [ ] **Step 2: 在 `AppState` interface 中追加新字段**

  在 `// Review session` 注释所在块之前（即在 `showImport` / `closeImport` / `closeAll` 之后）追加以下接口声明：

  ```typescript
  // Todos
  todos: TodoItem[]
  todosLoading: boolean
  loadTodos: (date: string) => Promise<void>
  addTodo: (text: string, date: string) => Promise<void>
  toggleTodo: (id: string) => Promise<void>
  deleteTodo: (id: string) => Promise<void>

  // Activity (heatmap)
  activity: Record<string, { studyCount: number; allTodosDone: boolean }>
  activityLoading: boolean
  loadActivity: (start: string, end: string) => Promise<void>

  // Dashboard stats
  dashboardStats: DashboardStats | null
  dashboardStatsLoading: boolean
  loadDashboardStats: () => Promise<void>
  ```

- [ ] **Step 3: 在 `create<AppState>((set, get) => { return ({ ... }) })` 的 return 对象末尾（在 `endReview` 之后）追加实现**

  ```typescript
  // ── Todos ─────────────────────────────────────────────────────────
  todos: [],
  todosLoading: false,

  loadTodos: async (date) => {
    set({ todosLoading: true })
    try {
      const res = await fetch(apiUrl(`/todos?date=${date}`))
      if (!res.ok) return
      const json = (await res.json()) as { data?: TodoItem[] }
      if (Array.isArray(json.data)) {
        set({ todos: json.data })
      }
    } catch { /* 静默 */ } finally {
      set({ todosLoading: false })
    }
  },

  addTodo: async (text, date) => {
    const prevTodos = get().todos
    const optimisticId = `opt-${Date.now()}`
    set((s) => ({
      todos: [...s.todos, { id: optimisticId, text, done: false, sortOrder: s.todos.length, taskDate: date }],
    }))
    try {
      const res = await fetch(apiUrl('/todos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, taskDate: date }),
      })
      if (!res.ok) { set({ todos: prevTodos }); return }
      const json = (await res.json()) as { data?: TodoItem }
      if (json.data) {
        set((s) => ({ todos: s.todos.map((t) => t.id === optimisticId ? json.data! : t) }))
      }
      // activity 缓存同步
      const today = getTodayCSTString()
      const todos = get().todos
      const allDone = todos.length > 0 && todos.every((t) => t.done)
      set((s) => ({
        activity: {
          ...s.activity,
          [today]: { studyCount: s.activity[today]?.studyCount ?? 0, allTodosDone: allDone },
        },
      }))
    } catch { set({ todos: prevTodos }) }
  },

  toggleTodo: async (id) => {
    const prevTodos = get().todos
    const todo = prevTodos.find((t) => t.id === id)
    if (!todo) return
    const newDone = !todo.done
    set((s) => ({ todos: s.todos.map((t) => t.id === id ? { ...t, done: newDone } : t) }))
    try {
      const res = await fetch(apiUrl(`/todos/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: newDone }),
      })
      if (!res.ok) { set({ todos: prevTodos }); return }
      // activity 缓存同步
      const today = getTodayCSTString()
      const todos = get().todos
      const allDone = todos.length > 0 && todos.every((t) => t.done)
      set((s) => ({
        activity: {
          ...s.activity,
          [today]: { studyCount: s.activity[today]?.studyCount ?? 0, allTodosDone: allDone },
        },
      }))
    } catch { set({ todos: prevTodos }) }
  },

  deleteTodo: async (id) => {
    const prevTodos = get().todos
    set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }))
    try {
      const res = await fetch(apiUrl(`/todos/${id}`), { method: 'DELETE' })
      if (!res.ok) { set({ todos: prevTodos }); return }
      // activity 缓存同步
      const today = getTodayCSTString()
      const todos = get().todos
      const allDone = todos.length > 0 && todos.every((t) => t.done)
      set((s) => ({
        activity: {
          ...s.activity,
          [today]: { studyCount: s.activity[today]?.studyCount ?? 0, allTodosDone: allDone },
        },
      }))
    } catch { set({ todos: prevTodos }) }
  },

  // ── Activity (heatmap) ────────────────────────────────────────────
  activity: {},
  activityLoading: false,

  loadActivity: async (start, end) => {
    set({ activityLoading: true })
    try {
      const res = await fetch(apiUrl(`/activity?start=${start}&end=${end}`))
      if (!res.ok) return
      const json = (await res.json()) as { data?: Record<string, { studyCount: number; allTodosDone: boolean }> }
      if (json.data && typeof json.data === 'object') {
        set({ activity: json.data })
      }
    } catch { /* 静默，activity 保持空对象 */ } finally {
      set({ activityLoading: false })
    }
  },

  // ── Dashboard stats ───────────────────────────────────────────────
  dashboardStats: null,
  dashboardStatsLoading: false,

  loadDashboardStats: async () => {
    set({ dashboardStatsLoading: true })
    try {
      const res = await fetch(apiUrl('/dashboard/stats'))
      if (!res.ok) return
      const json = (await res.json()) as { data?: DashboardStats }
      if (json.data) {
        set({ dashboardStats: json.data })
      }
    } catch { /* 静默，dashboardStats 保持上次值 */ } finally {
      set({ dashboardStatsLoading: false })
    }
  },
  ```

- [ ] **Step 4: 验证前端 TypeScript 编译**

  ```bash
  cd /home/pdm/DEV/ieltsmate/frontend && npx tsc --noEmit --project tsconfig.app.json 2>&1 | head -30
  ```
  期望：无与本次修改相关的错误

---

## Task 7: StatCard 组件扩展

**Files:**
- Modify: `frontend/src/components/ui/StatCard.tsx`

- [ ] **Step 1: 更新 `StatCard.tsx`，支持 `tooltip` prop 和 string 类型 value**

  将 `frontend/src/components/ui/StatCard.tsx` 完整替换为：

  ```typescript
  import { useEffect, useRef, useState } from 'react'
  import { Info } from 'lucide-react'
  import { motion, useMotionValue, useSpring } from 'framer-motion'
  import { Tooltip } from './Tooltip'

  interface StatCardProps {
    value: number | string
    label: string
    sublabel?: string
    accentColor: string
    tooltip?: string
  }

  function AnimatedNumber({ target }: { target: number }) {
    const [display, setDisplay] = useState(0)
    const raw = useMotionValue(0)
    const spring = useSpring(raw, { stiffness: 80, damping: 18 })
    const started = useRef(false)

    useEffect(() => {
      if (!started.current) {
        started.current = true
        raw.set(target)
      }
    }, [raw, target])

    useEffect(() => {
      const unsub = spring.on('change', (v) => setDisplay(Math.round(v)))
      return unsub
    }, [spring])

    return <span>{display}</span>
  }

  export function StatCard({ value, label, sublabel, accentColor, tooltip }: StatCardProps) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        whileHover={{ y: -3, boxShadow: `0 8px 32px ${accentColor}22` }}
        className="flex-1 bg-surface-card border border-border rounded-lg overflow-hidden cursor-default transition-shadow"
      >
        <div className="h-[3px] w-full" style={{ background: accentColor }} />
        <div className="p-5 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <div className="text-4xl font-bold" style={{ color: accentColor }}>
              {typeof value === 'number' ? <AnimatedNumber target={value} /> : <span>{value}</span>}
            </div>
            {tooltip && (
              <Tooltip content={tooltip}>
                <Info size={13} className="text-text-subtle shrink-0 mt-1 cursor-help" />
              </Tooltip>
            )}
          </div>
          <div className="text-sm font-semibold text-text-secondary">{label}</div>
          {sublabel && <div className="text-xs text-text-dim">{sublabel}</div>}
        </div>
      </motion.div>
    )
  }
  ```

- [ ] **Step 2: 查看 Tooltip 组件接口，确认 `content` prop 名称**

  ```bash
  head -20 /home/pdm/DEV/ieltsmate/frontend/src/components/ui/Tooltip.tsx
  ```
  若 prop 名称与 `content` 不同，对应修改 Step 1 中的 `<Tooltip content={tooltip}>` 调用。

---

## Task 8: TodoList 组件改造

**Files:**
- Modify: `frontend/src/components/ui/TodoList.tsx`

- [ ] **Step 1: 将 `TodoList.tsx` 改为读写 store，移除 localStorage**

  将 `frontend/src/components/ui/TodoList.tsx` 完整替换为：

  ```typescript
  import { useState, useEffect, useRef } from 'react'
  import { Plus, Check, X, ClipboardList } from 'lucide-react'
  import { motion, AnimatePresence } from 'framer-motion'
  import { useAppStore } from '../../store/useAppStore'

  function getTodayCSTString(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
  }

  interface TodoListProps {
    onAllDone: (done: boolean) => void
  }

  export function TodoList({ onAllDone }: TodoListProps) {
    const { todos, todosLoading, loadTodos, addTodo, toggleTodo, deleteTodo } = useAppStore()
    const [modalOpen, setModalOpen] = useState(false)
    const [input, setInput] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const today = getTodayCSTString()

    useEffect(() => {
      void loadTodos(today)
    }, [today]) // eslint-disable-line react-hooks/exhaustive-deps

    const todayTodos = todos.filter((t) => t.taskDate === today)
    const doneCount = todayTodos.filter((t) => t.done).length
    const total = todayTodos.length
    const allDone = total > 0 && doneCount === total
    const progress = total > 0 ? (doneCount / total) * 100 : 0

    useEffect(() => {
      onAllDone(total > 0 && todayTodos.every((t) => t.done))
    }, [todayTodos, onAllDone, total])

    useEffect(() => {
      if (modalOpen) {
        setTimeout(() => inputRef.current?.focus(), 50)
      } else {
        setInput('')
      }
    }, [modalOpen])

    function confirmAdd() {
      const text = input.trim()
      if (!text) return
      void addTodo(text, today)
      setModalOpen(false)
    }

    if (todosLoading && todayTodos.length === 0) {
      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text-secondary">今日任务</span>
          </div>
          <div className="h-8 rounded-lg bg-[#27272a] animate-pulse" />
          <div className="h-8 rounded-lg bg-[#27272a] animate-pulse w-3/4" />
        </div>
      )
    }

    return (
      <>
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text-secondary">今日任务</span>
              {total > 0 && (
                <motion.span
                  key={allDone ? 'done' : 'progress'}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-all ${
                    allDone
                      ? 'bg-[#022c22] text-[#34d399] border border-[#065f46]'
                      : 'bg-[#27272a] text-text-subtle'
                  }`}
                >
                  {allDone ? '全部完成 ✓' : `${doneCount} / ${total}`}
                </motion.span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-medium text-text-subtle border border-border bg-[#27272a]/50 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
            >
              <Plus size={12} strokeWidth={2.5} />
              添加
            </button>
          </div>

          {/* Progress bar */}
          {total > 0 && (
            <div className="h-1 rounded-full bg-[#27272a] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: allDone ? '#34d399' : '#818cf8' }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          )}

          {/* List */}
          <div className="flex flex-col min-h-[48px]">
            <AnimatePresence initial={false}>
              {total === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center gap-2 py-5 text-center"
                >
                  <ClipboardList size={24} className="text-border-strong" />
                  <p className="text-[12px] text-text-subtle">今天还没有任务</p>
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="text-[12px] text-primary hover:underline"
                  >
                    添加第一个任务
                  </button>
                </motion.div>
              ) : (
                todayTodos.map((todo, i) => (
                  <motion.div
                    key={todo.id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, overflow: 'hidden', marginBottom: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`flex items-center gap-3 py-2.5 group ${i !== 0 ? 'border-t border-[#27272a]' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => void toggleTodo(todo.id)}
                      className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                        todo.done
                          ? 'bg-[#34d399] border-[#34d399] scale-95'
                          : 'border-[#3f3f46] bg-transparent hover:border-primary/70'
                      }`}
                    >
                      <AnimatePresence>
                        {todo.done && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <Check size={11} strokeWidth={3} className="text-[#052e16]" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>

                    <span
                      onClick={() => void toggleTodo(todo.id)}
                      className={`flex-1 text-[13px] leading-snug cursor-pointer select-none transition-all duration-200 ${
                        todo.done ? 'line-through text-text-subtle opacity-50' : 'text-text-muted'
                      }`}
                    >
                      {todo.text}
                    </span>

                    <motion.button
                      type="button"
                      onClick={() => void deleteTodo(todo.id)}
                      initial={{ opacity: 0 }}
                      whileHover={{ scale: 1.1 }}
                      className="opacity-0 group-hover:opacity-100 shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-text-subtle hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <X size={11} />
                    </motion.button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Add modal */}
        <AnimatePresence>
          {modalOpen && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[3px]"
                onClick={() => setModalOpen(false)}
              />
              <motion.div
                key="dialog"
                initial={{ opacity: 0, scale: 0.96, y: -12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -12 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] bg-[#18181b] border border-[#3f3f46] rounded-2xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8)] p-6 flex flex-col gap-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-[15px] font-semibold text-text-primary">添加今日任务</h3>
                    <p className="text-[12px] text-text-subtle mt-0.5">完成后点击左侧勾选框标记</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-text-subtle hover:text-text-muted hover:bg-[#27272a] transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-text-subtle font-medium uppercase tracking-wide">任务名称</label>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmAdd()
                      if (e.key === 'Escape') setModalOpen(false)
                    }}
                    placeholder="例如：复习20个单词…"
                    className="w-full h-11 rounded-xl bg-[#27272a] border border-[#3f3f46] px-4 text-[13px] text-text-primary placeholder:text-[#52525b] outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 h-9 rounded-xl text-[13px] font-medium text-text-muted border border-[#3f3f46] hover:border-[#52525b] hover:text-text-secondary transition-all"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={confirmAdd}
                    disabled={!input.trim()}
                    className="flex-1 h-9 rounded-xl text-[13px] font-medium bg-primary-btn text-white hover:bg-primary-btn-hover disabled:opacity-35 disabled:cursor-not-allowed transition-all"
                  >
                    确认添加
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    )
  }
  ```

---

## Task 9: ActivityHeatmap 组件改造

**Files:**
- Modify: `frontend/src/components/ui/ActivityHeatmap.tsx`

- [ ] **Step 1: 替换 `ActivityHeatmap.tsx` 中的 mock 数据为 store 数据**

  将文件顶部到 `export function ActivityHeatmap` 之前的代码修改：
  1. 删除 `generateMockActivity` 函数（第 18-34 行）
  2. 在导入处追加 `import { useAppStore } from '../../store/useAppStore'`
  3. 在 `export function ActivityHeatmap` 函数内，将 `const activity = useMemo(() => generateMockActivity(todayKey), [todayKey])` 替换为：

  ```typescript
  const { activity: storeActivity, loadActivity, activityLoading } = useAppStore()

  useEffect(() => {
    const end = todayKey
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - (WEEKS * 7 - 1))
    const start = toKey(startDate)
    void loadActivity(start, end)
  }, [todayKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const activity = useMemo(() => {
    const map: Record<string, number> = {}
    for (const [key, val] of Object.entries(storeActivity)) {
      map[key] = val.studyCount
    }
    return map
  }, [storeActivity])

  const todayAllDoneFromStore = storeActivity[todayKey]?.allTodosDone ?? false
  ```

  4. 将函数签名中的 `{ todayAllDone = false }: ActivityHeatmapProps` 改为 `({ todayAllDone: todayAllDoneProp = false }: ActivityHeatmapProps)`
  5. 在函数体内定义 `const todayAllDone = todayAllDoneFromStore || todayAllDoneProp`（优先用 store 数据）
  6. 在 loading 状态（`activityLoading && Object.keys(storeActivity).length === 0`）时在最前面追加骨架占位：

  ```tsx
  if (activityLoading && Object.keys(storeActivity).length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-6 w-32 rounded bg-[#27272a] animate-pulse" />
        <div className="h-[120px] rounded-lg bg-[#27272a] animate-pulse" />
      </div>
    )
  }
  ```

---

## Task 10: Dashboard 页面改造

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: 更新 `Dashboard.tsx`，移除 mockStats，接真实数据**

  将 `frontend/src/pages/Dashboard.tsx` 完整替换为：

  ```typescript
  import { useEffect, useCallback } from 'react'
  import { CirclePlay, Plus } from 'lucide-react'
  import { useNavigate } from 'react-router-dom'
  import { Layout } from '../components/layout/Layout'
  import { StatCard } from '../components/ui/StatCard'
  import { ActivityHeatmap } from '../components/ui/ActivityHeatmap'
  import { MasteryRing } from '../components/ui/MasteryRing'
  import { TodoList } from '../components/ui/TodoList'
  import { Button } from '../components/ui/Button'
  import { useAppStore } from '../store/useAppStore'

  export default function Dashboard() {
    const navigate = useNavigate()
    const { notes, openQuickNote, dashboardStats, dashboardStatsLoading, loadDashboardStats } = useAppStore()

    useEffect(() => {
      void loadDashboardStats()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      const main = document.querySelector('main')
      const savedScroll = sessionStorage.getItem('scroll-y:/')
      if (savedScroll && main) {
        requestAnimationFrame(() => {
          main.scrollTop = parseInt(savedScroll)
          sessionStorage.removeItem('scroll-y:/')
        })
      }
    }, [])

    const handleAllDone = useCallback((_done: boolean) => {
      // 热力图直接从 store activity 读取 allTodosDone，此处无需处理
    }, [])

    const handleStartReview = () => navigate('/review')

    const dash = dashboardStats
    const loading = dashboardStatsLoading && !dash

    return (
      <Layout title="首页">
        <div className="p-8 flex flex-col gap-6">
          {/* Section header */}
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-text-primary">仪表盘</h1>
              <p className="text-sm text-text-dim mt-1">今日学习与知识库概览</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="lg"
                icon={<CirclePlay size={14} />}
                className="h-9 min-h-9 rounded-sm text-[13px] px-4"
                onClick={handleStartReview}
              >
                开始今日复习
              </Button>
              <Button
                type="button"
                variant="primary"
                size="lg"
                icon={<Plus size={14} />}
                className="h-9 min-h-9 rounded-sm text-[13px] px-4"
                onClick={openQuickNote}
              >
                添加新笔记
              </Button>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              value={loading ? '—' : (dash?.createdToday ?? '—')}
              label="今日新增"
              accentColor="#818cf8"
              tooltip="今日新加入的笔记数"
            />
            <StatCard
              value={loading ? '—' : (dash?.mastered ?? '—')}
              label="已掌握"
              accentColor="#34d399"
              tooltip="复习评分连续 3 次 Easy 后升为已掌握"
            />
            <StatCard
              value={loading ? '—' : (dash?.streak ?? '—')}
              label="连续学习天数"
              accentColor="#fbbf24"
              tooltip="连续每日有复习记录的天数（当日尚未复习则从昨天起算）"
            />
            <StatCard
              value={loading ? '—' : (dash?.total ?? '—')}
              label="总笔记"
              accentColor="#fb7185"
              tooltip="知识库中全部笔记总数"
            />
          </div>

          {/* 学习概览 */}
          <div className="grid grid-cols-[1fr_260px] gap-5 items-start">
            <div className="flex flex-col gap-5">
              <div className="bg-surface-card border border-border rounded-xl p-5 min-w-0">
                <ActivityHeatmap />
              </div>
              <div className="bg-surface-card border border-border rounded-xl p-5">
                <TodoList onAllDone={handleAllDone} />
              </div>
            </div>
            <div className="bg-surface-card border border-border rounded-xl p-5">
              <MasteryRing notes={notes} />
            </div>
          </div>
        </div>
      </Layout>
    )
  }
  ```

- [ ] **Step 2: 验证前端完整编译**

  ```bash
  cd /home/pdm/DEV/ieltsmate/frontend && npx tsc --noEmit --project tsconfig.app.json 2>&1
  ```
  期望：无错误

- [ ] **Step 3: 启动完整服务并手动验证**

  ```bash
  bash /home/pdm/DEV/ieltsmate/start.sh
  ```

  验证清单（在浏览器 `http://127.0.0.1:5173` 操作）：
  - [ ] 仪表盘 4 个 StatCard 显示真实数字（非 12/64/7/156 硬编码），hover 数字旁的 ⓘ 图标能看到 tooltip 说明
  - [ ] 添加 todo 后列表立即显示（乐观 UI），刷新页面后 todo 仍在
  - [ ] 勾选 todo 后进度条更新，全部完成时显示「全部完成 ✓」
  - [ ] 删除 todo 后列表即时移除
  - [ ] 热力图不再显示随机颜色，今日格子颜色反映真实复习次数
  - [ ] 打开 Review 复习一张卡片评分后，热力图今日格子颜色加深

---

## 自检：Spec 覆盖验证

| Spec 要求 | 对应 Task |
|-----------|-----------|
| `GET/POST /todos` | Task 3 |
| `PATCH /todos/:id` 勾选/取消 | Task 3 |
| `DELETE /todos/:id` | Task 3 |
| 所有 todo 完成时更新 `DailyActivity.allTodosDone` | Task 3（syncAllTodosDoneForDate） |
| `GET /activity?start=&end=` | Task 4 |
| 每次评分写 `DailyActivity.studyCount++` | Task 5 |
| `GET /dashboard/stats` | Task 4 |
| 前端 TodoList 接后端 | Task 8 |
| 前端 ActivityHeatmap 接后端 | Task 9 |
| 前端 StatCard tooltip | Task 7 |
| 前端 Dashboard 接真实 stats | Task 10 |
| Vite 代理扩展 | Task 1 |
| date.util.ts Asia/Shanghai | Task 2 |

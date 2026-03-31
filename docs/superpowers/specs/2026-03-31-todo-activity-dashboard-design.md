# 设计文档：大功能 5 + 6 — Todo / 学习热力图 / 仪表盘统计

**日期**：2026-03-31  
**范围**：后端新增 TodoModule、DashboardModule；ReviewService 注入 DailyActivity 写入；前端 TodoList、ActivityHeatmap、Dashboard 替换 mock 数据  
**技术栈**：NestJS + Prisma + PostgreSQL / React + Zustand + Vite  
**单用户假设**：当前版本无多用户隔离，Todo / DailyActivity 全表共用。

---

## 1. 背景与目标

### 现状
- `TodoList` 数据全部存 `localStorage`，按日期 key（`todos-YYYY-MM-DD`）区分，无法跨会话共享，且无法联动 `DailyActivity`
- `ActivityHeatmap` 使用 `generateMockActivity()` 随机生成，每次刷新都不同，无任何真实数据
- 仪表盘 4 个 `StatCard` 全部使用 `mockStats` 硬编码（`dueToday=12 / mastered=64 / streak=7 / total=156`）
- 用户看不懂每个数字是怎么算出来的

### 目标
1. Todo 完整接后端（增删勾选、按日期查询）
2. 热力图从 `/activity` 接口加载近一年真实评分数据
3. 仪表盘 4 个 StatCard 从 `/dashboard/stats` 读取，并附带 tooltip 说明计算口径
4. 评分时自动写 `DailyActivity.studyCount`，完成所有 todo 时写 `allTodosDone`
5. 全部日期口径统一为 **Asia/Shanghai** 日历日，避免 UTC 凌晨跨日误差

---

## 2. 数据模型（Prisma — 已存在，无需新增）

```prisma
model Todo {
  id        String   @id @default(uuid())
  taskDate  DateTime             // 见下方日期存储约定
  text      String
  done      Boolean  @default(false)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model DailyActivity {
  id           String   @id @default(uuid())
  activityDate DateTime @unique   // 见下方日期存储约定
  studyCount   Int      @default(0)
  allTodosDone Boolean  @default(false)
  updatedAt    DateTime @updatedAt
}
```

### 日期存储约定（重要）

**上海当日 00:00 对应的 UTC 瞬时时间** 作为所有"日历日"字段的标准值。

- 上海时区比 UTC 快 8 小时，因此上海 `2026-03-31 00:00:00 CST` = UTC `2026-03-30T16:00:00.000Z`
- 数据库中实际存储为 `2026-03-30T16:00:00.000Z`（UTC 前一日 16:00）
- **禁止**将上海日期直接存为 `2026-03-31T00:00:00.000Z`（UTC 午夜），那是英国时间的午夜

**查询某日区间**（以上海 2026-03-31 为例）：
```
gte: 2026-03-30T16:00:00.000Z  // 上海 03-31 00:00
lt:  2026-03-31T16:00:00.000Z  // 上海 04-01 00:00
```

中国不实行夏令时，固定 +8 小时偏移，`Intl` 与手动 +8*60 效果相同；全项目统一使用 `Intl.DateTimeFormat` 或 `date-fns-tz`，**不混用**。

---

## 3. 后端设计

### 3.1 工具函数 `src/common/date.util.ts`（新增）

```typescript
// 返回上海当日 00:00 对应的 UTC Date 对象
export function todayCSTMidnight(): Date

// 将 "YYYY-MM-DD" 解析为上海当日 00:00 UTC Date，非法格式抛 BadRequestException
export function parseCSTDate(dateStr: string): Date

// 将 Date 格式化为上海日历日字符串 "YYYY-MM-DD"
export function formatCSTDate(d: Date): string
```

**实现要点**：使用 `Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai' })` 获取当日年月日，再构造 UTC 时间戳。

**边界说明**：中国无夏令时，不存在夏令时跳变问题；闰年/月初/跨年由 `Date` 对象自然处理。

---

### 3.2 TodoModule

**文件结构：**
```
backend/src/todos/
  todos.module.ts
  todos.controller.ts
  todos.service.ts
  dto/
    create-todo.dto.ts
    update-todo.dto.ts
```

**PATCH 空 body 约定**：`UpdateTodoDto` 全字段可选，若请求 body 为空对象 `{}`，视为无操作，直接返回当前 todo 数据（不报错，也不触发 `syncAllTodosDoneForDate`）。

**DTO：**
```typescript
// create-todo.dto.ts
class CreateTodoDto {
  @IsString() @IsNotEmpty() text: string
  @Matches(/^\d{4}-\d{2}-\d{2}$/) taskDate: string   // 严格 "YYYY-MM-DD" Asia/Shanghai 日历日；非法值后端 parseCSTDate 抛 400
  @IsOptional() @IsInt() sortOrder?: number
}

// update-todo.dto.ts
class UpdateTodoDto {
  @IsOptional() @IsBoolean() done?: boolean
  @IsOptional() @IsString() @IsNotEmpty() text?: string
  @IsOptional() @IsInt() sortOrder?: number
}
```

**接口：**

| Method | Path | Query | Body | 说明 |
|--------|------|-------|------|------|
| `GET` | `/todos` | `date=YYYY-MM-DD`（必填） | — | 查询某天的 todos，按 sortOrder 升序 |
| `POST` | `/todos` | — | `CreateTodoDto` | 新增 todo |
| `PATCH` | `/todos/:id` | — | `UpdateTodoDto` | 更新（勾选/改文字/改排序） |
| `DELETE` | `/todos/:id` | — | — | 硬删除 |

**参数校验与错误：**
- `date` 缺失或格式非 `YYYY-MM-DD`：返回 `400 Bad Request`，body 使用全局 `HttpExceptionFilter` 格式
- `start > end`（activity 接口同）：返回 `400 Bad Request`
- `id` 不存在：返回 `404 Not Found`

**响应示例（GET /todos?date=2026-03-31）：**
```json
{
  "data": [
    { "id": "uuid", "text": "复习20个单词", "done": false, "sortOrder": 0, "taskDate": "2026-03-31" }
  ],
  "message": "ok"
}
```

**响应示例（POST /todos）：**
```json
{
  "data": { "id": "uuid", "text": "背单词", "done": false, "sortOrder": 0, "taskDate": "2026-03-31" },
  "message": "ok"
}
```

**响应示例（PATCH /todos/:id）：**
```json
{
  "data": { "id": "uuid", "text": "背单词", "done": true, "sortOrder": 0, "taskDate": "2026-03-31" },
  "message": "ok"
}
```

**响应示例（DELETE /todos/:id）：**
```json
{ "data": null, "message": "ok" }
```

---

### 3.3 allTodosDone 同步规则（TodosService）

**触发时机：POST、PATCH、DELETE 任何改变该日 todo 集合或 done 状态的操作后，统一调用 `syncAllTodosDoneForDate(taskDate)`。**

```typescript
private async syncAllTodosDoneForDate(taskDate: Date, tx: PrismaClient) {
  const todos = await tx.todo.findMany({ where: { taskDate } })
  const allDone = todos.length > 0 && todos.every(t => t.done)
  await tx.dailyActivity.upsert({
    where: { activityDate: taskDate },
    create: { activityDate: taskDate, studyCount: 0, allTodosDone: allDone },
    update: { allTodosDone: allDone },
  })
}
```

**所有写操作均包裹在 `prisma.$transaction` 中，先执行主操作，再调用 `syncAllTodosDoneForDate`，保证原子性。**

---

### 3.4 DashboardModule

**文件结构：**
```
backend/src/dashboard/
  dashboard.module.ts
  dashboard.controller.ts    # 同时挂载 /activity 和 /dashboard/stats
  dashboard.service.ts
```

**接口一：`GET /dashboard/stats`**

字段计算口径：

| 字段 | 计算逻辑 | 前端 Tooltip 说明文案 |
|------|----------|----------------------|
| `createdToday` | `deletedAt IS NULL` 且 `createdAt` 在今日（Asia/Shanghai）区间内的笔记数 | "今日新加入的笔记数" |
| `mastered` | `reviewStatus = 'mastered'` 且 `deletedAt IS NULL` | "复习评分连续 3 次 Easy 后升为已掌握" |
| `streak` | 从今天向前连续查找 `DailyActivity.studyCount > 0` 的天数（见下方 streak 规则） | "连续每日有复习记录的天数（当日尚未复习则从昨天起算）" |
| `total` | `deletedAt IS NULL` 的全部笔记数 | "知识库中全部笔记总数" |

> **命名说明**：字段命名由 `dueToday`（原前端 mockStats 字段名，语义为"今日到期"）改为 `createdToday`（语义为"今日新建"），前端对应更新。

**streak 规则：**
- 若今天（Asia/Shanghai 日历日）`DailyActivity.studyCount > 0`，从今天起向前连续计数
- 若今天尚无记录或 `studyCount = 0`，**从昨天起**向前连续计数（产品口径：今天还没开始复习不算断）

**streak 算法（按日历日逐日检查，不能只扫 DB 行）：**
```
1. 确定锚点日（anchorDate）：今天有 studyCount>0 则 anchor=今天，否则 anchor=昨天
2. 从锚点日起，循环 i = 0, 1, 2 ... 最多 365 天：
   a. 计算 checkDate = anchorDate - i 天
   b. 在 activityMap（Map<YYYY-MM-DD, DailyActivity>）中查找 checkDate
   c. 若不存在或 studyCount = 0，停止循环
   d. 否则 streak++
3. 返回 streak
```

**实现方式**：先用 Prisma 查近 365 天的 `DailyActivity` 行（`activityDate >= 365天前`），载入内存 Map，再执行上述循环。不做全表扫描，也不直接对 DB 行做 DESC 遍历（避免漏掉不连续日的断档）。

**响应示例：**
```json
{
  "data": {
    "createdToday": 3,
    "mastered": 42,
    "streak": 7,
    "total": 128
  },
  "message": "ok"
}
```

---

**接口二：`GET /activity?start=YYYY-MM-DD&end=YYYY-MM-DD`**

- `start` / `end` 均必填，格式为 `YYYY-MM-DD`，`start > end` 返回 400
- 日期区间**闭区间**（包含 start 和 end 两端）
- 只返回有记录的日期（`studyCount > 0` 或 `allTodosDone = true`），其余日期前端默认 0
- 日期 key 为 Asia/Shanghai 格式 `YYYY-MM-DD`

**响应示例：**
```json
{
  "data": {
    "2026-03-28": { "studyCount": 5, "allTodosDone": false },
    "2026-03-31": { "studyCount": 12, "allTodosDone": true }
  },
  "message": "ok"
}
```

---

### 3.5 ReviewService 修改（DailyActivity.studyCount 写入）

在 `review.service.ts` 的 `rateCard` 方法现有 `prisma.$transaction` 数组末尾追加：

```typescript
prisma.dailyActivity.upsert({
  where: { activityDate: todayCSTMidnight() },
  create: { activityDate: todayCSTMidnight(), studyCount: 1, allTodosDone: false },
  update: { studyCount: { increment: 1 } },
})
```

> 注意：此 upsert 不修改 `allTodosDone`（由 Todo 侧管理），因此 `update` 只递增 `studyCount`；`create` 初始 `allTodosDone: false`，符合「该日同时可以有 allTodosDone 记录或无」的逻辑。

---

## 4. 前端设计

### 4.1 useAppStore 新增 State & Actions

```typescript
// State
todos: TodoItem[]
todosLoading: boolean
activity: Record<string, { studyCount: number; allTodosDone: boolean }>
activityLoading: boolean
dashboardStats: { createdToday: number; mastered: number; streak: number; total: number } | null
dashboardStatsLoading: boolean

// Actions
loadTodos: (date: string) => Promise<void>
addTodo: (text: string, date: string) => Promise<void>
toggleTodo: (id: string, currentDone: boolean) => Promise<void>
deleteTodo: (id: string) => Promise<void>
loadActivity: (start: string, end: string) => Promise<void>
loadDashboardStats: () => Promise<void>
```

---

### 4.2 乐观更新与失败回滚策略

所有 Todo 写操作（`addTodo` / `toggleTodo` / `deleteTodo`）采用**乐观更新 + 失败回滚**：

```
1. 记录操作前的 todos 快照（prevTodos）
2. 立即更新 store 中的 todos（乐观 UI）
3. 发起 HTTP 请求
4. 请求成功：丢弃快照
5. 请求失败：console.error，将 todos 还原为 prevTodos（回滚）
```

> 不弹全局错误提示，保持与现有笔记/收藏操作失败处理风格一致。

---

### 4.3 TodoList 组件改造

- 组件 mount 时调用 `loadTodos(today)`，`today` 为 Asia/Shanghai 当日 `YYYY-MM-DD`
- 移除全部 `localStorage` 读写逻辑（`loadTodos` / `saveTodos` / `todayKey()`）
- 本地 `useState` 不再单独维护 todos，直接读 store 的 `todos`
- `onAllDone` 回调：根据 store `todos` 计算 `todos.every(t => t.done)`，与乐观更新同步（失败回滚后自动恢复正确状态）
- **activity 缓存同步**：每次 Todo 写操作成功后，在 store action 内直接更新 `activity[today].allTodosDone`（乐观更新）；无需重新调用 `loadActivity`，避免全量重取

---

### 4.4 ActivityHeatmap 组件改造

- mount 时自动计算近 52 周区间（`start` = 今天 -363 天，`end` = 今天），调用 `loadActivity(start, end)`
- 将 `generateMockActivity()` 替换为 store 的 `activity` 数据
- `todayAllDone` 直接从 `activity[todayKey]?.allTodosDone ?? false` 获取，不再需要 `Dashboard` 传入（prop 可保留用于向下兼容，优先用 activity 数据）
- loading 期间显示 `Skeleton` 骨架占位

---

### 4.5 Dashboard 页面改造

- mount 时调用 `loadDashboardStats()`
- 4 个 StatCard 从 `dashboardStats` 读取；`dashboardStatsLoading` 时显示 `—`，请求失败保持上次值（无上次值则 `—`）
- 移除 `mockStats` 导入

**StatCard tooltip 实现：**
- `StatCard` 组件新增可选 `tooltip?: string` prop
- 在 value 旁渲染 `Info`（lucide-react）图标，hover 时显示已有 `Tooltip` 组件
- 不改变 StatCard 现有布局

**4 个 StatCard 配置：**
```tsx
<StatCard value={dashboardStats?.createdToday ?? '—'} label="今日新增"    tooltip="今日新加入的笔记数" />
<StatCard value={dashboardStats?.mastered ?? '—'}     label="已掌握"      tooltip="复习评分连续 3 次 Easy 后升为已掌握" />
<StatCard value={dashboardStats?.streak ?? '—'}       label="连续学习天数" tooltip="连续每日有复习记录的天数（当日尚未复习则从昨天起算）" />
<StatCard value={dashboardStats?.total ?? '—'}        label="总笔记"      tooltip="知识库中全部笔记总数" />
```

---

## 5. 错误处理

| 场景 | 处理 |
|------|------|
| Todo 接口请求失败 | 乐观更新回滚，console.error，不弹窗 |
| `date` / `start` / `end` 格式非法 | 后端返回 400，前端 console.error |
| `start > end`（activity 接口） | 后端返回 400，前端 activityLoading=false，activity 保持不变 |
| Todo id 不存在 | 后端返回 404，前端回滚乐观更新 |
| `/dashboard/stats` 失败 | dashboardStats 保持上次值（无则 null），StatCard 显示 `—` |
| `/activity` 失败 | activity 保持空对象，热力图全灰（与「无记录」展示相同，产品接受） |
| `rateCard` 事务中 DailyActivity upsert 失败 | 整体事务回滚，前端收到 500，保持现有错误处理逻辑 |

---

## 6. 不在本次范围内

- 写作文件模块（大功能 7）
- 导入/导出（大功能 9）
- Todo 排序拖拽
- 多用户支持
- 复习提醒推送

---

## 7. 文件变更清单

**新建：**
- `backend/src/common/date.util.ts`
- `backend/src/todos/todos.module.ts`
- `backend/src/todos/todos.controller.ts`
- `backend/src/todos/todos.service.ts`
- `backend/src/todos/dto/create-todo.dto.ts`
- `backend/src/todos/dto/update-todo.dto.ts`
- `backend/src/dashboard/dashboard.module.ts`
- `backend/src/dashboard/dashboard.controller.ts`（同时挂载 `/activity` 和 `/dashboard/stats`）
- `backend/src/dashboard/dashboard.service.ts`

**修改：**
- `backend/src/app.module.ts`（注册 TodosModule、DashboardModule）
- `backend/src/review/review.service.ts`（rateCard 事务加 DailyActivity studyCount upsert）
- `frontend/src/store/useAppStore.ts`（新增 todo/activity/dashboard state & actions）
- `frontend/src/components/ui/TodoList.tsx`（接后端，移除 localStorage，使用 store）
- `frontend/src/components/ui/ActivityHeatmap.tsx`（接后端，移除 mock）
- `frontend/src/components/ui/StatCard.tsx`（新增 tooltip prop）
- `frontend/src/pages/Dashboard.tsx`（接后端，移除 mockStats，字段名 dueToday→createdToday）

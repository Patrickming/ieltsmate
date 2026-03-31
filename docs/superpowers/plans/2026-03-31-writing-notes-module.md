# 写作文件模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将知识库写作 Tab 与写作详情页从硬编码 mock 数据切换为后端实时读取磁盘 `.md` 文件的真实数据。

**Architecture:** 新增 NestJS `WritingModule`，通过 `GET /writing-notes` 扫描 `笔记/写作笔记/` 目录返回列表，`GET /writing-notes/:id` 读取对应 `.md` 文件并替换图片路径；NestJS `ServeStaticModule` 将 `笔记/` 目录挂载到 `/writing-assets` 供前端直接访问图片；前端 Zustand store 新增 `writingNotes` 状态，`KnowledgeBase` 与 `WritingNoteDetail` 替换 mock 数据源。

**Tech Stack:** NestJS 10, @nestjs/serve-static, Node.js fs, React + Zustand, Vite proxy

---

## 文件清单

| 操作 | 路径 | 说明 |
|------|------|------|
| Create | `backend/src/writing/writing.service.ts` | 磁盘扫描 + 文件读取 + 图片路径替换 |
| Create | `backend/src/writing/writing.controller.ts` | GET /writing-notes, GET /writing-notes/:id |
| Create | `backend/src/writing/writing.module.ts` | 模块注册 |
| Modify | `backend/src/app.module.ts` | 引入 WritingModule + ServeStaticModule |
| Modify | `frontend/vite.config.ts` | 新增 /writing-notes 和 /writing-assets 代理 |
| Modify | `frontend/src/store/useAppStore.ts` | 新增 WritingNoteItem 类型、writingNotes 状态、loadWritingNotes action |
| Modify | `frontend/src/App.tsx` | 启动时调用 loadWritingNotes() |
| Modify | `frontend/src/pages/KnowledgeBase.tsx` | 替换 WRITING_NOTES 常量为 store 数据 |
| Modify | `frontend/src/pages/WritingNoteDetail.tsx` | 删除 WRITING_NOTES_CONTENT，改为 fetch API |

---

## Task 1: 安装 @nestjs/serve-static

**Files:**
- Modify: `backend/package.json`（自动更新）

- [ ] **Step 1: 在 backend 目录安装依赖**

```bash
cd /home/pdm/DEV/ieltsmate/backend && pnpm add @nestjs/serve-static serve-static
```

Expected output: 包含 `@nestjs/serve-static` 的安装成功信息，无报错。

- [ ] **Step 2: 验证安装**

```bash
cd /home/pdm/DEV/ieltsmate/backend && node -e "require('@nestjs/serve-static'); console.log('ok')"
```

Expected output: `ok`

---

## Task 2: 创建 WritingService

**Files:**
- Create: `backend/src/writing/writing.service.ts`

- [ ] **Step 1: 创建目录并写入 writing.service.ts**

创建文件 `backend/src/writing/writing.service.ts`，内容如下：

```typescript
import { Injectable, NotFoundException } from '@nestjs/common'
import { join } from 'path'
import * as fs from 'fs'

const ALLOWED_IDS = ['大作文', '小作文'] as const
type WritingId = (typeof ALLOWED_IDS)[number]

export function getNotesRoot(): string {
  if (process.env.NOTES_ROOT) return process.env.NOTES_ROOT
  // ts-node dev: __dirname = backend/src/writing/，往上三层到仓库根，再进 笔记/
  return join(__dirname, '../../../笔记')
}

export interface WritingNoteItem {
  id: string
  name: string
  path: string
  writingType: '大作文' | '小作文'
  updatedAt: string
}

export interface WritingNoteDetail extends WritingNoteItem {
  content: string
}

@Injectable()
export class WritingService {
  private resolveMdFile(id: WritingId): string {
    const dir = join(getNotesRoot(), '写作笔记', id)
    if (!fs.existsSync(dir)) throw new NotFoundException(`写作目录不存在：${id}`)
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .sort()
    if (files.length === 0) throw new NotFoundException(`目录中未找到 .md 文件：${id}`)
    return join(dir, files[0])
  }

  list(): WritingNoteItem[] {
    return ALLOWED_IDS.flatMap((id) => {
      try {
        const filePath = this.resolveMdFile(id)
        const stat = fs.statSync(filePath)
        const name = filePath.split('/').pop()!
        return [
          {
            id,
            name,
            path: `笔记/写作笔记/${id}/${name}`,
            writingType: id,
            updatedAt: stat.mtime.toISOString(),
          },
        ]
      } catch {
        return []
      }
    })
  }

  findOne(id: string): WritingNoteDetail {
    if (!ALLOWED_IDS.includes(id as WritingId)) {
      throw new NotFoundException(`写作笔记不存在：${id}`)
    }
    const safeId = id as WritingId
    const filePath = this.resolveMdFile(safeId)
    const stat = fs.statSync(filePath)
    const name = filePath.split('/').pop()!
    let content = fs.readFileSync(filePath, 'utf-8')
    // 替换相对图片路径为可访问的绝对路径
    content = content.replace(
      /\.\/assets\//g,
      `/writing-assets/写作笔记/${safeId}/assets/`,
    )
    return {
      id: safeId,
      name,
      path: `笔记/写作笔记/${safeId}/${name}`,
      writingType: safeId,
      updatedAt: stat.mtime.toISOString(),
      content,
    }
  }
}
```

- [ ] **Step 2: 验证 TypeScript 无报错**

```bash
cd /home/pdm/DEV/ieltsmate/backend && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected output: 无任何 error 输出（warning 可忽略）。

---

## Task 3: 创建 WritingController 与 WritingModule

**Files:**
- Create: `backend/src/writing/writing.controller.ts`
- Create: `backend/src/writing/writing.module.ts`

- [ ] **Step 1: 创建 writing.controller.ts**

```typescript
import { Controller, Get, Param } from '@nestjs/common'
import { WritingService } from './writing.service'

@Controller('writing-notes')
export class WritingController {
  constructor(private readonly writingService: WritingService) {}

  @Get()
  list() {
    return this.writingService.list()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.writingService.findOne(id)
  }
}
```

- [ ] **Step 2: 创建 writing.module.ts**

```typescript
import { Module } from '@nestjs/common'
import { WritingController } from './writing.controller'
import { WritingService } from './writing.service'

@Module({
  controllers: [WritingController],
  providers: [WritingService],
  exports: [WritingService],
})
export class WritingModule {}
```

- [ ] **Step 3: 验证 TypeScript 无报错**

```bash
cd /home/pdm/DEV/ieltsmate/backend && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected output: 无 error 输出。

---

## Task 4: 更新 app.module.ts

**Files:**
- Modify: `backend/src/app.module.ts`

当前文件（`backend/src/app.module.ts`）内容：

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

- [ ] **Step 1: 将 app.module.ts 替换为以下内容**

```typescript
import { Controller, Get, Module } from '@nestjs/common'
import { ServeStaticModule } from '@nestjs/serve-static'
import { AiModule } from './ai/ai.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { FavoritesModule } from './favorites/favorites.module'
import { NotesModule } from './notes/notes.module'
import { PrismaModule } from './prisma/prisma.module'
import { ReviewModule } from './review/review.module'
import { SettingsModule } from './settings/settings.module'
import { TodosModule } from './todos/todos.module'
import { WritingModule } from './writing/writing.module'
import { getNotesRoot } from './writing/writing.service'

@Controller()
class HealthController {
  @Get('/health')
  health() {
    return { status: 'ok' }
  }
}

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: getNotesRoot(),
      serveRoot: '/writing-assets',
      serveStaticOptions: { index: false },
    }),
    PrismaModule,
    NotesModule,
    FavoritesModule,
    ReviewModule,
    SettingsModule,
    AiModule,
    TodosModule,
    DashboardModule,
    WritingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 2: 验证 TypeScript 无报错**

```bash
cd /home/pdm/DEV/ieltsmate/backend && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected output: 无 error 输出。

- [ ] **Step 3: 启动后端并验证接口**

```bash
# 若后端已在运行，先停止（Ctrl+C 或 kill），再重启
cd /home/pdm/DEV/ieltsmate/backend && pnpm dev &
sleep 5

# 测试列表接口
curl -s http://127.0.0.1:3000/writing-notes | python3 -m json.tool
```

Expected output（大致）：
```json
{
  "data": [
    {
      "id": "大作文",
      "name": "大作文.md",
      "path": "笔记/写作笔记/大作文/大作文.md",
      "writingType": "大作文",
      "updatedAt": "2026-..."
    },
    {
      "id": "小作文",
      "name": "小作文.md",
      "path": "笔记/写作笔记/小作文/小作文.md",
      "writingType": "小作文",
      "updatedAt": "2026-..."
    }
  ],
  "message": "ok"
}
```

- [ ] **Step 4: 验证详情接口**

```bash
curl -s "http://127.0.0.1:3000/writing-notes/%E5%A4%A7%E4%BD%9C%E6%96%87" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'], len(d['data']['content']), 'chars')"
```

Expected output: `大作文 <数字> chars`（content 字段非空）

- [ ] **Step 5: 验证图片路径替换**

```bash
curl -s "http://127.0.0.1:3000/writing-notes/%E5%A4%A7%E4%BD%9C%E6%96%87" | python3 -c "import sys,json; d=json.load(sys.stdin); lines=[l for l in d['data']['content'].split('\n') if './assets/' in l]; print('BAD remaining:', len(lines)); lines2=[l for l in d['data']['content'].split('\n') if '/writing-assets/' in l]; print('GOOD replaced:', len(lines2))"
```

Expected output:
```
BAD remaining: 0
GOOD replaced: <数字大于0>
```

- [ ] **Step 6: 验证静态图片文件可访问**

```bash
# 取第一张图片的路径（从 markdown 内容中提取）
IMG=$(curl -s "http://127.0.0.1:3000/writing-notes/%E5%A4%A7%E4%BD%9C%E6%96%87" | python3 -c "import sys,json,re; d=json.load(sys.stdin); m=re.search(r'(/writing-assets/[^\)\"]+\.png)', d['data']['content']); print(m.group(1) if m else 'no-img')")
echo "Testing: $IMG"
curl -o /dev/null -s -w "%{http_code}" "http://127.0.0.1:3000$IMG"
```

Expected output: `200`

- [ ] **Step 7: 验证 404 防穿越**

```bash
curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/writing-notes/../../etc/passwd"
curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/writing-notes/nonexistent"
```

Expected output: 两行均为 `404`

---

## Task 5: 更新 Vite 代理配置

**Files:**
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: 在 vite.config.ts 中 `/dashboard` 代理块后追加两条新代理**

当前文件 `frontend/vite.config.ts` 第 55-59 行（`/dashboard` 块）后面，将整个 `proxy` 对象替换为：

```typescript
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
      '/settings': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/ai': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/health': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
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
      '/writing-notes': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/writing-assets': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
    },
```

---

## Task 6: 更新 Zustand Store

**Files:**
- Modify: `frontend/src/store/useAppStore.ts`

- [ ] **Step 1: 在 AppState interface 的 `endReview` 前插入 writingNotes 类型定义与状态接口**

在 `useAppStore.ts` 顶部（`interface TodoItem` 附近），在 `interface DashboardStats` 之后、`interface BackendNote` 之前插入以下类型定义：

```typescript
interface WritingNoteItem {
  id: string
  name: string
  path: string
  writingType: '大作文' | '小作文'
  updatedAt: string
}
```

- [ ] **Step 2: 在 AppState interface 中 `endReview: () => void` 行前插入 writingNotes 状态声明**

```typescript
  // Writing notes
  writingNotes: WritingNoteItem[]
  writingNotesLoading: boolean
  loadWritingNotes: () => Promise<void>
```

- [ ] **Step 3: 在 store 实现体中（`loadDashboardStats` 实现块末尾、`endReview` 前）插入实现**

找到文件中 `loadDashboardStats` 的实现结束处（约第 1204 行），在其后、`endReview` 之前插入：

```typescript
  // ── Writing notes ─────────────────────────────────────────────────
  writingNotes: [],
  writingNotesLoading: false,

  loadWritingNotes: async () => {
    set({ writingNotesLoading: true })
    try {
      const res = await fetch(apiUrl('/writing-notes'))
      if (!res.ok) return
      const json = (await res.json()) as { data?: WritingNoteItem[] }
      if (json.data) {
        set({ writingNotes: json.data })
      }
    } catch { /* 静默，writingNotes 保持上次值 */ } finally {
      set({ writingNotesLoading: false })
    }
  },
```

- [ ] **Step 4: 验证 TypeScript 无报错**

```bash
cd /home/pdm/DEV/ieltsmate/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected output: 无 error 输出。

---

## Task 7: 更新 App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 在 AppInner 的 useEffect 中加入 loadWritingNotes**

找到 `AppInner` 函数体，将：

```typescript
  const { syncFavorites, loadNotes } = store
```

替换为：

```typescript
  const { syncFavorites, loadNotes, loadWritingNotes } = store
```

将：

```typescript
  useEffect(() => {
    void loadSettings?.()
    void loadProviders?.()
    void loadNotes()
    void syncFavorites()
  }, [loadSettings, loadProviders, loadNotes, syncFavorites])
```

替换为：

```typescript
  useEffect(() => {
    void loadSettings?.()
    void loadProviders?.()
    void loadNotes()
    void syncFavorites()
    void loadWritingNotes()
  }, [loadSettings, loadProviders, loadNotes, syncFavorites, loadWritingNotes])
```

- [ ] **Step 2: 验证 TypeScript 无报错**

```bash
cd /home/pdm/DEV/ieltsmate/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected output: 无 error 输出。

---

## Task 8: 更新 KnowledgeBase.tsx

**Files:**
- Modify: `frontend/src/pages/KnowledgeBase.tsx`

- [ ] **Step 1: 删除硬编码 WRITING_NOTES 常量**

找到并删除以下整段（第 23–28 行）：

```typescript
// Mock writing notes
const WRITING_NOTES: { id: string; name: string; path: string; updatedAt: string; writingType: WritingType }[] = [
  { id: 'w1', name: '雅思写作Task 2模板.md', path: '/notes/writing/task2-template.md', updatedAt: '2天前', writingType: '大作文' },
  { id: 'w2', name: '大作文高分句型整理.md', path: '/notes/writing/high-score-phrases.md', updatedAt: '5天前', writingType: '大作文' },
  { id: 'w3', name: '小作文图表描述模板.md', path: '/notes/writing/task1-template.md', updatedAt: '1周前', writingType: '小作文' },
]
```

- [ ] **Step 2: 更新 KnowledgeBaseMain 组件的 props 类型与内部逻辑**

找到 `KnowledgeBaseMain` 函数体（约第 53 行起），在组件内从 `useAppStore` 中解构出 `writingNotes` 和 `writingNotesLoading`：

找到：
```typescript
  const { notes, openQuickNote, favorites, lastAddedNoteId, clearLastAddedNoteId } = useAppStore()
```

替换为：
```typescript
  const { notes, openQuickNote, favorites, lastAddedNoteId, clearLastAddedNoteId, writingNotes, writingNotesLoading } = useAppStore()
```

- [ ] **Step 3: 将 filteredWritingNotes 改为对 writingNotes 过滤**

找到：
```typescript
  const filteredWritingNotes = WRITING_NOTES.filter((w) => {
    if (writingSubFilter !== '全部' && w.writingType !== writingSubFilter) return false
    const matchSearch = !search || w.name.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })
```

替换为：
```typescript
  const filteredWritingNotes = writingNotes.filter((w) => {
    if (writingSubFilter !== '全部' && w.writingType !== writingSubFilter) return false
    const matchSearch = !search || w.name.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })
```

- [ ] **Step 4: 修正 Tab 计数（将所有 WRITING_NOTES.length 替换为 writingNotes.length）**

找到：
```typescript
{ g: '全部' as const, icon: LayoutGrid, count: notes.length + WRITING_NOTES.length,
```
替换为：
```typescript
{ g: '全部' as const, icon: LayoutGrid, count: notes.length + writingNotes.length,
```

找到：
```typescript
{ g: '写作' as const, icon: FileText, count: WRITING_NOTES.length,
```
替换为：
```typescript
{ g: '写作' as const, icon: FileText, count: writingNotes.length,
```

- [ ] **Step 5: 修正写作子分类 pills 中的计数**

找到：
```typescript
              const count = cat === '全部'
                ? WRITING_NOTES.length
                : WRITING_NOTES.filter((w) => w.writingType === cat).length
```
替换为：
```typescript
              const count = cat === '全部'
                ? writingNotes.length
                : writingNotes.filter((w) => w.writingType === cat).length
```

- [ ] **Step 6: 修正卡片点击导航（去除 mock ID 的 w 前缀处理）**

找到：
```typescript
onClick={() => saveScrollAndNavigate(`/kb/w/${w.id.replace(/^w/, '')}`)}
```
替换为：
```typescript
onClick={() => saveScrollAndNavigate(`/kb/w/${w.id}`)}
```

- [ ] **Step 7: 在写作文件区域加入加载中状态**

在写作文件 grid（`<div className="grid grid-cols-3 gap-4">`）之前，在 `<div className="flex flex-col gap-3">` 之后插入加载状态：

找到：
```typescript
        {showWriting && (
          <div className="flex flex-col gap-3">
            {groupFilter !== '杂笔记' && (
              <h3 className="text-sm font-semibold text-text-muted">写作文件</h3>
            )}
            <div className="grid grid-cols-3 gap-4">
```

替换为：
```typescript
        {showWriting && (
          <div className="flex flex-col gap-3">
            {groupFilter !== '杂笔记' && (
              <h3 className="text-sm font-semibold text-text-muted">写作文件</h3>
            )}
            {writingNotesLoading && (
              <div className="text-sm text-text-dim py-4">加载中…</div>
            )}
            <div className="grid grid-cols-3 gap-4">
```

- [ ] **Step 8: 验证 TypeScript 无报错**

```bash
cd /home/pdm/DEV/ieltsmate/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected output: 无 error 输出。

---

## Task 9: 更新 WritingNoteDetail.tsx

**Files:**
- Modify: `frontend/src/pages/WritingNoteDetail.tsx`

- [ ] **Step 1: 用以下完整内容替换 WritingNoteDetail.tsx**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Calendar, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Layout } from '../components/layout/Layout'
import { apiUrl } from '../lib/apiBase'

interface WritingNoteDetail {
  id: string
  name: string
  path: string
  writingType: '大作文' | '小作文'
  updatedAt: string
  content: string
}

function formatDate(isoStr: string): string {
  const now = new Date()
  const d = new Date(isoStr)
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays}天前`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 5) return `${diffWeeks}周前`
  return `${Math.floor(diffDays / 30)}个月前`
}

export default function WritingNoteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [note, setNote] = useState<WritingNoteDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchDetail = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    try {
      const res = await fetch(apiUrl(`/writing-notes/${encodeURIComponent(id)}`))
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      if (!res.ok) return
      const json = (await res.json()) as { data?: WritingNoteDetail }
      if (json.data) setNote(json.data)
    } catch {
      // 静默，保持上次值
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchDetail()
  }, [fetchDetail, refreshKey])

  if (notFound) {
    return (
      <Layout title="写作笔记">
        <div className="p-8 flex flex-col items-center gap-4 text-text-dim">
          <FileText size={40} className="opacity-30" />
          <p>写作笔记未找到</p>
          <button onClick={() => navigate('/kb')} className="text-primary text-sm hover:underline">
            返回知识库
          </button>
        </div>
      </Layout>
    )
  }

  if (loading) {
    return (
      <Layout title="写作笔记">
        <div className="p-8 flex flex-col gap-6">
          <div className="h-20 bg-surface-card border border-border rounded-xl animate-pulse" />
          <div className="h-96 bg-surface-card border border-border rounded-xl animate-pulse" />
        </div>
      </Layout>
    )
  }

  if (!note) return null

  return (
    <Layout title="写作笔记">
      <div className="px-8 py-8">
        {/* Back */}
        <button
          onClick={() => navigate('/kb')}
          className="flex items-center gap-1.5 text-text-dim hover:text-text-muted text-sm transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          返回知识库
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-card border border-border rounded-xl p-5 mb-6 flex items-start gap-4"
        >
          <div className="w-10 h-10 rounded-lg bg-[#1e293b] border border-[#334155] flex items-center justify-center shrink-0">
            <FileText size={18} className="text-[#94a3b8]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-text-primary truncate">{note.name}</h1>
            <p className="text-xs text-text-subtle mt-1 truncate">{note.path}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-subtle shrink-0">
            <Calendar size={12} />
            {formatDate(note.updatedAt)}
          </div>
        </motion.div>

        {/* Markdown content */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface-card border border-border rounded-xl p-8"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-2xl font-bold text-text-primary mb-4 pb-3 border-b border-border">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-lg font-semibold text-text-primary mt-8 mb-3">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-base font-semibold text-text-secondary mt-5 mb-2">{children}</h3>
              ),
              p: ({ children }) => (
                <p className="text-[15px] text-text-secondary leading-relaxed mb-3">{children}</p>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-primary/40 pl-4 py-1 my-3 bg-[#1e1e2e] rounded-r-md">
                  <div className="text-[14px] text-text-muted italic">{children}</div>
                </blockquote>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-')
                if (isBlock) {
                  return (
                    <div className="my-4 bg-[#0d0d10] border border-border rounded-lg overflow-hidden">
                      <div className="px-4 py-2 border-b border-border bg-[#141418] flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#28ca41]" />
                      </div>
                      <pre className="p-4 overflow-x-auto text-[13px] text-[#e2e8f0] font-mono leading-relaxed">
                        <code>{children}</code>
                      </pre>
                    </div>
                  )
                }
                return (
                  <code className="px-1.5 py-0.5 text-[13px] font-mono bg-[#1a1a28] text-primary rounded">
                    {children}
                  </code>
                )
              },
              img: ({ src, alt }) => (
                <img
                  src={src}
                  alt={alt ?? ''}
                  className="max-w-full rounded-lg border border-border my-4"
                />
              ),
              table: ({ children }) => (
                <div className="my-4 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">{children}</table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-[#1a1a28]">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wide border-b border-border">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-2.5 text-[14px] text-text-secondary border-b border-border/50">{children}</td>
              ),
              tr: ({ children }) => (
                <tr className="hover:bg-[#1e1e2e] transition-colors">{children}</tr>
              ),
              ul: ({ children }) => (
                <ul className="my-3 space-y-1.5 list-none pl-0">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="my-3 space-y-1.5 list-decimal list-inside">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="flex items-start gap-2 text-[15px] text-text-secondary">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span>{children}</span>
                </li>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-text-primary">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="italic text-text-muted">{children}</em>
              ),
              hr: () => (
                <hr className="my-6 border-border" />
              ),
              a: ({ href, children }) => (
                <a href={href} className="text-primary underline decoration-primary/40 hover:decoration-primary" target="_blank" rel="noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {note.content}
          </ReactMarkdown>
        </motion.div>

        {/* Footer nav */}
        <div className="flex items-center justify-between mt-6 text-sm text-text-dim">
          <button onClick={() => navigate('/kb')} className="flex items-center gap-1.5 hover:text-text-muted transition-colors">
            <ArrowLeft size={13} />
            返回知识库
          </button>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-1.5 hover:text-text-muted transition-colors"
          >
            <RefreshCw size={13} />
            重新加载
          </button>
        </div>
      </div>
    </Layout>
  )
}
```

- [ ] **Step 2: 验证 TypeScript 无报错**

```bash
cd /home/pdm/DEV/ieltsmate/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected output: 无 error 输出。

---

## Task 10: 端到端验证

- [ ] **Step 1: 重启后端（若尚未运行）**

```bash
bash /home/pdm/DEV/ieltsmate/start.sh
```

- [ ] **Step 2: 打开浏览器访问前端，验证知识库写作 Tab**

访问 `http://127.0.0.1:5173/kb?group=写作`

预期：
- 显示 2 个写作文件卡片（大作文 / 小作文）
- 不显示 mock 的「雅思写作Task 2模板.md」等 3 条假数据

- [ ] **Step 3: 点击写作卡片，验证详情页**

点击「大作文」卡片，预期：
- 页面标题显示 `大作文.md`
- 正文渲染真实 markdown 内容（包含 # 大作文、## 1 题型分类 等标题）
- 图片位置渲染 `<img>` 标签（即使图片本身加载失败也应有标签）

- [ ] **Step 4: 验证图片加载**

在详情页打开浏览器 DevTools → Network，过滤 `writing-assets`，刷新页面。

预期：图片请求返回 `200`，图片在页面中正常显示。

- [ ] **Step 5: 验证「重新加载」按钮**

点击详情页底部「重新加载」按钮，预期：页面短暂显示 skeleton 加载状态后重新渲染内容，无报错。

---

## 完成标准

- [ ] `GET /writing-notes` 返回 2 条真实文件元数据
- [ ] `GET /writing-notes/:id` 返回正确的 markdown 内容，`./assets/` 已替换为 `/writing-assets/...`
- [ ] `/writing-assets/写作笔记/大作文/assets/xxx.png` 返回 200
- [ ] 知识库写作 Tab 显示真实文件列表（不再显示 3 条 mock）
- [ ] 写作详情页显示真实 markdown 内容，图片正常渲染
- [ ] 「重新加载」按钮触发重新 fetch
- [ ] TypeScript 无编译错误

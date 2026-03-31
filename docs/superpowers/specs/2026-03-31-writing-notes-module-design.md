# 写作文件模块 设计文档

> 日期：2026-03-31  
> 状态：待实施

---

## 1. 概述

为 IELTSmate 写作文件模块实现后端接口与前端联调，将 `KnowledgeBase`（写作 Tab）和 `WritingNoteDetail` 页面中的硬编码 mock 数据替换为真实磁盘文件数据。

### 1.1 设计决策汇总

| 决策项 | 结论 |
|--------|------|
| 数据存储方式 | 纯磁盘实时读取，不引入 `WritingNote` DB 表，不修改 Prisma schema |
| 文件来源 | 服务器固定目录 `笔记/写作笔记/`，按子目录名映射 `writingType` |
| 图片处理 | NestJS `ServeStaticModule` 挂载 `笔记/` 目录到 `/writing-assets`，服务端替换 `.md` 中的 `./assets/xxx` 为绝对路径 |
| 「重新导入」按钮 | 改为「刷新」语义：触发重新 fetch 当前详情，无需后端特殊接口 |
| ID 规则 | 使用子目录名（`大作文` / `小作文`）作为稳定 ID |
| 导入入口 | 删除「重新导入」的错误文案和 onClick，改为一个重新加载按钮 |

---

## 2. 后端设计

### 2.1 目录结构新增

```
backend/src/writing/
  writing.module.ts
  writing.controller.ts
  writing.service.ts
```

### 2.2 磁盘扫描规则

统一用 `getNotesRoot()` 函数在 `writing.service.ts` 中取根路径，避免多处各自计算层级出错：

```typescript
function getNotesRoot(): string {
  // 优先用环境变量（生产/dist 部署时应设置此变量）
  if (process.env.NOTES_ROOT) return process.env.NOTES_ROOT
  // dev 模式 ts-node：__dirname = backend/src/writing/，往上 3 层到仓库根，再进 笔记/
  return join(__dirname, '../../../笔记')
}
```

**注意：** `app.module.ts` 位于 `backend/src/`，若在该文件里计算路径应用 `join(__dirname, '../../笔记')`（少一层），因此统一由 `writing.service.ts` 导出 `getNotesRoot()` 并在 `app.module.ts` 直接调用，避免各文件手写不同层级。

扫描路径：`<NOTES_ROOT>/写作笔记/`

规则：
1. 枚举 `写作笔记/` 下的一级子目录（`大作文` / `小作文`）
2. 每个子目录下按文件名排序，取第一个 `.md` 文件
3. 以子目录名作为 `id`，子目录名即 `writingType`
4. `updatedAt` 取文件 `mtime`

### 2.3 接口定义

#### `GET /writing-notes`

扫描目录，返回列表（不含 content）。

**响应：**
```json
{
  "data": [
    {
      "id": "大作文",
      "name": "大作文.md",
      "writingType": "大作文",
      "updatedAt": "2026-03-30T10:00:00.000Z"
    },
    {
      "id": "小作文",
      "name": "小作文.md",
      "writingType": "小作文",
      "updatedAt": "2026-03-29T08:00:00.000Z"
    }
  ],
  "message": "ok"
}
```

#### `GET /writing-notes/:id`

根据 `id`（子目录名）读取对应 `.md` 文件，替换图片路径后返回。

**图片路径替换规则：**
- 原始：`./assets/image-xxx.png`（经验证，当前两个 `.md` 文件的图片引用均为此格式）
- 替换为：`/writing-assets/写作笔记/<id>/assets/image-xxx.png`
- 实现：全局字符串替换 `./assets/` → `/writing-assets/写作笔记/${id}/assets/`
- 注：当前仅覆盖 `./assets/` 前缀；若日后出现 `assets/`（无 `./`）需扩展规则

**响应：**
```json
{
  "data": {
    "id": "大作文",
    "name": "大作文.md",
    "writingType": "大作文",
    "updatedAt": "2026-03-30T10:00:00.000Z",
    "content": "# 大作文\n\n..."
  },
  "message": "ok"
}
```

**安全约束（路径穿越防护）：**

`id` 参数来自 URL，实施时必须在 `WritingService.findOne()` 中做如下校验：

```typescript
const ALLOWED_IDS = ['大作文', '小作文']
if (!ALLOWED_IDS.includes(id)) throw new NotFoundException()
```

（或等价：用 `path.resolve` 拼合后校验结果是否以 `getNotesRoot() + '/写作笔记/'` 开头）

**错误处理：**
- `id` 不在白名单或对应目录不存在 → 抛 `NotFoundException`

### 2.4 静态文件服务

安装 `@nestjs/serve-static`（`pnpm add @nestjs/serve-static serve-static`，在 `backend/` 目录下执行），在 `app.module.ts` 配置：

```typescript
import { getNotesRoot } from './writing/writing.service'

ServeStaticModule.forRoot({
  rootPath: getNotesRoot(),   // 由 writing.service 统一计算，不在此重复计算层级
  serveRoot: '/writing-assets',
  serveStaticOptions: { index: false },
})
```

`/writing-assets/写作笔记/大作文/assets/xxx.png` 会直接返回磁盘上对应图片文件。

### 2.5 `app.module.ts` 更新

在 `imports` 数组中追加 `ServeStaticModule`（配置见上）和 `WritingModule`。

---

## 3. 前端设计

### 3.1 Vite 代理新增（`vite.config.ts`）

新增两条代理规则：

```typescript
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
```

### 3.2 Zustand Store（`useAppStore.ts`）

新增 `writingNotes` 状态与 `loadWritingNotes()` action，与现有 `notes` / `loadNotes()` 模式对齐。

**新增类型：**
```typescript
interface WritingNoteItem {
  id: string
  name: string
  writingType: '大作文' | '小作文'
  updatedAt: string
}
```

**新增状态：**
```typescript
writingNotes: WritingNoteItem[]
writingNotesLoading: boolean
```

**新增 action：**
```typescript
loadWritingNotes: () => Promise<void>
// GET /writing-notes → 更新 writingNotes
```

`loadWritingNotes()` 在 `App.tsx` 的 `AppInner` 中随应用启动时调用（与 `loadNotes()` 并列），并加入 `useEffect` 依赖数组，与 `loadNotes` 等保持一致。

### 3.3 `KnowledgeBase.tsx`

- 删除硬编码的 `WRITING_NOTES` 常量（24–28 行）
- 从 `useAppStore` 取 `writingNotes` 和 `writingNotesLoading`
- `filteredWritingNotes` 改为对 `writingNotes` 进行过滤（逻辑不变）
- 各处 `WRITING_NOTES.length` 改为 `writingNotes.length`
- 写作 Tab 下加载中状态：`writingNotesLoading` 为 true 时展示 `<LoadingState />`

### 3.4 `WritingNoteDetail.tsx`

- 删除整个 `WRITING_NOTES_CONTENT` 对象（8–195 行）
- 新增本地 state：`detail`、`loading`、`error`
- `useEffect` 在组件挂载和 `id` 变化时 fetch `GET /writing-notes/${encodeURIComponent(id)}`（对中文 id 做 URL 编码，避免代理或边缘环境对非 ASCII 路径处理不一致）
- 「重新导入」按钮（`RefreshCw` 图标）改为「重新加载」，`onClick` 触发重新 fetch（把 `id` 设为同值触发 effect，或用一个 `refreshKey` state）
- 加载中时显示 `<Skeleton />` 占位
- 找不到时展示原有的 404 UI（fetch 返回 404 即触发）
- 路由 id 使用 `useParams()` 的 `id` 直接传给接口（URL 路由是 `/kb/w/:id`，现有 mock 用的是 `w${id}`，联调后直接用 `id`）
- `note.updatedAt` 使用 `formatNoteDate` 函数格式化（从 ISO 字符串转为「X天前」）

### 3.5 `App.tsx`

在 `AppInner` 的 `useEffect` 中加入 `loadWritingNotes()` 的调用：

```typescript
const { loadWritingNotes } = useAppStore()
// 在 useEffect 中：
void loadWritingNotes()
```

---

## 4. 数据流

```
App 启动
  → loadWritingNotes()
    → GET /writing-notes
      → WritingService.list() 扫描磁盘
      → 返回 [{ id, name, writingType, updatedAt }]
  → writingNotes 更新到 store

KnowledgeBase 写作 Tab
  → 读取 store.writingNotes 渲染列表
  → 点击卡片 → navigate('/kb/w/大作文')

WritingNoteDetail
  → useEffect: GET /writing-notes/%E5%A4%A7%E4%BD%9C%E6%96%87（id 经 encodeURIComponent 编码）
    → WritingService.findOne('大作文') 读取磁盘文件并替换图片路径
    → 返回 { id, name, writingType, content, updatedAt }
  → ReactMarkdown 渲染 content
  → 图片 src: /writing-assets/写作笔记/大作文/assets/xxx.png
    → Vite proxy → NestJS ServeStaticModule → 磁盘文件
  → 「重新加载」按钮 → 触发重新 fetch
```

---

## 5. 错误处理

| 场景 | 处理方式 |
|------|---------|
| 扫描目录失败（目录不存在）| `WritingService.list()` 返回空数组，前端显示空状态 |
| 读取文件失败（文件不存在）| 抛 `NotFoundException`，前端显示「未找到」页 |
| 图片加载失败 | 浏览器原生 broken image，不需要特殊处理 |
| fetch 网络错误 | 前端 catch 后设 `error` state，显示错误提示 |

---

## 6. 不在本次范围内

- 写作文件编辑功能
- 写作文件收藏
- 写作文件用户备注
- PDF 文件的展示（`大作文第一节.pdf` 等）
- 任何 Prisma / DB 变更

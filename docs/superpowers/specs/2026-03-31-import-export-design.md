# 大功能 9：导入 / 导出 设计文档

**日期：** 2026-03-31  
**项目：** IELTSmate（NestJS + Prisma + PostgreSQL / React + Zustand + Vite）

---

## 背景

Settings 页的导出 JSON/CSV 按钮、导入按钮均无逻辑；ImportModal 的 `handleImport` 只模拟 1.8s 延迟，不真正解析文件；清空数据按钮保留前端但不实现后端接口。

**范围变更（相比 project.md 原计划）：**
- 写作笔记不做导入/导出（写作文件直接读磁盘，无需导入）
- 清空数据后端不实现，前端按钮保留现状

---

## 共享类型

### ParsedNote（前后端共用）

```typescript
interface ParsedNote {
  content: string
  translation: string
  category: string
  phonetic?: string
  synonyms?: string[]
  antonyms?: string[]
  example?: string
  memoryTip?: string
}
```

`needsAI` 是 ImportService 内部标记位，不出现在接口返回中。

---

## 一、导出

### 接口

```
GET /export/notes?format=json|csv
```

### 关键技术注意

项目注册了全局 `ResponseInterceptor`（将所有响应包装为 `{ data, message }`）。导出端点必须**绕过**该拦截器，否则浏览器收到的是 JSON 包装而非文件流。

解决方案：在 `ExportController` 方法中注入 `@Res() res: Response`（`passthrough: false`，默认行为），直接调用 `res.setHeader(...)` + `res.send(buffer)`。使用 `@Res()` 时 NestJS 生命周期（含拦截器）完全被绕过，由开发者直接控制 Express Response。

**注意：** `StreamableFile` **不适用**——当前 ResponseInterceptor 会在 `StreamableFile` 实例到达底层前将其包装成 `{ data: instance, message: 'ok' }`，导致 `instanceof StreamableFile` 检测失败，最终 JSON 序列化输出乱码。

### 行为

- 查询所有 `deletedAt IS NULL` 的 Note 记录，按 `createdAt ASC` 排序
- 导出字段（全部字段）：
  `id, content, translation, category, phonetic, synonyms, antonyms, example, memoryTip, reviewStatus, reviewCount, correctCount, wrongCount, lastReviewedAt, createdAt, updatedAt`
- **JSON 格式**：直接返回 `Note[]` 数组，`Content-Type: application/json`
- **CSV 格式**：
  - 首行 header
  - `synonyms` / `antonyms` 字段用 `|` 分隔多值
  - 含逗号或换行的字段按 RFC 4180 用双引号包裹
  - `Content-Type: text/csv; charset=utf-8`
- 响应头：`Content-Disposition: attachment; filename="ieltsmate-notes-YYYYMMDD.{json|csv}"`
  - 日期格式：`new Date().toISOString().slice(0, 10).replace(/-/g, '')`

### 模块结构

```
backend/src/export/
  export.module.ts
  export.controller.ts   # GET /export/notes（使用 @Res() 直接写响应流）
  export.service.ts
```

---

## 二、导入

### 接口

两个端点，无服务端状态：

```
POST /import/notes/preview   # 解析文件，返回预览+AI标记，不写库
POST /import/notes/save      # 接收前端确认后的列表，批量写库
```

### 文件上传配置

- 在 `ImportController` 方法上使用 `@UseInterceptors(FileInterceptor('file'))` + `@UploadedFile()` 接收文件
- 在 `ImportModule` 中配置 `MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } })`（5MB 上限）
- 项目 `main.ts` 中 `bodyParser: false` 对 multer multipart 处理无影响，multer 独立处理 multipart
- 后端校验文件扩展名为 `.md`，非法格式返回 400

---

### `POST /import/notes/preview`

**请求：** `multipart/form-data`
- `file`: `.md` 文件
- `modelId`（可选）: 指定使用哪个 AI 模型的 `AiModel.modelId`

**处理流程（三阶段）：**

#### Stage 1 — 规则解析

按 `### 分类名` 标题拆分 category（如 `口语`、`短语`、`句子句式`、`同义替换`、`拼写/生词`）。

对每行按以下优先级匹配：

| 模式 | 示例 | 解析结果 |
|------|------|----------|
| 加粗词条 `**word**（中文）` | `**end up** 结果 最终成为` | content=`end up`, translation=`结果 最终成为` |
| 加粗词条 `**word** 中文` | `**dedicated to** 致力于` | content=`dedicated to`, translation=`致力于` |
| 同义替换 `A = B 中文` | `convincing = persuasive 令人信服的` | content=`convincing`, translation=`令人信服的`, synonyms=[`persuasive`] |
| 纯文本 `英文 中文` | `get out of 避免` | content=`get out of`, translation=`避免` |
| 拼写列表（一行多个英文词，无中文）| `January February theater...` | 每词独立一条，translation 待 AI 补充 |
| 无法识别 | 引用块、多行例句等 | 标记为 `needsAI=true`，跳过不单独入结果 |

跳过空行、纯图片行（`<img ...>`）、markdown 标题行（`#`/`##`/`###`）。

#### Stage 2 — AI 补充

将 `needsAI=true` 或 `translation` 为空的条目批量发给 AI：
- 拼写词条：AI 提供中文释义（含发音提示）
- 无法识别条目：AI 尝试提取 content/translation/category

**AI 调用方式：** 在 `AiService` 中新增 `complete(dto: { messages: ChatMessage[], model?: string, slot?: string })` 方法，逻辑与 `chat()` 相同但**不携带 `tools` 字段**（无 function calling）。这样避免 Stage 2/3 中模型错误触发 `search_notes` 等工具。

`resolveProviderAndModel` 的优先级逻辑完整复用：`model` 直查 → `slot` 路由 → 首个 provider。

ImportService 调用 `complete({ messages, model: modelId })`：若 `modelId` 未提供则改传 `slot: 'classify'` 使用默认 classifyModel。

AI Prompt 返回约定：JSON 数组 `[{ globalIndex: number, content: string, translation: string, category: string, synonyms?: string[] }]`，其中 `globalIndex` 是该条目在整体 notes 数组中的全局下标，Service 按下标直接合并回结果。

若无需 AI 补充，跳过此阶段。

#### Stage 3 — AI Review

将完整解析结果发给 AI 做整体核查。

**Token 规模控制：** 若 `notes.length > 60`，Stage 3 跳过（直接返回 `flagged=[]`）。超大文件的全量 review 容易超 token 限制，用户可分批导入。

AI 检查：
- content/translation 分割是否合理
- category 是否与内容匹配

AI 返回 `flagged[]`：`{ noteIndex: number, issue: string, suggestion: Partial<ParsedNote> }`

若 AI 调用失败（超时、无模型），Stage 3 降级：返回 `flagged=[]`，不影响主流程。

**返回体：**

```json
{
  "notes": [ /* ParsedNote[] */ ],
  "flagged": [
    {
      "noteIndex": 12,
      "issue": "content/translation 分割疑似有误",
      "suggestion": { "content": "get back on track", "translation": "回到正轨" }
    }
  ],
  "stats": {
    "total": 120,
    "rulesParsed": 95,
    "aiAssisted": 25,
    "flaggedCount": 3
  }
}
```

---

### `POST /import/notes/save`

**请求体：**

```json
{
  "notes": [ /* ParsedNote[]，前端确认后的最终列表 */ ]
}
```

**行为：**
- `prisma.note.createMany({ data: notes, skipDuplicates: true })`
- Note.content 无唯一约束，`skipDuplicates` 仅处理 id 冲突（导入时不传 id，Prisma 自动生成，实际不会触发冲突）；相同 content 的条目会正常插入（允许同词不同释义）
- 返回：`{ created: number, failed: number, errors: string[] }`

### 模块结构

```
backend/src/import/
  import.module.ts        # 导入 AiModule、MulterModule
  import.controller.ts    # POST /import/notes/preview, POST /import/notes/save
  import.service.ts       # Stage 1~3 编排
  import.parser.ts        # Stage 1 纯规则解析（独立，可单测）
```

---

## 三、前端改造

### Settings.tsx — 导出按钮

两个导出按钮（JSON / CSV）添加 `onClick`：

```typescript
const handleExport = async (format: 'json' | 'csv') => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const res = await fetch(`/export/notes?format=${format}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ieltsmate-notes-${today}.${format}`
  a.click()
  URL.revokeObjectURL(url)
}
```

Settings 页"选择文件"导入按钮添加 `onClick={() => openImport()}`（调用 `useAppStore().openImport()`，打开 ImportModal）。

### ImportModal.tsx — 三步流程

**Step 1 — 选文件 + 模型**
- 移除"写作"类型选项，替换为 AI 模型下拉选择器
  - 从 `useAppStore().providers` 展平所有 AiModel，显示 `providerName / modelId`
  - 若无模型配置，显示提示"请先在设置中配置 AI 模型"
- 文件选择限 `.md`（`accept=".md"`）
- 点"开始解析" → POST `/import/notes/preview`，显示"AI 解析中..."加载态

**Step 2 — Review**（仅当 `flagged.length > 0`）
- 列表展示每条被标记的条目
- 每条显示：原始内容 | AI 问题描述 | AI 建议（对比高亮）
- 用户操作：**接受建议** / **保留原始**
- "确认" → 进入 Step 3

**Step 3 — 保存**
- POST `/import/notes/save`（使用 Step 2 确认后的 notes）
- 显示结果：「已导入 X 条」/ 若有失败显示「失败 Y 条」
- 按钮变为"关闭"

### 状态机

```
idle → parsing（POST /preview）→ reviewing（flagged > 0，用户确认）→ saving → done
                               ↘ saving（flagged = 0，直接保存）
```

### Vite proxy 新增

```typescript
'/export': {
  target: 'http://127.0.0.1:3000',
  changeOrigin: true,
  bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
},
'/import': {
  target: 'http://127.0.0.1:3000',
  changeOrigin: true,
  bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
},
```

---

## 四、错误处理

| 场景 | 处理 |
|------|------|
| 上传非 `.md` 文件 | 前端 accept=".md" 限制；后端校验扩展名，非法返回 400 |
| 文件超过 5MB | MulterModule limits 配置，超出抛 400 |
| AI Stage 2 调用失败 | 降级：无翻译的条目保留空 translation，继续后续流程 |
| AI Stage 3 调用失败 / notes > 60 条 | 降级：跳过 Review，`flagged=[]`，直接进入保存流程 |
| modelId 未提供 | 使用 settings 中 classifyModel 对应模型；若仍无，Stage 2/3 整体跳过 |
| save 时写入失败 | 记录失败 index，返回 errors[]，已成功的不回滚 |
| ResponseInterceptor 包装 | ExportController 使用 `@Res()` 直接写流（StreamableFile 不可用） |
| AiService.chat() 含 Function Calling | Import 调用新增的 `AiService.complete()` 方法（无 tools 字段） |

---

## 五、不在范围内

- 写作笔记的导入 / 导出
- 清空数据后端接口（前端按钮保留，后端不实现）
- CSV 格式导入（只做导出；导入仅支持 Markdown）
- 导入内容去重（同 content 允许多次导入）

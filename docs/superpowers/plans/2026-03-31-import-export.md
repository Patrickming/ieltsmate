# 大功能 9：导入 / 导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现杂笔记的 JSON/CSV 导出、Markdown 导入（三阶段规则+AI解析+AI Review）以及 Settings/ImportModal 前端联通。

**Architecture:** 后端新增 ExportModule（直接写 Express Response 流绕过 ResponseInterceptor）和 ImportModule（FileInterceptor + 三阶段解析），AiService 新增无 Function Calling 的 `complete()` 方法。前端 ImportModal 改为三步状态机，Settings 导出/导入按钮接入真实接口。

**Tech Stack:** NestJS 10, Prisma, @nestjs/platform-express, multer, React, Zustand, Vite proxy

---

## 文件变更总览

**新建（后端）**
- `backend/src/export/export.module.ts`
- `backend/src/export/export.controller.ts`
- `backend/src/export/export.service.ts`
- `backend/src/import/import.module.ts`
- `backend/src/import/import.controller.ts`
- `backend/src/import/import.service.ts`
- `backend/src/import/import.parser.ts`
- `backend/src/import/dto/save-notes.dto.ts`

**修改（后端）**
- `backend/src/ai/ai.service.ts` — 新增 `complete()` 方法，`resolveProviderAndModel` 改为 `private`（已是，保持不变，但 complete() 内部复用同一逻辑）
- `backend/src/app.module.ts` — 注册 ExportModule 和 ImportModule

**修改（前端）**
- `frontend/vite.config.ts` — 新增 `/export` 和 `/import` proxy
- `frontend/src/pages/Settings.tsx` — 导出按钮 + 导入按钮 onClick
- `frontend/src/components/modals/ImportModal.tsx` — 完全重写为三步流程

---

## Task 1: AiService.complete() — 无 Function Calling 的 AI 调用方法

**Files:**
- Modify: `backend/src/ai/ai.service.ts`

- [ ] **Step 1: 在 AiService 末尾（chat() 方法之后）新增 complete() 方法**

  `complete()` 复用 `resolveProviderAndModel` 的逻辑（该方法已是 private，可在同 class 内调用），发起单次 HTTP 调用，不携带 `tools` 字段。

  在 `backend/src/ai/ai.service.ts` 末尾 `// ── Helpers ──` 区块之前插入：

  ```typescript
  // ── Simple completion (no function calling) ──────────────────────────────

  async complete(dto: { messages: Array<{ role: string; content: string }>; model?: string; slot?: string }): Promise<string> {
    const { provider, model } = await this.resolveProviderAndModel({
      messages: dto.messages,
      model: dto.model,
      slot: (dto.slot as ChatDto['slot']) ?? 'classify',
    } as ChatDto)

    if (!provider.apiKey) {
      throw new BadRequestException(
        `Provider "${provider.displayName}" has no API key configured`,
      )
    }

    const baseUrl = provider.baseUrl.replace(/\/$/, '')
    const url = `${baseUrl}/chat/completions`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: dto.messages,
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new BadRequestException(`AI API error ${res.status}: ${text}`)
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    return json.choices?.[0]?.message?.content ?? ''
  }
  ```

- [ ] **Step 2: 确认 TypeScript 编译无错误**

  ```bash
  cd /home/pdm/DEV/ieltsmate/backend && npx tsc --noEmit 2>&1 | grep "error TS"
  ```

  期望：无输出（无 TS 错误）

---

## Task 2: ExportModule — 导出 JSON/CSV

**Files:**
- Create: `backend/src/export/export.service.ts`
- Create: `backend/src/export/export.controller.ts`
- Create: `backend/src/export/export.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: 创建 export.service.ts**

  ```typescript
  // backend/src/export/export.service.ts
  import { Injectable } from '@nestjs/common'
  import { PrismaService } from '../prisma/prisma.service'

  @Injectable()
  export class ExportService {
    constructor(private readonly prisma: PrismaService) {}

    async getNotesJson(): Promise<Buffer> {
      const notes = await this.prisma.note.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          content: true,
          translation: true,
          category: true,
          phonetic: true,
          synonyms: true,
          antonyms: true,
          example: true,
          memoryTip: true,
          reviewStatus: true,
          reviewCount: true,
          correctCount: true,
          wrongCount: true,
          lastReviewedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      return Buffer.from(JSON.stringify(notes, null, 2), 'utf-8')
    }

    async getNotesCsv(): Promise<Buffer> {
      const notes = await this.prisma.note.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          content: true,
          translation: true,
          category: true,
          phonetic: true,
          synonyms: true,
          antonyms: true,
          example: true,
          memoryTip: true,
          reviewStatus: true,
          reviewCount: true,
          correctCount: true,
          wrongCount: true,
          lastReviewedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      const headers = [
        'id', 'content', 'translation', 'category', 'phonetic',
        'synonyms', 'antonyms', 'example', 'memoryTip',
        'reviewStatus', 'reviewCount', 'correctCount', 'wrongCount',
        'lastReviewedAt', 'createdAt', 'updatedAt',
      ]

      const escapeCell = (val: unknown): string => {
        const str = val === null || val === undefined ? '' : String(val)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }

      const rows = notes.map((n) => [
        n.id,
        n.content,
        n.translation,
        n.category,
        n.phonetic ?? '',
        n.synonyms.join('|'),
        n.antonyms.join('|'),
        n.example ?? '',
        n.memoryTip ?? '',
        n.reviewStatus,
        n.reviewCount,
        n.correctCount,
        n.wrongCount,
        n.lastReviewedAt?.toISOString() ?? '',
        n.createdAt.toISOString(),
        n.updatedAt.toISOString(),
      ].map(escapeCell).join(','))

      const csv = [headers.join(','), ...rows].join('\n')
      return Buffer.from('\uFEFF' + csv, 'utf-8') // BOM for Excel
    }
  }
  ```

- [ ] **Step 2: 创建 export.controller.ts**

  注意：使用 `@Res()` 直接写 Express Response，绕过全局 ResponseInterceptor。

  ```typescript
  // backend/src/export/export.controller.ts
  import { Controller, Get, Query, Res } from '@nestjs/common'
  import { Response } from 'express'
  import { ExportService } from './export.service'

  @Controller('export')
  export class ExportController {
    constructor(private readonly exportService: ExportService) {}

    @Get('notes')
    async exportNotes(
      @Query('format') format: 'json' | 'csv' = 'json',
      @Res() res: Response,
    ) {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const filename = `ieltsmate-notes-${today}.${format}`

      if (format === 'csv') {
        const buffer = await this.exportService.getNotesCsv()
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        res.send(buffer)
      } else {
        const buffer = await this.exportService.getNotesJson()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        res.send(buffer)
      }
    }
  }
  ```

- [ ] **Step 3: 创建 export.module.ts**

  ```typescript
  // backend/src/export/export.module.ts
  import { Module } from '@nestjs/common'
  import { PrismaModule } from '../prisma/prisma.module'
  import { ExportController } from './export.controller'
  import { ExportService } from './export.service'

  @Module({
    imports: [PrismaModule],
    controllers: [ExportController],
    providers: [ExportService],
  })
  export class ExportModule {}
  ```

- [ ] **Step 4: 在 app.module.ts 注册 ExportModule**

  在 `backend/src/app.module.ts` 顶部 imports 区添加：

  ```typescript
  import { ExportModule } from './export/export.module'
  ```

  在 `@Module({ imports: [...] })` 数组末尾加 `ExportModule`。

- [ ] **Step 5: 编译检查**

  ```bash
  cd /home/pdm/DEV/ieltsmate/backend && npx tsc --noEmit 2>&1 | grep "error TS"
  ```

  期望：无输出

---

## Task 3: ImportParser — Stage 1 规则解析

**Files:**
- Create: `backend/src/import/import.parser.ts`

Stage 1 输出格式（内部类型，不暴露到 API）：

```typescript
interface RawEntry {
  content: string
  translation: string
  category: string
  synonyms: string[]
  needsAI: boolean  // 无法识别时为 true
}
```

- [ ] **Step 1: 创建 import.parser.ts**

  ```typescript
  // backend/src/import/import.parser.ts

  export interface RawEntry {
    content: string
    translation: string
    category: string
    synonyms: string[]
    needsAI: boolean
  }

  /**
   * 解析 ### 分类名 标题，返回当前行的分类名，或 null（非标题行）
   */
  function parseCategory(line: string): string | null {
    const m = line.match(/^###\s+(.+)/)
    return m ? m[1].trim() : null
  }

  /**
   * 判断一行是否全为英文词（拼写列表行）：无汉字，且有至少2个英文词
   * 例："January February theater Saturday"
   */
  function isSpellingListLine(line: string): boolean {
    if (/[\u4e00-\u9fa5（）【】]/.test(line)) return false
    const words = line.trim().split(/\s+/).filter((w) => /^[a-zA-Z\-']+$/.test(w))
    return words.length >= 2
  }

  /**
   * 从一行中解析加粗词条
   * 支持格式：**word** 中文  或  **word**（中文）
   */
  function parseBoldEntry(line: string, category: string): RawEntry | null {
    // **word**（中文）或 **word** 中文
    const m = line.match(/^\*\*(.+?)\*\*[（(]?(.+?)[）)]?\s*$/)
    if (!m) return null
    // 去掉加粗标记后整行剩余部分作为 translation
    const afterBold = line.replace(/^\*\*(.+?)\*\*/, '').replace(/^[（(]/, '').replace(/[）)]$/, '').trim()
    if (!afterBold) return null
    return {
      content: m[1].trim(),
      translation: afterBold,
      category,
      synonyms: [],
      needsAI: false,
    }
  }

  /**
   * 解析同义替换格式：A = B 中文
   * content=A, translation=中文, synonyms=[B]
   */
  function parseSynonymEntry(line: string, category: string): RawEntry | null {
    const m = line.match(/^([a-zA-Z\s\-']+?)\s*=\s*([a-zA-Z\s\-']+?)\s+([\u4e00-\u9fa5].+)$/)
    if (!m) return null
    return {
      content: m[1].trim(),
      translation: m[3].trim(),
      category,
      synonyms: [m[2].trim()],
      needsAI: false,
    }
  }

  /**
   * 解析纯文本 "英文 中文" 格式
   * 要求：以英文开头，包含汉字
   */
  function parsePlainEntry(line: string, category: string): RawEntry | null {
    if (!/[\u4e00-\u9fa5]/.test(line)) return null
    // 去掉加粗符号后处理
    const clean = line.replace(/\*\*/g, '').trim()
    // 找第一个汉字的位置，之前是 content，之后（含）是 translation
    const idx = clean.search(/[\u4e00-\u9fa5（）【】]/)
    if (idx <= 0) return null
    const content = clean.slice(0, idx).trim()
    const translation = clean.slice(idx).trim()
    if (!content || !translation) return null
    return { content, translation, category, synonyms: [], needsAI: false }
  }

  /**
   * 主解析函数：接收 .md 文件内容，返回 RawEntry[]
   */
  export function parseMarkdown(markdown: string): RawEntry[] {
    const lines = markdown.split('\n')
    const entries: RawEntry[] = []
    let currentCategory = '未分类'

    for (const rawLine of lines) {
      const line = rawLine.trim()

      // 跳过空行、图片、纯 markdown 符号、h1/h2 标题
      if (!line) continue
      if (line.startsWith('<img')) continue
      if (/^#{1,2}\s/.test(line)) continue
      if (/^[-*>|`#]/.test(line) && !/^\*\*/.test(line)) {
        // 跳过引用块、分隔线等，但保留加粗开头的行
        if (!line.startsWith('**')) continue
      }

      // ### 分类标题
      const cat = parseCategory(line)
      if (cat) {
        currentCategory = cat
        continue
      }

      // 拼写列表行 → 每词单独一条，translation 待 AI 补充
      if (isSpellingListLine(line)) {
        const words = line.split(/\s+/).filter((w) => /^[a-zA-Z\-']+$/.test(w))
        for (const word of words) {
          entries.push({ content: word, translation: '', category: currentCategory, synonyms: [], needsAI: true })
        }
        continue
      }

      // 加粗词条
      const bold = parseBoldEntry(line, currentCategory)
      if (bold) { entries.push(bold); continue }

      // 同义替换 A = B 中文
      const syn = parseSynonymEntry(line, currentCategory)
      if (syn) { entries.push(syn); continue }

      // 纯文本 英文 中文
      const plain = parsePlainEntry(line, currentCategory)
      if (plain) { entries.push(plain); continue }

      // 无法识别 → needsAI
      if (line.length > 2 && !/^[#\-*>|`]/.test(line)) {
        entries.push({ content: line, translation: '', category: currentCategory, synonyms: [], needsAI: true })
      }
    }

    return entries
  }
  ```

- [ ] **Step 2: 编译检查**

  ```bash
  cd /home/pdm/DEV/ieltsmate/backend && npx tsc --noEmit 2>&1 | grep "error TS"
  ```

  期望：无输出

---

## Task 4: ImportService — Stage 2+3 AI 编排

**Files:**
- Create: `backend/src/import/import.service.ts`

- [ ] **Step 1: 创建 import.service.ts**

  Stage 2 Prompt 让 AI 为无翻译条目补充释义；Stage 3 Prompt 让 AI 检查整批结果。

  ```typescript
  // backend/src/import/import.service.ts
  import { Injectable, Logger } from '@nestjs/common'
  import { PrismaService } from '../prisma/prisma.service'
  import { AiService } from '../ai/ai.service'
  import { parseMarkdown, RawEntry } from './import.parser'

  export interface ParsedNote {
    content: string
    translation: string
    category: string
    phonetic?: string
    synonyms?: string[]
    antonyms?: string[]
    example?: string
    memoryTip?: string
  }

  export interface FlaggedItem {
    noteIndex: number
    issue: string
    suggestion: Partial<ParsedNote>
  }

  export interface PreviewResult {
    notes: ParsedNote[]
    flagged: FlaggedItem[]
    stats: {
      total: number
      rulesParsed: number
      aiAssisted: number
      flaggedCount: number
    }
  }

  @Injectable()
  export class ImportService {
    private readonly logger = new Logger(ImportService.name)

    constructor(
      private readonly prisma: PrismaService,
      private readonly aiService: AiService,
    ) {}

    async preview(fileBuffer: Buffer, modelId?: string): Promise<PreviewResult> {
      const markdown = fileBuffer.toString('utf-8')
      const rawEntries = parseMarkdown(markdown)

      let notes: ParsedNote[] = rawEntries.map((e) => ({
        content: e.content,
        translation: e.translation,
        category: e.category,
        synonyms: e.synonyms.length > 0 ? e.synonyms : undefined,
      }))

      const aiNeededIndices = rawEntries
        .map((e, i) => (e.needsAI || !e.translation ? i : -1))
        .filter((i) => i >= 0)

      let aiAssisted = 0

      // ── Stage 2: AI 补充缺失翻译 ────────────────────────────────────────────
      if (aiNeededIndices.length > 0) {
        try {
          const items = aiNeededIndices.map((i) => ({
            globalIndex: i,
            content: rawEntries[i].content,
            category: rawEntries[i].category,
          }))

          const prompt = `你是一个英语词典助手。对下面每个词条，提供中文释义（尽量简洁，包含读音提示）。
如果是句子或短语，提供中文翻译。如果是单词，提供含义和词性。
返回严格的 JSON 数组，每项包含: globalIndex(数字), content(原词保持不变), translation(中文释义), category(分类，可保持原值或更正).
仅返回 JSON 数组，不要有任何解释文字。

词条列表:
${JSON.stringify(items, null, 2)}`

          const raw = await this.aiService.complete({
            messages: [{ role: 'user', content: prompt }],
            model: modelId,
            slot: 'classify',
          })

          // 提取 JSON 数组（可能被代码块包裹）
          const jsonMatch = raw.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const filled = JSON.parse(jsonMatch[0]) as Array<{
              globalIndex: number
              content: string
              translation: string
              category?: string
            }>
            for (const item of filled) {
              if (item.globalIndex >= 0 && item.globalIndex < notes.length) {
                notes[item.globalIndex].translation = item.translation || notes[item.globalIndex].translation
                if (item.category) notes[item.globalIndex].category = item.category
                aiAssisted++
              }
            }
          }
        } catch (err) {
          this.logger.warn('Stage 2 AI 补充失败，降级处理', err)
        }
      }

      // ── Stage 3: AI Review ────────────────────────────────────────────────
      const flagged: FlaggedItem[] = []
      if (notes.length <= 60) {
        try {
          const reviewPrompt = `你是一个数据质量审核助手。检查下面的笔记条目列表，找出明显有问题的条目（如：content 和 translation 内容混淆、category 与内容不符、translation 明显是英文而不是中文等）。
仅标记有明显问题的条目（0-5条即可，不要过度标记）。
返回严格的 JSON 数组，每项包含: noteIndex(数字，0-based), issue(问题描述，中文), suggestion(建议修正的字段对象，只包含需要改的字段).
仅返回 JSON 数组，无问题时返回空数组 [].

笔记列表:
${JSON.stringify(notes.map((n, i) => ({ index: i, ...n })), null, 2)}`

          const raw = await this.aiService.complete({
            messages: [{ role: 'user', content: reviewPrompt }],
            model: modelId,
            slot: 'classify',
          })

          const jsonMatch = raw.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const reviewed = JSON.parse(jsonMatch[0]) as Array<{
              noteIndex: number
              issue: string
              suggestion: Partial<ParsedNote>
            }>
            flagged.push(...reviewed.filter((r) => r.noteIndex >= 0 && r.noteIndex < notes.length))
          }
        } catch (err) {
          this.logger.warn('Stage 3 AI Review 失败，降级跳过', err)
        }
      }

      return {
        notes,
        flagged,
        stats: {
          total: notes.length,
          rulesParsed: notes.length - aiAssisted,
          aiAssisted,
          flaggedCount: flagged.length,
        },
      }
    }

    async save(notes: ParsedNote[]): Promise<{ created: number; failed: number; errors: string[] }> {
      const errors: string[] = []
      let created = 0
      let failed = 0

      // 逐条插入以便捕获单条失败
      for (const note of notes) {
        try {
          await this.prisma.note.create({
            data: {
              content: note.content,
              translation: note.translation || '（暂无释义）',
              category: note.category || '未分类',
              phonetic: note.phonetic ?? null,
              synonyms: note.synonyms ?? [],
              antonyms: note.antonyms ?? [],
              example: note.example ?? null,
              memoryTip: note.memoryTip ?? null,
            },
          })
          created++
        } catch (err) {
          failed++
          errors.push(`${note.content}: ${String(err)}`)
        }
      }

      return { created, failed, errors }
    }
  }
  ```

- [ ] **Step 2: 编译检查**

  ```bash
  cd /home/pdm/DEV/ieltsmate/backend && npx tsc --noEmit 2>&1 | grep "error TS"
  ```

  期望：无输出

---

## Task 5: ImportController + ImportModule + 注册

**Files:**
- Create: `backend/src/import/dto/save-notes.dto.ts`
- Create: `backend/src/import/import.controller.ts`
- Create: `backend/src/import/import.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: 创建 save-notes.dto.ts**

  ```typescript
  // backend/src/import/dto/save-notes.dto.ts
  import { IsArray, ValidateNested } from 'class-validator'
  import { Type } from 'class-transformer'

  class ParsedNoteDto {
    content!: string
    translation!: string
    category!: string
    phonetic?: string
    synonyms?: string[]
    antonyms?: string[]
    example?: string
    memoryTip?: string
  }

  export class SaveNotesDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ParsedNoteDto)
    notes!: ParsedNoteDto[]
  }
  ```

- [ ] **Step 2: 创建 import.controller.ts**

  ```typescript
  // backend/src/import/import.controller.ts
  import {
    BadRequestException,
    Body,
    Controller,
    Post,
    Query,
    UploadedFile,
    UseInterceptors,
  } from '@nestjs/common'
  import { FileInterceptor } from '@nestjs/platform-express'
  import { ImportService } from './import.service'
  import { SaveNotesDto } from './dto/save-notes.dto'

  @Controller('import')
  export class ImportController {
    constructor(private readonly importService: ImportService) {}

    @Post('notes/preview')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
    async preview(
      @UploadedFile() file: Express.Multer.File,
      @Query('modelId') modelId?: string,
    ) {
      if (!file) throw new BadRequestException('请上传文件')
      const ext = file.originalname.split('.').pop()?.toLowerCase()
      if (ext !== 'md') throw new BadRequestException('仅支持 .md 文件')
      return this.importService.preview(file.buffer, modelId)
    }

    @Post('notes/save')
    async save(@Body() dto: SaveNotesDto) {
      return this.importService.save(dto.notes)
    }
  }
  ```

- [ ] **Step 3: 创建 import.module.ts**

  ```typescript
  // backend/src/import/import.module.ts
  import { Module } from '@nestjs/common'
  import { MulterModule } from '@nestjs/platform-express'
  import { AiModule } from '../ai/ai.module'
  import { PrismaModule } from '../prisma/prisma.module'
  import { ImportController } from './import.controller'
  import { ImportService } from './import.service'

  @Module({
    imports: [
      PrismaModule,
      AiModule,
      MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } }),
    ],
    controllers: [ImportController],
    providers: [ImportService],
  })
  export class ImportModule {}
  ```

- [ ] **Step 4: 在 app.module.ts 注册 ImportModule**

  ```typescript
  // 在 backend/src/app.module.ts 顶部添加：
  import { ImportModule } from './import/import.module'
  import { ExportModule } from './export/export.module'  // 如 Task 2 未完成请一并添加
  ```

  在 `imports` 数组添加 `ImportModule`（`ExportModule` 在 Task 2 中已添加）。

- [ ] **Step 5: 最终编译检查**

  ```bash
  cd /home/pdm/DEV/ieltsmate/backend && npx tsc --noEmit 2>&1 | grep "error TS"
  ```

  期望：无输出

---

## Task 6: Vite Proxy 新增 /export 和 /import

**Files:**
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: 在 vite.config.ts 的 proxy 对象中添加两条规则**

  在现有最后一个 proxy 规则（`/writing-assets`）之后追加：

  ```typescript
  '/export': {
    target: 'http://127.0.0.1:3000',
    changeOrigin: true,
    bypass: (req: { headers: Record<string, string | undefined> }) =>
      req.headers['accept']?.includes('text/html') ? req.url : null,
  },
  '/import': {
    target: 'http://127.0.0.1:3000',
    changeOrigin: true,
    bypass: (req: { headers: Record<string, string | undefined> }) =>
      req.headers['accept']?.includes('text/html') ? req.url : null,
  },
  ```

- [ ] **Step 2: 检查 vite.config.ts lint**

  ```bash
  cd /home/pdm/DEV/ieltsmate/frontend && npx tsc --noEmit 2>&1 | grep "error TS"
  ```

  期望：无输出

---

## Task 7: Settings.tsx — 导出按钮 + 导入按钮

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: 在 Settings 组件顶部添加 openImport、handleExport**

  在 `export default function Settings()` 函数体内，现有 `const { openAIConfig, theme, ... }` 行下方添加：

  ```typescript
  const { openAIConfig, theme, setTheme, providers, classifyModel, reviewModel, chatModel, setModelSlot, openImport } = useAppStore()

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const res = await fetch(`/export/notes?format=${format}`)
      if (!res.ok) throw new Error('导出失败')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ieltsmate-notes-${today}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('导出失败', e)
    }
  }
  ```

  （原有 `const { openAIConfig, ... }` 那行加入 `openImport`）

- [ ] **Step 2: 给两个导出按钮和导入按钮加 onClick**

  找到 Settings.tsx 中导出 JSON 按钮（含 `<Download size={12} />JSON`），改为：

  ```tsx
  <button
    onClick={() => void handleExport('json')}
    className="flex items-center gap-1.5 h-8 px-3 text-xs border border-border rounded-sm text-text-muted hover:bg-[#27272a] transition-colors"
  >
    <Download size={12} />JSON
  </button>
  <button
    onClick={() => void handleExport('csv')}
    className="flex items-center gap-1.5 h-8 px-3 text-xs border border-border rounded-sm text-text-muted hover:bg-[#27272a] transition-colors"
  >
    <Download size={12} />CSV
  </button>
  ```

  找到导入按钮（含 `<Upload size={12} />选择文件`），改为：

  ```tsx
  <button
    onClick={openImport}
    className="flex items-center gap-1.5 h-8 px-3 text-xs bg-primary-btn hover:bg-[#4338ca] rounded-sm text-white transition-colors"
  >
    <Upload size={12} />选择文件
  </button>
  ```

- [ ] **Step 3: lint 检查**

  ```bash
  cd /home/pdm/DEV/ieltsmate/frontend && npx tsc --noEmit 2>&1 | grep "error TS"
  ```

  期望：无输出

---

## Task 8: ImportModal.tsx — 三步状态机重写

**Files:**
- Modify: `frontend/src/components/modals/ImportModal.tsx`

这是最大的前端改动。用状态机完全替换原有 mock 逻辑。

- [ ] **Step 1: 定义接口和状态类型，重写组件**

  完整替换 `frontend/src/components/modals/ImportModal.tsx`：

  ```typescript
  import { useState, useRef } from 'react'
  import {
    X, Upload, Sparkles, HelpCircle, CheckCircle2, AlertCircle, ChevronRight, ChevronDown,
  } from 'lucide-react'
  import { motion, AnimatePresence } from 'framer-motion'
  import { useAppStore } from '../../store/useAppStore'

  interface ParsedNote {
    content: string
    translation: string
    category: string
    synonyms?: string[]
    antonyms?: string[]
    phonetic?: string
    example?: string
    memoryTip?: string
  }

  interface FlaggedItem {
    noteIndex: number
    issue: string
    suggestion: Partial<ParsedNote>
  }

  interface PreviewResult {
    notes: ParsedNote[]
    flagged: FlaggedItem[]
    stats: { total: number; rulesParsed: number; aiAssisted: number; flaggedCount: number }
  }

  type Step = 'idle' | 'parsing' | 'reviewing' | 'saving' | 'done'

  export function ImportModal() {
    const { showImport, closeImport, providers } = useAppStore()
    const [step, setStep] = useState<Step>('idle')
    const [file, setFile] = useState<File | null>(null)
    const [modelId, setModelId] = useState<string>('')
    const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
    const [resolvedNotes, setResolvedNotes] = useState<ParsedNote[]>([])
    const [flagDecisions, setFlagDecisions] = useState<Record<number, 'accept' | 'keep'>>({})
    const [saveResult, setSaveResult] = useState<{ created: number; failed: number } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [showTip, setShowTip] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    // 所有 provider 的模型列表
    const allModels = providers.flatMap((p) =>
      p.models.map((m) => ({ label: `${p.name} / ${m.id.split('/').pop() ?? m.id}`, value: m.id.split('/').pop() ?? m.id }))
    )

    const handleClose = () => {
      setStep('idle')
      setFile(null)
      setModelId('')
      setPreviewResult(null)
      setResolvedNotes([])
      setFlagDecisions({})
      setSaveResult(null)
      setError(null)
      closeImport()
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFile(e.target.files?.[0] ?? null)
      setError(null)
    }

    const handleStartParse = async () => {
      if (!file) return
      setStep('parsing')
      setError(null)
      try {
        const form = new FormData()
        form.append('file', file)
        const url = modelId ? `/import/notes/preview?modelId=${encodeURIComponent(modelId)}` : '/import/notes/preview'
        const res = await fetch(url, { method: 'POST', body: form })
        if (!res.ok) {
          const j = await res.json().catch(() => ({})) as { message?: string }
          throw new Error(j.message ?? '解析失败')
        }
        const json = await res.json() as { data: PreviewResult }
        const result = json.data
        setPreviewResult(result)
        setResolvedNotes([...result.notes])
        if (result.flagged.length > 0) {
          setStep('reviewing')
        } else {
          await doSave(result.notes)
        }
      } catch (e) {
        setError(String(e))
        setStep('idle')
      }
    }

    const doSave = async (notes: ParsedNote[]) => {
      setStep('saving')
      try {
        const res = await fetch('/import/notes/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes }),
        })
        const json = await res.json() as { data: { created: number; failed: number } }
        setSaveResult(json.data)
        setStep('done')
      } catch (e) {
        setError(String(e))
        setStep('reviewing')
      }
    }

    const handleConfirmReview = async () => {
      if (!previewResult) return
      const final = resolvedNotes.map((note, i) => {
        const flag = previewResult.flagged.find((f) => f.noteIndex === i)
        if (flag && flagDecisions[i] === 'accept') {
          return { ...note, ...flag.suggestion }
        }
        return note
      })
      await doSave(final)
    }

    const toggleDecision = (idx: number, decision: 'accept' | 'keep') => {
      setFlagDecisions((prev) => ({ ...prev, [idx]: decision }))
    }

    return (
      <AnimatePresence>
        {showImport && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={step === 'idle' ? handleClose : undefined}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{ position: 'fixed', left: '50%', top: '50%', translateX: '-50%', translateY: '-50%', zIndex: 50, width: step === 'reviewing' ? 560 : 480 }}
              className="bg-[#1c1c20] border border-[#2a2a35] rounded-xl shadow-modal"
            >
              <div className="p-6 flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-text-primary">导入数据</span>
                    <div className="relative">
                      <button
                        onMouseEnter={() => setShowTip(true)}
                        onMouseLeave={() => setShowTip(false)}
                        className="text-text-subtle hover:text-text-dim transition-colors"
                      >
                        <HelpCircle size={14} />
                      </button>
                      <AnimatePresence>
                        {showTip && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="absolute left-0 top-6 w-64 bg-[#1a1a28] border border-border rounded-md p-3 text-xs text-text-muted z-10 shadow-modal"
                          >
                            <div className="flex items-center gap-1.5 mb-1.5 text-primary">
                              <Sparkles size={10} />
                              <span className="font-semibold">AI 辅助导入</span>
                            </div>
                            上传杂笔记格式的 .md 文件，AI 自动识别并补充释义，最后整体 Review 确认。
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <button onClick={handleClose} className="text-text-dim hover:text-text-muted transition-colors">
                    <X size={18} />
                  </button>
                </div>

                {/* Step 1: 选文件 + 模型 */}
                {(step === 'idle' || step === 'parsing') && (
                  <>
                    {/* AI 模型选择器 */}
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-text-dim">AI 解析模型</span>
                      {allModels.length > 0 ? (
                        <select
                          value={modelId}
                          onChange={(e) => setModelId(e.target.value)}
                          className="h-9 bg-[#232328] border border-border rounded-sm px-3 text-xs text-text-muted hover:border-border-strong transition-colors outline-none appearance-none cursor-pointer"
                        >
                          <option value="">使用默认模型（classify slot）</option>
                          {allModels.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-xs text-[#fb7185] bg-[#2e1520] border border-[#fb7185]/20 rounded-md px-3 py-2">
                          请先在设置中配置 AI 模型
                        </div>
                      )}
                    </div>

                    {/* 文件选择 */}
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-text-dim">选择文件</span>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".md"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileRef.current?.click()}
                        className={`flex items-center gap-3 h-20 border-2 border-dashed rounded-lg px-4 transition-all ${
                          file ? 'border-primary/50 bg-[#1e1b4b]/30' : 'border-border hover:border-border-strong'
                        }`}
                      >
                        <Upload size={20} className={file ? 'text-primary' : 'text-text-dim'} />
                        <div className="text-left">
                          {file ? (
                            <>
                              <div className="text-sm font-medium text-text-primary">{file.name}</div>
                              <div className="text-xs text-text-dim mt-0.5">{(file.size / 1024).toFixed(1)} KB</div>
                            </>
                          ) : (
                            <>
                              <div className="text-sm text-text-muted">点击选择 .md 文件</div>
                              <div className="text-xs text-text-subtle mt-0.5">杂笔记格式，最大 5MB</div>
                            </>
                          )}
                        </div>
                      </button>
                    </div>

                    {/* AI 说明 */}
                    <div className="flex items-start gap-2.5 bg-[#141428] border border-[#3a3a5a] rounded-md px-3.5 py-3">
                      <Sparkles size={13} className="text-primary mt-0.5 shrink-0" />
                      <p className="text-xs text-text-muted leading-relaxed">
                        规则解析 + AI 补充释义，最后整体 Review。若 AI 发现问题将弹出确认窗口。
                      </p>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 text-xs text-[#fb7185]">
                        <AlertCircle size={12} />
                        {error}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2.5">
                      <button
                        onClick={handleClose}
                        className="h-9 px-5 border border-border rounded-md text-[13px] text-text-dim hover:bg-[#27272a] transition-colors"
                      >
                        取消
                      </button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => void handleStartParse()}
                        disabled={!file || step === 'parsing'}
                        className="h-9 px-5 rounded-md text-[13px] font-medium transition-all flex items-center gap-2 bg-primary-btn hover:bg-[#4338ca] text-white disabled:opacity-50"
                      >
                        {step === 'parsing' ? (
                          <>
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                              <Upload size={14} />
                            </motion.div>
                            AI 解析中...
                          </>
                        ) : (
                          <>开始解析</>
                        )}
                      </motion.button>
                    </div>
                  </>
                )}

                {/* Step 2: Review 确认 */}
                {step === 'reviewing' && previewResult && (
                  <>
                    <div className="text-xs text-text-dim">
                      共解析 <span className="text-text-primary font-medium">{previewResult.stats.total}</span> 条，
                      AI 补充 {previewResult.stats.aiAssisted} 条，
                      发现 <span className="text-[#fbbf24] font-medium">{previewResult.stats.flaggedCount}</span> 处疑问
                    </div>

                    <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                      {previewResult.flagged.map((flag) => {
                        const note = resolvedNotes[flag.noteIndex]
                        const decision = flagDecisions[flag.noteIndex] ?? 'keep'
                        return (
                          <div key={flag.noteIndex} className="bg-[#141420] border border-border rounded-lg p-3 flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="text-[11px] text-[#fbbf24] mb-1">{flag.issue}</div>
                                <div className="text-xs text-text-dim">
                                  原始：<span className="text-text-muted">{note?.content}</span>
                                  {note?.translation && <span className="text-text-subtle"> / {note.translation}</span>}
                                </div>
                                {Object.keys(flag.suggestion).length > 0 && (
                                  <div className="text-xs text-text-dim mt-0.5">
                                    建议：
                                    {Object.entries(flag.suggestion).map(([k, v]) => (
                                      <span key={k} className="text-primary ml-1">{k}="{String(v)}"</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => toggleDecision(flag.noteIndex, 'accept')}
                                className={`flex-1 h-7 text-xs rounded-md border transition-colors ${
                                  decision === 'accept'
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border text-text-dim hover:border-border-strong'
                                }`}
                              >
                                接受建议
                              </button>
                              <button
                                onClick={() => toggleDecision(flag.noteIndex, 'keep')}
                                className={`flex-1 h-7 text-xs rounded-md border transition-colors ${
                                  decision === 'keep'
                                    ? 'border-[#94a3b8] bg-[#94a3b8]/10 text-[#94a3b8]'
                                    : 'border-border text-text-dim hover:border-border-strong'
                                }`}
                              >
                                保留原始
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex items-center justify-end gap-2.5">
                      <button
                        onClick={handleClose}
                        className="h-9 px-5 border border-border rounded-md text-[13px] text-text-dim hover:bg-[#27272a] transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => void handleConfirmReview()}
                        className="h-9 px-5 rounded-md text-[13px] font-medium bg-primary-btn hover:bg-[#4338ca] text-white flex items-center gap-1.5"
                      >
                        确认并导入
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </>
                )}

                {/* Step 3: saving */}
                {step === 'saving' && (
                  <div className="flex flex-col items-center gap-4 py-6">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                      <Upload size={28} className="text-primary" />
                    </motion.div>
                    <span className="text-sm text-text-muted">正在写入数据库...</span>
                  </div>
                )}

                {/* Step 4: done */}
                {step === 'done' && saveResult && (
                  <>
                    <div className="flex flex-col items-center gap-3 py-4">
                      <CheckCircle2 size={32} className="text-[#34d399]" />
                      <div className="text-center">
                        <div className="text-base font-semibold text-text-primary">
                          已导入 {saveResult.created} 条笔记
                        </div>
                        {saveResult.failed > 0 && (
                          <div className="text-xs text-[#fb7185] mt-1">
                            {saveResult.failed} 条写入失败
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleClose}
                        className="h-9 px-6 bg-primary-btn hover:bg-[#4338ca] rounded-md text-[13px] font-medium text-white transition-colors"
                      >
                        关闭
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    )
  }
  ```

- [ ] **Step 2: lint + tsc 检查**

  ```bash
  cd /home/pdm/DEV/ieltsmate/frontend && npx tsc --noEmit 2>&1 | grep "error TS"
  ```

  期望：无输出

---

## Task 9: 更新 project.md

**Files:**
- Modify: `project.md`

- [ ] **Step 1: 将 大功能 9 各条目标记为完成**

  将 `project.md` 中大功能 9 的各条 `- [ ]` 全部改为 `- [x]`，并在标题下方更新说明：

  ```markdown
  ## 大功能 9：导入 / 导出 / 清理数据

  > 导入：仅支持杂笔记 .md 格式（三阶段：规则解析 + AI补充 + AI Review）；导出：JSON/CSV 全字段；清空数据前端保留，后端不实现。

  - [x] `GET /export/notes?format=json|csv` 导出杂笔记（@Res() 绕过 ResponseInterceptor）
  - [x] `POST /import/notes/preview` 三阶段解析（规则+AI补充+AI Review），返回 notes + flagged
  - [x] `POST /import/notes/save` 批量写库
  - [x] `AiService.complete()` 无 Function Calling 的轻量 AI 调用方法
  - [x] Vite proxy 新增 /export 和 /import
  - [x] 前端 Settings 页：导出 JSON/CSV 按钮、导入按钮接入真实接口
  - [x] 前端 ImportModal：三步状态机（选文件+模型 → Review → 完成）
  - [ ] `DELETE /data/all` 清空全部数据（未实现，前端按钮保留）
  ```

---

## Self-Review 清单

- [x] **导出绕过 ResponseInterceptor** — Task 2 ExportController 使用 `@Res()`
- [x] **AiService.complete() 无 tools** — Task 1 独立方法，不含 `this.TOOLS`
- [x] **Multer + MulterModule** — Task 5 ImportModule 注册，Task 5 controller 使用 `FileInterceptor`
- [x] **ParsedNote 类型一致** — Task 4 ImportService 定义，Task 8 ImportModal 本地重复定义（前端不 import 后端类型）
- [x] **Stage 3 token 控制** — Task 4 `if (notes.length <= 60)` 判断
- [x] **Settings openImport** — Task 7 从 store 解构 openImport，导入按钮调用
- [x] **Vite proxy bypass** — Task 6 完整代码，不省略
- [x] **project.md 更新** — Task 9

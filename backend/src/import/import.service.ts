import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AiService } from '../ai/ai.service'
import { parseMarkdown } from './import.parser'

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
    /** 仍为「未分类」时由 AI 推断并成功写入的分类条数 */
    categoriesInferred: number
    flaggedCount: number
  }
}

/** 与前端导入、知识库一致；AI 仅能选用下列之一（禁止自造类目名） */
const IMPORT_AI_CATEGORY_WHITELIST = [
  '口语',
  '短语',
  '句子',
  '同义替换',
  '拼写',
  '单词',
  '写作',
] as const

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name)
  private static readonly AI_BATCH_SIZE = 20

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  private parseJsonArray(raw: string): unknown[] | null {
    const trimmed = raw.trim()
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const source = fenceMatch?.[1]?.trim() || trimmed

    if (source.startsWith('[')) {
      try {
        const parsed = JSON.parse(source)
        if (Array.isArray(parsed)) return parsed
      } catch {
        // ignore and continue with fallback matcher
      }
    }

    const candidates = source.match(/\[[\s\S]*?\]/g) ?? []
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate)
        if (Array.isArray(parsed)) return parsed
      } catch {
        // ignore invalid candidate
      }
    }
    return null
  }

  private isUncategorized(category: string | undefined): boolean {
    const t = category?.trim()
    return !t || t === '未分类'
  }

  private normalizeImportAiCategory(raw: string | undefined): string | null {
    const t = raw?.trim()
    if (!t) return null
    return IMPORT_AI_CATEGORY_WHITELIST.includes(t as (typeof IMPORT_AI_CATEGORY_WHITELIST)[number])
      ? t
      : null
  }

  /**
   * 对仍为「未分类」的条目批量推断分类（与阶段 2 是否运行无关）。
   */
  private async inferCategoriesForNotes(notes: ParsedNote[], modelId?: string): Promise<number> {
    const indices = notes
      .map((n, i) => (this.isUncategorized(n.category) ? i : -1))
      .filter((i) => i >= 0)
    if (indices.length === 0) return 0

    const assigned = new Set<number>()
    const chunks: number[][] = []
    for (let i = 0; i < indices.length; i += ImportService.AI_BATCH_SIZE) {
      chunks.push(indices.slice(i, i + ImportService.AI_BATCH_SIZE))
    }

    const allowed = IMPORT_AI_CATEGORY_WHITELIST.join('、')

    for (const indexChunk of chunks) {
      try {
        const items = indexChunk.map((i) => ({
          globalIndex: i,
          content: notes[i].content,
          translation: notes[i].translation,
          synonyms: notes[i].synonyms?.length ? notes[i].synonyms : undefined,
        }))

        const prompt = `你是雅思学习笔记分类助手。根据每条笔记的英文 content 与中文 translation（及同义词 synonyms 若有），为其选择**唯一**分类。

**可选分类**（必须逐字选用下列之一，禁止自造或改写名称）：
${allowed}

**判断要点**（择最贴切的一项）：
- **单词**：单个词、派生词、功能词/连接词（如 since、hence、thus、given 作介词时仍常作单词卡）
- **短语**：固定搭配、多词短语（如 in that、get out of）
- **句子**：完整英文句子或从句级例句型笔记
- **同义替换**：典型同义改写链、A=B 类（若 content 即体现替换关系）
- **拼写**：以易混拼写为主、无中文释义的拼写表
- **口语**：明显为口语套话、习语表达
- **写作**：明显针对写作任务的高分表达/模板句

若极难判断，优先选 **单词** 或 **短语**（按词数：单核词偏单词，多词固定搭配偏短语）。

返回严格的 JSON 数组，每项仅含: { "globalIndex": 数字, "category": "..." }，不要解释。

待分类列表:
${JSON.stringify(items, null, 2)}`

        const raw = await this.aiService.complete({
          messages: [{ role: 'user', content: prompt }],
          model: modelId,
          slot: 'classify',
          timeoutMs: 90_000,
        })

        const parsed = this.parseJsonArray(raw)
        if (!parsed) continue

        const filled = parsed as Array<{ globalIndex?: number; category?: string }>
        for (const item of filled) {
          if (typeof item.globalIndex !== 'number' || item.globalIndex < 0 || item.globalIndex >= notes.length) {
            continue
          }
          const cat = this.normalizeImportAiCategory(item.category)
          if (cat) {
            notes[item.globalIndex].category = cat
            assigned.add(item.globalIndex)
          }
        }
      } catch (err) {
        this.logger.warn(
          `AI 分类推断失败（chunk=${indexChunk.length}）: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    return assigned.size
  }

  async preview(fileBuffer: Buffer, modelId?: string, forceAi = false): Promise<PreviewResult> {
    const markdown = fileBuffer.toString('utf-8')
    const rawEntries = parseMarkdown(markdown)

    const notes: ParsedNote[] = rawEntries.map((e) => ({
      content: e.content,
      translation: e.translation,
      category: e.category,
      synonyms: e.synonyms.length > 0 ? e.synonyms : undefined,
    }))

    const aiNeededIndices = rawEntries
      .map((e, i) => {
        if (forceAi && /[a-zA-Z]/.test(e.content)) return i
        return e.needsAI || !e.translation ? i : -1
      })
      .filter((i) => i >= 0)

    const rulesParsed = rawEntries.filter((e) => !e.needsAI && e.translation).length
    const aiAssistedIndices = new Set<number>()
    const stage2Errors: string[] = []

    // ── Stage 2: AI 补充缺失翻译（支持多词条行拆分） ──────────────────────────
    if (aiNeededIndices.length > 0) {
      const chunks: number[][] = []
      for (let i = 0; i < aiNeededIndices.length; i += ImportService.AI_BATCH_SIZE) {
        chunks.push(aiNeededIndices.slice(i, i + ImportService.AI_BATCH_SIZE))
      }

      for (const indexChunk of chunks) {
        try {
          const items = indexChunk.map((i) => {
            const row: {
              globalIndex: number
              content: string
              category: string
              existingSynonyms?: string[]
              existingTranslation?: string
            } = {
              globalIndex: i,
              content: notes[i].content,
              category: notes[i].category,
            }
            if (notes[i].synonyms?.length) row.existingSynonyms = notes[i].synonyms
            const trimmedTrans = notes[i].translation?.trim()
            if (trimmedTrans) row.existingTranslation = trimmedTrans
            return row
          })

          const prompt = `你是一个英语学习笔记整理助手。处理下面每个词条，规则如下：

**总则**：不得擅自删改用户已给出的释义用词。释义里常带有词性标签（如 v./n./adj./adv.）、破折号、括号内英文（如 alternative adj.）等，这些都属于释义正文的一部分，必须与输入一致完整地保留。
若某条带有 existingTranslation 字段（非空），则返回的 translation 必须与其逐字等价，或仅在明显缺译时在其基础上增补，严禁去掉词性标注、括号内英文或任何非中文片段。

**规则1 - 单词或短语**（content 是单个英文词/短语）：
  若无 existingTranslation：提供中文释义（可含词性、括号中英混写等与用户习惯的格式）。
  返回: { globalIndex, content(与输入完全一致), translation, category }

**规则2 - 同义替换**（content 是英文短语，existingSynonyms 有值）：
  补充中文释义。返回: { globalIndex, content(与输入完全一致), translation, category }

**规则3 - 多词条混排行**（content 里有多个英文词条穿插中文注释，如 "meditation冥想沉思 dispense分发分配 indispensable不可或缺的"）：
  将这一行拆分成多个独立词条。返回: { globalIndex, split: true, entries: [{content, translation, synonyms?}] }
  拆分时保留已有的中文释义，不要重复翻译。

**规则4 - 完整英文句子**（content 是一个英文例句/语法说明）：
  提供中文翻译。返回: { globalIndex, content(保持原样), translation(中文翻译), category }

返回严格的 JSON 数组，不要有任何解释文字。

词条列表:
${JSON.stringify(items, null, 2)}`

          const raw = await this.aiService.complete({
            messages: [{ role: 'user', content: prompt }],
            model: modelId,
            slot: 'classify',
            timeoutMs: 120_000,
          })

          const parsed = this.parseJsonArray(raw)
          if (!parsed) {
            stage2Errors.push('模型返回内容不是可解析的 JSON 数组')
            continue
          }

          const filled = parsed as Array<{
            globalIndex: number
            split?: boolean
            entries?: Array<{ content: string; translation: string; synonyms?: string[] }>
            content?: string
            translation?: string
            category?: string
          }>

          // 收集需要拆分的索引（倒序处理，保证插入位置正确）
          const splitsToApply: Array<{ idx: number; entries: ParsedNote[] }> = []

          for (const item of filled) {
            const idx = item.globalIndex
            if (idx < 0 || idx >= notes.length) continue

            if (item.split && item.entries && item.entries.length > 0) {
              // 多词条拆分
              const splitNotes: ParsedNote[] = item.entries
                .filter((e) => e.content && e.translation)
                .map((e) => ({
                  content: e.content.trim(),
                  translation: e.translation.trim(),
                  category: notes[idx].category,
                  synonyms: e.synonyms ?? [],
                }))
              if (splitNotes.length > 0) {
                splitsToApply.push({ idx, entries: splitNotes })
                aiAssistedIndices.add(idx)
              }
            } else {
              // 普通单词条补全
              if (item.translation) notes[idx].translation = item.translation
              if (item.category) notes[idx].category = item.category
              if (item.translation || item.category) aiAssistedIndices.add(idx)
            }
          }

          // 倒序应用拆分（避免索引偏移）
          splitsToApply.sort((a, b) => b.idx - a.idx)
          for (const { idx, entries } of splitsToApply) {
            notes.splice(idx, 1, ...entries)
          }
        } catch (err) {
          stage2Errors.push(err instanceof Error ? err.message : String(err))
          this.logger.warn(
            `Stage 2 AI 补充失败（chunk=${indexChunk.length}），降级跳过: ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      }
    }

    if (forceAi && aiNeededIndices.length > 0) {
      const unresolvedCount = notes.filter((n) => !n.translation?.trim()).length
      if (aiAssistedIndices.size === 0 && unresolvedCount > 0) {
        const reason = stage2Errors[0] ?? '未获取到有效 AI 返回'
        throw new BadRequestException(`强制 AI 补全失败：${reason}`)
      }
    }

    // ── Stage 2b: 对「未分类」条目推断分类（规则解析成功时也会执行） ───────────
    const categoriesInferred = await this.inferCategoriesForNotes(notes, modelId)

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
          timeoutMs: 60_000,
        })

        const parsed = this.parseJsonArray(raw)
        if (parsed) {
          const reviewed = parsed as Array<{
            noteIndex: number
            issue: string
            suggestion: Partial<ParsedNote>
          }>
          flagged.push(
            ...reviewed.filter(
              (r) => typeof r.noteIndex === 'number' && r.noteIndex >= 0 && r.noteIndex < notes.length,
            ),
          )
        }
      } catch (err) {
        this.logger.warn(`Stage 3 AI Review 失败，降级跳过: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return {
      notes,
      flagged,
      stats: {
        total: notes.length,
        rulesParsed,
        aiAssisted: aiAssistedIndices.size,
        categoriesInferred,
        flaggedCount: flagged.length,
      },
    }
  }

  async save(notes: ParsedNote[]): Promise<{ created: number; failed: number; errors: string[] }> {
    const errors: string[] = []
    let created = 0
    let failed = 0

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

import { Injectable, Logger } from '@nestjs/common'
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

    const notes: ParsedNote[] = rawEntries.map((e) => ({
      content: e.content,
      translation: e.translation,
      category: e.category,
      synonyms: e.synonyms.length > 0 ? e.synonyms : undefined,
    }))

    const aiNeededIndices = rawEntries
      .map((e, i) => (e.needsAI || !e.translation ? i : -1))
      .filter((i) => i >= 0)

    const rulesParsed = rawEntries.filter((e) => !e.needsAI && e.translation).length
    const aiAssistedIndices = new Set<number>()

    // ── Stage 2: AI 补充缺失翻译（支持多词条行拆分） ──────────────────────────
    if (aiNeededIndices.length > 0) {
      try {
        const items = aiNeededIndices.map((i) => ({
          globalIndex: i,
          content: notes[i].content,
          category: notes[i].category,
          existingSynonyms: notes[i].synonyms,
        }))

        const prompt = `你是一个英语学习笔记整理助手。处理下面每个词条，规则如下：

**规则1 - 单词或短语**（content 是单个英文词/短语，无中文）：
  提供中文释义。返回: { globalIndex, content(保持原样), translation(中文释义), category }

**规则2 - 同义替换**（content 是英文短语，existingSynonyms 有值）：
  直接给 content 补充中文释义即可。返回: { globalIndex, content(保持原样), translation(中文释义), category }

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
        })

        const jsonMatch = raw.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const filled = JSON.parse(jsonMatch[0]) as Array<{
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
              aiAssistedIndices.add(idx)
            }
          }

          // 倒序应用拆分（避免索引偏移）
          splitsToApply.sort((a, b) => b.idx - a.idx)
          for (const { idx, entries } of splitsToApply) {
            notes.splice(idx, 1, ...entries)
          }
        }
      } catch (err) {
        this.logger.warn(`Stage 2 AI 补充失败，降级处理: ${err instanceof Error ? err.message : String(err)}`)
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

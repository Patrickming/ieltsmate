import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Note, Prisma } from '@prisma/client'
import { AiService } from '../ai/ai.service'
import { PrismaService } from '../prisma/prisma.service'
import { ContinueReadingReviewBatchDto, CreateReadingReviewBatchDto } from './dto/create-reading-review-batch.dto'
import {
  countEnglishWords,
  hasChineseText,
  inferUsedNotesFromArticle,
  parseParagraphTranslationsPayload,
  parseReadingArticlePayload,
  ParsedReadingArticle,
} from './review-reading-content.util'

const DEFAULT_ARTICLE_TARGET = 5
const DEFAULT_TIMEOUT_SECONDS = 30 * 60
const VERY_LONG_TIMEOUT_SECONDS = 9999 * 60
const VERY_LONG_TIMEOUT_MS = VERY_LONG_TIMEOUT_SECONDS * 1000
const MIN_NOTES_PER_ARTICLE = 50
const CANDIDATE_NOTES_PER_ARTICLE = 80
const MAX_CONSECUTIVE_FAILURES = 3
const ARTICLE_AI_MAX_ATTEMPTS = 4
const ARTICLE_AI_RETRY_BASE_MS = 3_000
const SINGLE_ARTICLE_TIMEOUT_MS = 8 * 60 * 1000

@Injectable()
export class ReviewReadingService {
  private readonly logger = new Logger(ReviewReadingService.name)
  private readonly batchAbortControllers = new Map<string, AbortController>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async createBatch(dto: CreateReadingReviewBatchDto) {
    const notes = await this.findNotePool(dto)
    if (notes.length === 0) {
      throw new BadRequestException('No notes available for AI reading review with selected filters')
    }
    const modelTarget = await this.aiService.resolveCompletionTarget('readingReview')

    const batch = await this.prisma.aiReadingReviewBatch.create({
      data: {
        sourceType: dto.source,
        rangeType: dto.range,
        categoryFilter: dto.categories ?? [],
        targetArticles: dto.generateAll ? null : dto.articleTarget ?? DEFAULT_ARTICLE_TARGET,
        generateAll: dto.generateAll === true,
        timeoutSeconds: this.normalizeTimeoutSeconds(dto.timeoutSeconds),
        modelProvider: modelTarget.providerName,
        modelId: modelTarget.modelId,
        totalNotes: notes.length,
      },
    })

    void this.runBatch(batch.id, notes, dto, undefined, modelTarget.modelId).catch(async (err) => {
      this.logger.error(`AI reading batch ${batch.id} failed: ${String(err)}`)
      await this.prisma.aiReadingReviewBatch.update({
        where: { id: batch.id },
        data: {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
          endedAt: new Date(),
        },
      }).catch(() => null)
    })

    return this.getBatch(batch.id)
  }

  async continueBatch(id: string, dto: ContinueReadingReviewBatchDto) {
    const batch = await this.prisma.aiReadingReviewBatch.findUnique({
      where: { id },
      include: { articles: { select: { id: true } } },
    })
    if (!batch) throw new NotFoundException('AI reading batch not found')
    if (batch.status === 'pending' || batch.status === 'running') {
      return this.getBatch(id)
    }

    const notePool = await this.findNotePool({
      source: batch.sourceType === 'favorites' ? 'favorites' : 'notes',
      range: this.normalizeRange(batch.rangeType),
      categories: batch.categoryFilter,
    })
    const usedRows = await this.prisma.aiReadingArticleNote.findMany({
      where: { article: { batchId: id }, noteId: { not: null } },
      select: { noteId: true },
    })
    const usedIds = new Set(usedRows.map((row) => row.noteId).filter((noteId): noteId is string => Boolean(noteId)))
    const remaining = notePool.filter((note) => !usedIds.has(note.id))
    if (remaining.length === 0) {
      throw new BadRequestException('No unused notes remain in this AI reading batch')
    }

    const currentArticleCount = batch.articles.length
    const nextTargetTotal = dto.generateAll
      ? null
      : currentArticleCount + (dto.articleTarget ?? DEFAULT_ARTICLE_TARGET)
    const modelTarget = await this.aiService.resolveCompletionTarget('readingReview')
    await this.prisma.aiReadingReviewBatch.update({
      where: { id },
      data: {
        status: 'pending',
        endedAt: null,
        cancelledAt: null,
        errorMessage: null,
        timeoutSeconds: dto.timeoutSeconds ?? batch.timeoutSeconds,
        generateAll: dto.generateAll === true,
        targetArticles: nextTargetTotal,
        modelProvider: modelTarget.providerName,
        modelId: modelTarget.modelId,
        totalNotes: notePool.length,
      },
    })

    void this.runBatch(
      id,
      remaining,
      {
        source: batch.sourceType === 'favorites' ? 'favorites' : 'notes',
        range: this.normalizeRange(batch.rangeType),
        categories: batch.categoryFilter,
        articleTarget: dto.articleTarget,
        generateAll: dto.generateAll,
        timeoutSeconds: dto.timeoutSeconds ?? batch.timeoutSeconds,
      },
      nextTargetTotal ?? undefined,
      modelTarget.modelId,
    ).catch(async (err) => {
      this.logger.error(`AI reading batch ${id} continue failed: ${String(err)}`)
      await this.prisma.aiReadingReviewBatch.update({
        where: { id },
        data: {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
          endedAt: new Date(),
        },
      }).catch(() => null)
    })

    return this.getBatch(id)
  }

  async listBatches() {
    const items = await this.prisma.aiReadingReviewBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { articles: { orderBy: { createdAt: 'asc' }, select: this.articleSummarySelect() } },
    })
    return { items }
  }

  async getBatch(id: string) {
    const batch = await this.prisma.aiReadingReviewBatch.findUnique({
      where: { id },
      include: { articles: { orderBy: { createdAt: 'asc' }, select: this.articleSummarySelect() } },
    })
    if (!batch) throw new NotFoundException('AI reading batch not found')
    return batch
  }

  async cancelBatch(id: string) {
    const batch = await this.prisma.aiReadingReviewBatch.findUnique({ where: { id } })
    if (!batch) throw new NotFoundException('AI reading batch not found')
    if (batch.status === 'completed' || batch.status === 'failed' || batch.status === 'cancelled') {
      return this.getBatch(id)
    }
    this.batchAbortControllers.get(id)?.abort()
    await this.prisma.aiReadingReviewBatch.update({
      where: { id },
      data: { status: 'cancelled', cancelledAt: new Date(), endedAt: new Date() },
    })
    return this.getBatch(id)
  }

  async deleteBatch(id: string) {
    await this.ensureBatch(id)
    await this.prisma.aiReadingReviewBatch.delete({ where: { id } })
    return { ok: true }
  }

  async getArticle(id: string) {
    const article = await this.prisma.aiReadingArticle.findUnique({
      where: { id },
      include: {
        notes: {
          orderBy: { createdAt: 'asc' },
          include: {
            note: {
              select: { id: true, content: true, translation: true, category: true, reviewStatus: true },
            },
          },
        },
      },
    })
    if (!article) throw new NotFoundException('AI reading article not found')
    return {
      ...article,
      notes: article.notes.map((item) => ({
        id: item.id,
        noteId: item.noteId,
        noteContent: item.note?.content ?? item.noteContent,
        noteTranslation: item.note?.translation ?? item.noteTranslation,
        noteCategory: item.note?.category ?? item.noteCategory,
        expression: item.expression,
        isVariant: item.isVariant,
        explanation: item.explanation,
      })),
    }
  }

  async deleteArticle(id: string) {
    const article = await this.prisma.aiReadingArticle.findUnique({
      where: { id },
      select: { id: true, batchId: true },
    })
    if (!article) throw new NotFoundException('AI reading article not found')
    await this.prisma.aiReadingArticle.delete({ where: { id } })
    await this.refreshBatchCounters(article.batchId)
    return { ok: true }
  }

  private normalizeRange(raw: string): CreateReadingReviewBatchDto['range'] {
    return raw === 'wrong' || raw === 'exclude_mastered' || raw === 'new_only' ? raw : 'all'
  }

  private async findNotePool(dto: Pick<CreateReadingReviewBatchDto, 'source' | 'range' | 'categories'>) {
    const noteWhere: Prisma.NoteWhereInput = {
      deletedAt: null,
      ...(dto.categories?.length ? { category: { in: dto.categories } } : {}),
      ...(dto.range === 'wrong' ? { wrongCount: { gt: 0 } } : {}),
      ...(dto.range === 'exclude_mastered' ? { reviewStatus: { not: 'mastered' } } : {}),
      ...(dto.range === 'new_only' ? { reviewStatus: 'new' } : {}),
      ...(dto.source === 'favorites' ? { favorites: { some: {} } } : {}),
    }

    return this.prisma.note.findMany({
      where: noteWhere,
      orderBy: { createdAt: 'asc' },
    })
  }

  private async runBatch(
    batchId: string,
    notes: Note[],
    dto: Pick<CreateReadingReviewBatchDto, 'source' | 'range' | 'categories' | 'articleTarget' | 'generateAll' | 'timeoutSeconds'>,
    targetTotalArticles?: number,
    modelId?: string,
  ) {
    const startedAt = new Date()
    const timeoutSeconds = this.normalizeTimeoutSeconds(dto.timeoutSeconds)
    const deadline = startedAt.getTime() + timeoutSeconds * 1000
    let remaining = [...notes]
    let consecutiveFailures = 0
    const maxArticles = dto.generateAll ? Number.POSITIVE_INFINITY : targetTotalArticles ?? dto.articleTarget ?? DEFAULT_ARTICLE_TARGET
    const abortController = new AbortController()
    this.batchAbortControllers.set(batchId, abortController)

    try {
      if (modelId) {
        this.logger.log(`AI reading batch ${batchId} using model: ${modelId}`)
      }
      await this.prisma.aiReadingReviewBatch.update({
        where: { id: batchId },
        data: { status: 'running', startedAt },
      })

      while (remaining.length > 0 && (await this.countBatchArticles(batchId)) < maxArticles) {
      if (deadline !== null && Date.now() > deadline) {
        await this.finishBatch(batchId, 'completed')
        return
      }
      const current = await this.prisma.aiReadingReviewBatch.findUnique({
        where: { id: batchId },
        select: { status: true },
      })
      if (!current || current.status === 'cancelled') return
      if (dto.generateAll && remaining.length < MIN_NOTES_PER_ARTICLE && (await this.countBatchArticles(batchId)) > 0) {
        break
      }

      const candidates = remaining.slice(0, CANDIDATE_NOTES_PER_ARTICLE)
      try {
        const generationStart = Date.now()
        const parsed = await this.generateReadingArticle(candidates, modelId, abortController.signal)
        if (await this.isBatchCancelled(batchId)) return
        const saved = await this.saveArticle(batchId, remaining, parsed, Date.now() - generationStart)
        remaining = remaining.filter((note) => !saved.usedNoteIds.has(note.id))
        consecutiveFailures = 0
      } catch (err) {
        if (await this.isBatchCancelled(batchId)) return
        consecutiveFailures += 1
        const errorMessage = this.formatGenerationError(err)
        this.logger.warn(`AI reading article generation failed: ${errorMessage}`)
        await this.prisma.aiReadingReviewBatch.update({
          where: { id: batchId },
          data: {
            failedArticles: { increment: 1 },
            errorMessage,
          },
        })
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          await this.finishBatch(batchId, (await this.countBatchArticles(batchId)) > 0 ? 'completed' : 'failed')
          return
        }
      }
    }

      const status = (await this.countBatchArticles(batchId)) > 0 ? 'completed' : 'failed'
      await this.finishBatch(batchId, status)
    } finally {
      if (this.batchAbortControllers.get(batchId) === abortController) {
        this.batchAbortControllers.delete(batchId)
      }
    }
  }

  private async saveArticle(
    batchId: string,
    remainingNotes: Note[],
    parsed: ParsedReadingArticle,
    generationMs: number,
  ) {
    const available = new Map(remainingNotes.map((note) => [note.id, note]))
    const validUsedNotes = parsed.usedNotes.length > 0
      ? parsed.usedNotes.filter((item) => available.has(item.noteId))
      : inferUsedNotesFromArticle(remainingNotes, parsed.article)
    if (validUsedNotes.length === 0) {
      throw new Error('AI did not use any available notes')
    }
    const usedNoteIds = new Set(validUsedNotes.map((item) => item.noteId))
    const actualWordCount = parsed.wordCount || countEnglishWords(parsed.article)
    const qualityWarnings = this.buildQualityWarnings(parsed, validUsedNotes.length, actualWordCount)

    const article = await this.prisma.$transaction(async (tx) => {
      const created = await tx.aiReadingArticle.create({
        data: {
          batchId,
          title: parsed.title,
          article: parsed.article,
          paragraphTranslations: parsed.paragraphTranslations as unknown as Prisma.InputJsonValue,
          wordCount: actualWordCount,
          questions: parsed.questions as unknown as Prisma.InputJsonValue,
          answers: parsed.answers as unknown as Prisma.InputJsonValue,
          explanations: parsed.explanations as unknown as Prisma.InputJsonValue,
          generationMs,
          qualityWarnings,
        },
      })
      await tx.aiReadingArticleNote.createMany({
        data: validUsedNotes.map((item) => {
          const note = available.get(item.noteId)
          if (!note) throw new Error('Used note disappeared from pool')
          return {
            articleId: created.id,
            noteId: note.id,
            noteContent: note.content,
            noteTranslation: note.translation,
            noteCategory: note.category,
            expression: item.expression,
            isVariant: item.isVariant,
            explanation: item.explanation ?? null,
          }
        }),
      })
      await tx.aiReadingReviewBatch.update({
        where: { id: batchId },
        data: {
          generatedArticles: { increment: 1 },
          usedNotes: { increment: validUsedNotes.length },
        },
      })
      return created
    })

    return { article, usedNoteIds }
  }

  private buildQualityWarnings(
    parsed: ParsedReadingArticle,
    usedNoteCount: number,
    wordCount: number,
  ) {
    const warnings: string[] = []
    if (wordCount < 900) warnings.push('文章低于 900 词')
    if (wordCount > 1500) warnings.push('文章高于 1500 词')
    if (usedNoteCount < MIN_NOTES_PER_ARTICLE) warnings.push('使用笔记少于 50 条')
    if (parsed.paragraphTranslations.length === 0) {
      warnings.push('缺少中文段落翻译')
    } else if (parsed.paragraphTranslations.some((item) => !hasChineseText(item))) {
      warnings.push('存在非中文段落翻译')
    }
    return warnings
  }

  private async generateReadingArticle(
    candidates: Note[],
    modelId: string | undefined,
    signal: AbortSignal,
  ): Promise<ParsedReadingArticle> {
    const articleRaw = await this.completeReadingReviewWithRetry({
      messages: [{ role: 'user', content: this.buildArticlePrompt(candidates) }],
      model: modelId,
      signal,
    })
    const parsed = parseReadingArticlePayload(articleRaw)
    if (!parsed) throw new Error('AI returned invalid reading article JSON')

    if (parsed.paragraphTranslations.length === 0) {
      const translationRaw = await this.completeReadingReviewWithRetry({
        messages: [{ role: 'user', content: this.buildTranslationPrompt(parsed.article) }],
        model: modelId,
        signal,
      })
      parsed.paragraphTranslations = parseParagraphTranslationsPayload(translationRaw)
    }
    return parsed
  }

  private async completeReadingReviewWithRetry(dto: {
    messages: Array<{ role: string; content: string }>
    model?: string
    signal?: AbortSignal
  }) {
    let lastError: unknown
    for (let attempt = 0; attempt < ARTICLE_AI_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.aiService.complete({
          ...dto,
          slot: 'readingReview',
          timeoutMs: this.singleArticleTimeoutMs(),
          stream: true,
        })
      } catch (err) {
        lastError = err
        const canRetry = attempt < ARTICLE_AI_MAX_ATTEMPTS - 1 && this.isTransientAiError(err)
        this.logger.warn(
          `AI reading completion attempt ${attempt + 1}/${ARTICLE_AI_MAX_ATTEMPTS} failed: ${this.formatGenerationError(err)}`,
        )
        if (!canRetry) break
        await this.waitMs(ARTICLE_AI_RETRY_BASE_MS * (attempt + 1))
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  private isTransientAiError(err: unknown) {
    const message = this.formatGenerationError(err).toLowerCase()
    return /terminated|fetch failed|stream error|network error|idle timeout|econnreset|socket hang up|etimedout|aborted prematurely|timeouterror/.test(message)
  }

  private formatGenerationError(err: unknown) {
    if (err instanceof Error) {
      const response = err as Error & { response?: { message?: string | string[] } }
      if (Array.isArray(response.response?.message)) {
        return response.response.message.join('; ')
      }
      if (typeof response.response?.message === 'string') {
        return response.response.message
      }
      const causeValue = (err as Error & { cause?: unknown }).cause
      const cause = causeValue !== undefined ? ` | cause: ${String(causeValue)}` : ''
      return `${err.message}${cause}`
    }
    return String(err)
  }

  private waitMs(ms: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  private buildArticlePrompt(candidates: Note[]) {
    const noteJson = JSON.stringify(
      candidates.map((note) => ({
        id: note.id,
        content: note.content,
      })),
    )
    return `你是一位专业 IELTS Reading 出题人与英文学术写作者。请基于候选英文笔记，动态挑选能够自然融入同一篇文章的笔记，生成一篇国外期刊/雅思阅读风格的英文文章。

要求：
1. 文章必须为英文，目标 900-1500 words。
2. 尽量原样使用至少 50 条候选笔记中的英文表达；后端会在文章正文中自动匹配这些表达。
3. 若笔记是「词A = 词B」形式的同义替换，只能自然使用词A或词B之一嵌入文章，禁止把「词A = 词B」整串照抄进正文。
4. 当原笔记用词在语境中不自然时，可使用其同义形式；后端会把实际使用的词标注为变体并关联原笔记。
5. 只返回一个合法 JSON 对象，不要 Markdown，不要解释文字。

候选笔记：
${noteJson}

返回 JSON 结构：
{
  "title": "英文标题",
  "article": "900-1500 words English article, with paragraphs separated by blank lines",
  "wordCount": 1000
}`
  }

  private buildTranslationPrompt(article: string) {
    return `请将以下英文学术文章按段落顺序翻译为中文。英文段落以空行分隔，一段英文对应一条中文翻译。

要求：
1. paragraphTranslations 数组长度必须与英文段落数一致。
2. 只返回一个合法 JSON 对象，不要 Markdown，不要解释文字。

英文文章：
${article}

返回 JSON 结构：
{
  "paragraphTranslations": ["第一段中文翻译", "第二段中文翻译"]
}`
  }

  private normalizeTimeoutSeconds(timeoutSeconds?: number) {
    return timeoutSeconds && timeoutSeconds > 0 ? timeoutSeconds : VERY_LONG_TIMEOUT_SECONDS
  }

  private singleArticleTimeoutMs() {
    return SINGLE_ARTICLE_TIMEOUT_MS
  }

  private async finishBatch(batchId: string, status: 'completed' | 'failed') {
    await this.prisma.aiReadingReviewBatch.updateMany({
      where: { id: batchId, status: { not: 'cancelled' } },
      data: { status, endedAt: new Date() },
    })
  }

  private async isBatchCancelled(batchId: string) {
    const batch = await this.prisma.aiReadingReviewBatch.findUnique({
      where: { id: batchId },
      select: { status: true },
    })
    return !batch || batch.status === 'cancelled'
  }

  private async refreshBatchCounters(batchId: string) {
    const articles = await this.prisma.aiReadingArticle.findMany({
      where: { batchId },
      select: { id: true, _count: { select: { notes: true } } },
    })
    await this.prisma.aiReadingReviewBatch.update({
      where: { id: batchId },
      data: {
        generatedArticles: articles.length,
        usedNotes: articles.reduce((sum, article) => sum + article._count.notes, 0),
      },
    })
  }

  private async countBatchArticles(batchId: string) {
    return this.prisma.aiReadingArticle.count({ where: { batchId } })
  }

  private async ensureBatch(id: string) {
    const batch = await this.prisma.aiReadingReviewBatch.findUnique({ where: { id } })
    if (!batch) throw new NotFoundException('AI reading batch not found')
    return batch
  }

  private articleSummarySelect() {
    return {
      id: true,
      title: true,
      wordCount: true,
      status: true,
      generationMs: true,
      qualityWarnings: true,
      createdAt: true,
      _count: { select: { notes: true } },
    } satisfies Prisma.AiReadingArticleSelect
  }
}

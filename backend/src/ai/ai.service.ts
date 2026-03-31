import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'
import { AddModelDto } from './dto/add-model.dto'
import { ChatDto } from './dto/chat.dto'
import { CreateProviderDto } from './dto/create-provider.dto'
import { UpdateProviderDto } from './dto/update-provider.dto'

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  // ── Providers ────────────────────────────────────────────────────────────

  async listProviders() {
    const providers = await this.prisma.aiProvider.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { models: { orderBy: { sortOrder: 'asc' } } },
    })
    return { items: providers }
  }

  async createProvider(dto: CreateProviderDto) {
    const count = await this.prisma.aiProvider.count()
    return this.prisma.aiProvider.create({
      data: {
        name: dto.name,
        displayName: dto.displayName,
        presetId: dto.presetId,
        color: dto.color,
        baseUrl: dto.baseUrl,
        apiKey: dto.apiKey ?? '',
        sortOrder: count,
      },
      include: { models: true },
    })
  }

  async updateProvider(id: string, dto: UpdateProviderDto) {
    await this.ensureProvider(id)
    const data: Record<string, string> = {}
    if (dto.displayName !== undefined) data.displayName = dto.displayName
    if (dto.baseUrl !== undefined) data.baseUrl = dto.baseUrl
    if (dto.apiKey !== undefined) data.apiKey = dto.apiKey
    if (dto.color !== undefined) data.color = dto.color
    return this.prisma.aiProvider.update({
      where: { id },
      data,
      include: { models: { orderBy: { sortOrder: 'asc' } } },
    })
  }

  async deleteProvider(id: string) {
    await this.ensureProvider(id)
    return this.prisma.aiProvider.delete({ where: { id } })
  }

  // ── Models ───────────────────────────────────────────────────────────────

  async addModel(providerId: string, dto: AddModelDto) {
    await this.ensureProvider(providerId)
    const count = await this.prisma.aiModel.count({ where: { providerId } })
    return this.prisma.aiModel.create({
      data: { providerId, modelId: dto.modelId, sortOrder: count },
    })
  }

  async removeModel(providerId: string, modelId: string) {
    const row = await this.prisma.aiModel.findFirst({
      where: { providerId, modelId },
    })
    if (!row) throw new NotFoundException('Model not found')
    return this.prisma.aiModel.delete({ where: { id: row.id } })
  }

  async setModelVerified(providerId: string, modelId: string, verified: boolean) {
    const row = await this.prisma.aiModel.findFirst({
      where: { providerId, modelId },
    })
    if (!row) throw new NotFoundException('Model not found')
    return this.prisma.aiModel.update({ where: { id: row.id }, data: { verified } })
  }

  async updateModel(providerId: string, modelId: string, data: { verified?: boolean; isThinking?: boolean; isVision?: boolean }) {
    const row = await this.prisma.aiModel.findFirst({ where: { providerId, modelId } })
    if (!row) throw new NotFoundException('Model not found')
    return this.prisma.aiModel.update({ where: { id: row.id }, data })
  }

  // ── Tool definitions ─────────────────────────────────────────────────────

  private readonly TOOLS = [
    {
      type: 'function',
      function: {
        name: 'search_notes',
        description: '搜索用户的 IELTS 笔记库，可按关键词、分类、掌握状态过滤，可按错误次数/时间排序',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词（英文或中文均可）' },
            category: { type: 'string', description: '分类过滤', enum: ['口语', '短语', '句子', '同义替换', '拼写', '单词', '写作'] },
            status: { type: 'string', description: '掌握状态', enum: ['new', 'learning', 'mastered'] },
            sortBy: { type: 'string', description: '排序方式', enum: ['createdAt', 'wrongCount', 'reviewCount'] },
            limit: { type: 'number', description: '返回条数，默认 5，最大 20' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_stats',
        description: '获取笔记库统计信息：总数、各分类数量、掌握程度（new/learning/mastered）分布',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_weak_notes',
        description: '获取最需要复习的笔记（错误次数多或从未复习的）',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: '返回条数，默认 5' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_recent_notes',
        description: '获取最近添加的笔记',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: '返回条数，默认 5' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_favorites',
        description: '获取用户收藏的笔记',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: '返回条数，默认 5' },
          },
        },
      },
    },
  ]

  // ── Tool implementations ──────────────────────────────────────────────────

  private async toolSearchNotes(args: {
    query?: string; category?: string; status?: string
    sortBy?: 'createdAt' | 'wrongCount' | 'reviewCount'; limit?: number
  }) {
    const where: Record<string, unknown> = { deletedAt: null }
    if (args.category) where.category = args.category
    if (args.status) where.reviewStatus = args.status
    if (args.query) {
      where.OR = [
        { content: { contains: args.query, mode: 'insensitive' } },
        { translation: { contains: args.query, mode: 'insensitive' } },
      ]
    }
    const orderBy =
      args.sortBy === 'wrongCount' ? { wrongCount: 'desc' as const }
      : args.sortBy === 'reviewCount' ? { reviewCount: 'desc' as const }
      : { createdAt: 'desc' as const }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notes = await this.prisma.note.findMany({
      where: where as any,
      select: { id: true, content: true, translation: true, category: true, reviewStatus: true, wrongCount: true, correctCount: true, reviewCount: true },
      take: Math.min(args.limit ?? 5, 20),
      orderBy,
    })
    return { notes, count: notes.length }
  }

  private async toolGetStats() {
    const [byCat, byStatus] = await Promise.all([
      this.prisma.note.groupBy({ by: ['category'], where: { deletedAt: null }, _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
      this.prisma.note.groupBy({ by: ['reviewStatus'], where: { deletedAt: null }, _count: { id: true } }),
    ])
    const total = byCat.reduce((s, r) => s + r._count.id, 0)
    return {
      total,
      byCategory: byCat.map((r) => ({ category: r.category, count: r._count.id })),
      byStatus: byStatus.map((r) => ({ status: r.reviewStatus, count: r._count.id })),
    }
  }

  private async toolGetWeakNotes(limit: number) {
    const notes = await this.prisma.note.findMany({
      where: { deletedAt: null, OR: [{ wrongCount: { gt: 0 } }, { reviewStatus: 'new' }] },
      select: { id: true, content: true, translation: true, category: true, reviewStatus: true, wrongCount: true, correctCount: true, reviewCount: true },
      take: Math.min(limit, 20),
      orderBy: [{ wrongCount: 'desc' }, { reviewCount: 'asc' }],
    })
    return { notes, count: notes.length }
  }

  private async toolGetRecentNotes(limit: number) {
    const notes = await this.prisma.note.findMany({
      where: { deletedAt: null },
      select: { id: true, content: true, translation: true, category: true, reviewStatus: true, createdAt: true },
      take: Math.min(limit, 20),
      orderBy: { createdAt: 'desc' },
    })
    return { notes, count: notes.length }
  }

  private async toolGetFavorites(limit: number) {
    const favs = await this.prisma.favorite.findMany({
      include: { note: { select: { id: true, content: true, translation: true, category: true, reviewStatus: true, deletedAt: true } } },
      take: Math.min(limit, 20),
      orderBy: { createdAt: 'desc' },
    })
    const notes = favs.filter((f) => !f.note.deletedAt).map((f) => f.note)
    return { notes, count: notes.length }
  }

  private async executeTool(name: string, args: Record<string, unknown>) {
    switch (name) {
      case 'search_notes': return this.toolSearchNotes(args as Parameters<typeof this.toolSearchNotes>[0])
      case 'get_stats':    return this.toolGetStats()
      case 'get_weak_notes': return this.toolGetWeakNotes((args.limit as number) ?? 5)
      case 'get_recent_notes': return this.toolGetRecentNotes((args.limit as number) ?? 5)
      case 'get_favorites': return this.toolGetFavorites((args.limit as number) ?? 5)
      default: return { error: `Unknown tool: ${name}` }
    }
  }

  // ── Chat with Function Calling ────────────────────────────────────────────

  async chat(dto: ChatDto) {
    const { provider, model } = await this.resolveProviderAndModel(dto)

    if (!provider.apiKey) {
      throw new BadRequestException(
        `Provider "${provider.displayName}" has no API key configured`,
      )
    }

    type NoteRef = { id: string; content: string; translation: string; category: string }
    const referencedNotes: NoteRef[] = []
    const seenNoteIds = new Set<string>()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loopMessages: any[] = [...dto.messages]

    const baseUrl = provider.baseUrl.replace(/\/$/, '')
    const url = `${baseUrl}/chat/completions`

    // Tool call loop — max 6 iterations to prevent infinite loops
    for (let iter = 0; iter < 6; iter++) {
      const apiBody: Record<string, unknown> = {
        model,
        messages: loopMessages,
        tools: this.TOOLS,
        // NOTE: do NOT send tool_choice — many OpenAI-compatible proxies reject it
        stream: false,
      }

      // reasoning_effort for o1/o3-style thinking models
      if (dto.enableThinking) {
        apiBody.reasoning_effort = 'medium'
      }

      let res: Response
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
          body: JSON.stringify(apiBody),
        })
      } catch (err) {
        throw new BadRequestException(`Network error: ${String(err)}`)
      }

      if (!res.ok) {
        const text = await res.text().catch(() => 'unknown error')
        throw new BadRequestException(`Provider returned ${res.status}: ${text}`)
      }

      const json = (await res.json()) as {
        choices?: {
          finish_reason?: string
          message?: {
            role: string; content: string | null
            tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[]
          }
        }[]
      }

      const choice = json.choices?.[0]
      if (!choice?.message) break

      const { finish_reason, message } = choice

      // ── Model returned a final text response ───────────────────────────────
      if (finish_reason !== 'tool_calls' || !message.tool_calls?.length) {
        return { content: message.content ?? '', model, provider: provider.displayName, referencedNotes }
      }

      // ── Model wants to call tools ──────────────────────────────────────────
      // Push ONLY the standard OpenAI fields — strip reasoning_content and any
      // other non-standard fields that the provider returns but rejects on input.
      // Also ensure tool_calls.function.arguments is always a string (some
      // proxies omit it for no-arg tools; the API rejects it on re-send).
      loopMessages.push({
        role: message.role,
        content: message.content ?? null,
        tool_calls: message.tool_calls?.map((tc) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments ?? '{}',
          },
        })),
      })

      for (const toolCall of message.tool_calls) {
        let args: Record<string, unknown> = {}
        try { args = JSON.parse(toolCall.function.arguments) } catch { /* ignore */ }

        const result = await this.executeTool(toolCall.function.name, args)

        // Collect referenced notes for the UI
        if (result && typeof result === 'object' && Array.isArray((result as { notes?: unknown[] }).notes)) {
          for (const n of (result as { notes: NoteRef[] }).notes) {
            if (n.id && !seenNoteIds.has(n.id)) {
              seenNoteIds.add(n.id)
              referencedNotes.push({ id: n.id, content: n.content, translation: n.translation, category: n.category })
            }
          }
        }

        loopMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        })
      }
      // continue loop → send tool results back to model
    }

    return { content: '（处理超时，请重试）', model, provider: provider.displayName, referencedNotes }
  }

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

    let res: Response
    try {
      res = await fetch(url, {
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
    } catch (err) {
      throw new BadRequestException(`Network error: ${String(err)}`)
    }

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown error')
      throw new BadRequestException(`Provider returned ${res.status}: ${text}`)
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    return json.choices?.[0]?.message?.content ?? ''
  }

  // ── Test single model ────────────────────────────────────────────────────

  async testModel(providerId: string, modelId: string) {
    const provider = await this.ensureProvider(providerId)

    if (!provider.apiKey) {
      return { ok: false, error: 'No API key configured' }
    }

    const baseUrl = provider.baseUrl.replace(/\/$/, '')
    const url = `${baseUrl}/chat/completions`

    // 15-second timeout — avoid hanging on slow or unreachable models
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)

    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        // No max_tokens — let the provider use its default.
        // Thinking/reasoning models often have a minimum token budget;
        // setting an explicit low value (e.g. 5) causes them to reject the request.
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Hi' }],
          stream: false,
        }),
      })
      clearTimeout(timer)

      if (res.ok) {
        // Best-effort: mark verified if the model row exists in DB
        await this.setModelVerified(providerId, modelId, true).catch(() => null)
        return { ok: true }
      }

      const text = await res.text().catch(() => '')
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    } catch (err) {
      clearTimeout(timer)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('abort') || msg.includes('Abort')) {
        return { ok: false, error: 'Request timeout (15s) — model may be slow or unreachable' }
      }
      return { ok: false, error: msg }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async ensureProvider(id: string) {
    const p = await this.prisma.aiProvider.findUnique({
      where: { id },
      include: { models: true },
    })
    if (!p) throw new NotFoundException('AiProvider not found')
    return p
  }

  private async resolveProviderAndModel(dto: ChatDto) {
    if (dto.model) {
      const m = await this.prisma.aiModel.findFirst({
        where: { modelId: dto.model },
        include: { provider: true },
      })
      if (m) return { provider: m.provider, model: dto.model }
    }

    const allSettings = await this.settings.getAll()
    const slotKey = dto.slot ? `${dto.slot}Model` : 'chatModel'
    const defaultModelId = allSettings[slotKey]

    if (defaultModelId) {
      const m = await this.prisma.aiModel.findFirst({
        where: { modelId: defaultModelId },
        include: { provider: true },
      })
      if (m) return { provider: m.provider, model: defaultModelId }
    }

    const first = await this.prisma.aiProvider.findFirst({
      orderBy: { sortOrder: 'asc' },
      include: { models: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    })
    if (!first || first.models.length === 0) {
      throw new BadRequestException('No AI provider configured')
    }
    return { provider: first, model: first.models[0].modelId }
  }
}

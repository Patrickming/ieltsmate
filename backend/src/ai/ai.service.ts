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

  // ── Chat proxy ───────────────────────────────────────────────────────────

  async chat(dto: ChatDto) {
    const { provider, model } = await this.resolveProviderAndModel(dto)

    if (!provider.apiKey) {
      throw new BadRequestException(
        `Provider "${provider.displayName}" has no API key configured`,
      )
    }

    const baseUrl = provider.baseUrl.replace(/\/$/, '')
    const url = `${baseUrl}/chat/completions`

    const body = JSON.stringify({
      model,
      messages: dto.messages,
      stream: false,
    })

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body,
      })
    } catch (err) {
      throw new BadRequestException(`Network error calling provider: ${String(err)}`)
    }

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown error')
      throw new BadRequestException(`Provider returned ${res.status}: ${text}`)
    }

    const json = (await res.json()) as {
      choices?: { message?: { role: string; content: string } }[]
    }

    const content = json.choices?.[0]?.message?.content ?? ''
    return { content, model, provider: provider.displayName }
  }

  // ── Test single model ────────────────────────────────────────────────────

  async testModel(providerId: string, modelId: string) {
    const provider = await this.ensureProvider(providerId)

    if (!provider.apiKey) {
      return { ok: false, error: 'No API key configured' }
    }

    const baseUrl = provider.baseUrl.replace(/\/$/, '')
    const url = `${baseUrl}/chat/completions`

    try {
      const res = await fetch(url, {
        method: 'POST',
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

      if (res.ok) {
        // Best-effort: mark verified if the model row exists in DB
        await this.setModelVerified(providerId, modelId, true).catch(() => null)
        return { ok: true }
      }

      const text = await res.text().catch(() => '')
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    } catch (err) {
      return { ok: false, error: String(err) }
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

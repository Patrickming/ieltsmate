import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { AiService } from '../ai/ai.service'
import { FreeDictionaryApiService } from '../dictionary/free-dictionary-api.service'
import { PrismaService } from '../prisma/prisma.service'
import { CreateNoteDto } from './dto/create-note.dto'
import { CreateUserNoteDto } from './dto/create-user-note.dto'
import { UpdateNoteDto } from './dto/update-note.dto'
import { UpdateUserNoteDto } from './dto/update-user-note.dto'
import { NoteUserImageStorage } from './note-user-image.storage'
import { normalizeConfusableGroups, normalizePartOfSpeechList } from './types/note-extensions'
import { normalizeWordFamily } from './types/word-family'

const noteInclude = {
  userNotes: {
    where: { deletedAt: null },
    select: { content: true },
  },
} satisfies Prisma.NoteInclude
const MAX_USER_NOTE_IMAGES = 10

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly noteUserImageStorage: NoteUserImageStorage,
    private readonly dictionary: FreeDictionaryApiService,
    private readonly aiService: AiService,
  ) {}

  /**
   * 词典无音标时用 AI 生成英式 IPA，并写回笔记（不覆盖已有发音 URL）。
   */
  async ensurePhoneticForNote(noteId: string) {
    const note = await this.detail(noteId)
    const existingPhonetic = note.phonetic?.trim()
    if (existingPhonetic) {
      return {
        phonetic: existingPhonetic,
        audioUrl: note.pronunciationAudioUrl ?? null,
        source: 'note' as const,
      }
    }

    const uk = await this.dictionary.lookupBritishPronunciation(note.content)
    if (uk?.phonetic) {
      const updated = await this.persistBritishPronunciation(noteId, uk)
      return {
        phonetic: updated.phonetic,
        audioUrl: updated.pronunciationAudioUrl ?? null,
        source: 'dictionary' as const,
      }
    }

    const aiPhonetic = await this.generatePhoneticWithAi(note.content)
    if (!aiPhonetic) {
      throw new NotFoundException('词典与 AI 均未生成可用音标')
    }

    const updated = await this.prisma.note.update({
      where: { id: noteId },
      data: {
        phonetic: aiPhonetic,
        ...(uk?.audioUrl ? { pronunciationAudioUrl: uk.audioUrl } : {}),
      },
      include: noteInclude,
    })
    return {
      phonetic: updated.phonetic,
      audioUrl: updated.pronunciationAudioUrl ?? null,
      source: 'ai' as const,
    }
  }

  private wrapIpaPhonetic(text: string): string {
    const t = text.trim()
    if (!t) return ''
    if (t.startsWith('/') && t.endsWith('/')) return t
    return `/${t.replace(/^\/+|\/+$/g, '')}/`
  }

  private extractJsonCandidate(content: string): string {
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start >= 0 && end > start) return content.slice(start, end + 1)
    return content.trim()
  }

  private async generatePhoneticWithAi(word: string): Promise<string | null> {
    const w = word.trim()
    if (!w) return null
    try {
      const raw = await this.aiService.complete({
        messages: [
          {
            role: 'user',
            content:
              `单词: "${w}"\n请仅返回该词的英式英语 IPA 音标。JSON 格式：{"phonetic":"/音标/"}。只要 JSON，不要释义或其它字段。`,
          },
        ],
        slot: 'review',
        timeoutMs: 25_000,
      })
      const parsed = JSON.parse(this.extractJsonCandidate(raw)) as { phonetic?: unknown }
      const ph = typeof parsed.phonetic === 'string' ? parsed.phonetic.trim() : ''
      return ph ? this.wrapIpaPhonetic(ph) : null
    } catch (err) {
      this.logger.warn(
        `generatePhoneticWithAi failed word=${w}: ${err instanceof Error ? err.message : String(err)}`,
      )
      return null
    }
  }

  /**
   * 从词典拉取英式音标与发音并写入笔记（复习或手动同步时调用）。
   */
  async syncBritishPronunciation(noteId: string) {
    const note = await this.detail(noteId)
    const uk = await this.dictionary.lookupBritishPronunciation(note.content)
    if (!uk?.phonetic) {
      throw new NotFoundException('未找到该词的英式音标')
    }
    return this.persistBritishPronunciation(noteId, uk)
  }

  /** 复习生成后静默写回笔记，失败不阻断复习流程 */
  async saveBritishPronunciationToNote(noteId: string, lookupText: string): Promise<void> {
    try {
      const uk = await this.dictionary.lookupBritishPronunciation(lookupText)
      if (!uk?.phonetic) return
      await this.persistBritishPronunciation(noteId, uk)
    } catch (err) {
      this.logger.warn(
        `saveBritishPronunciationToNote failed noteId=${noteId}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private async persistBritishPronunciation(
    noteId: string,
    uk: { phonetic: string | null; audioUrl: string | null },
  ) {
    if (!uk.phonetic) {
      throw new NotFoundException('未找到该词的英式音标')
    }
    return this.prisma.note.update({
      where: { id: noteId },
      data: {
        phonetic: uk.phonetic,
        pronunciationAudioUrl: uk.audioUrl ?? null,
      },
      include: noteInclude,
    })
  }

  async create(dto: CreateNoteDto) {
    const normalizedSynonyms =
      dto.synonyms !== undefined ? [...new Set(dto.synonyms.map((s) => s.trim()).filter(Boolean))] : []
    const normalizedAntonyms =
      dto.antonyms !== undefined ? [...new Set(dto.antonyms.map((s) => s.trim()).filter(Boolean))] : []

    return this.prisma.note.create({
      data: {
        content: dto.content,
        translation: dto.translation,
        category: dto.category,
        phonetic: dto.phonetic,
        pronunciationAudioUrl: dto.pronunciationAudioUrl,
        synonyms: normalizedSynonyms,
        antonyms: normalizedAntonyms,
        example: dto.example,
        memoryTip: dto.memoryTip,
        ...(dto.reviewStatus !== undefined ? { reviewStatus: dto.reviewStatus } : {}),
        ...(dto.partsOfSpeech !== undefined && Array.isArray(dto.partsOfSpeech)
          ? {
              partsOfSpeech: normalizePartOfSpeechList(dto.partsOfSpeech) as unknown as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.confusables !== undefined && Array.isArray(dto.confusables)
          ? {
              confusables: normalizeConfusableGroups(dto.confusables) as unknown as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.wordFamily !== undefined && dto.wordFamily !== null && typeof dto.wordFamily === 'object'
          ? (() => {
              const wf = normalizeWordFamily(dto.wordFamily)
              return wf ? { wordFamily: wf as unknown as Prisma.InputJsonValue } : {}
            })()
          : {}),
      },
      include: noteInclude,
    })
  }

  async list(filters: { category?: string; search?: string }) {
    const where: Prisma.NoteWhereInput = {
      deletedAt: null,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.search
        ? {
            OR: [
              { content: { contains: filters.search, mode: 'insensitive' } },
              { translation: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const items = await this.prisma.note.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: noteInclude,
    })

    return { items }
  }

  async detail(id: string) {
    const note = await this.prisma.note.findFirst({
      where: { id, deletedAt: null },
      include: noteInclude,
    })
    if (!note) {
      throw new NotFoundException('Note not found')
    }
    return note
  }

  async update(id: string, dto: UpdateNoteDto) {
    await this.ensureActive(id)

    const data: Prisma.NoteUpdateInput = {}
    if (dto.content !== undefined) data.content = dto.content
    if (dto.translation !== undefined) data.translation = dto.translation
    if (dto.category !== undefined) data.category = dto.category
    if (dto.phonetic !== undefined) data.phonetic = dto.phonetic
    if (dto.pronunciationAudioUrl !== undefined) {
      data.pronunciationAudioUrl = dto.pronunciationAudioUrl
    }
    if (dto.synonyms !== undefined) data.synonyms = [...new Set(dto.synonyms.map((s) => s.trim()).filter(Boolean))]
    if (dto.antonyms !== undefined) data.antonyms = [...new Set(dto.antonyms.map((s) => s.trim()).filter(Boolean))]
    if (dto.example !== undefined) data.example = dto.example
    if (dto.memoryTip !== undefined) data.memoryTip = dto.memoryTip
    if (dto.reviewStatus !== undefined) data.reviewStatus = dto.reviewStatus
    if (dto.partsOfSpeech !== undefined && Array.isArray(dto.partsOfSpeech)) {
      data.partsOfSpeech = normalizePartOfSpeechList(dto.partsOfSpeech) as unknown as Prisma.InputJsonValue
    }
    if (dto.confusables !== undefined && Array.isArray(dto.confusables)) {
      data.confusables = normalizeConfusableGroups(dto.confusables) as unknown as Prisma.InputJsonValue
    }
    if (dto.wordFamily !== undefined && dto.wordFamily !== null && typeof dto.wordFamily === 'object') {
      const wf = normalizeWordFamily(dto.wordFamily)
      if (wf) {
        data.wordFamily = wf as unknown as Prisma.InputJsonValue
      }
    }

    if (Object.keys(data).length === 0) {
      return this.detail(id)
    }

    return this.prisma.note.update({
      where: { id },
      data,
      include: noteInclude,
    })
  }

  async softDelete(id: string) {
    const deletedAt = new Date()
    const { note, images } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.note.findFirst({
        where: { id, deletedAt: null },
        select: {
          id: true,
          userNotes: {
            where: { deletedAt: null },
            select: { images: true },
          },
        },
      })
      if (!existing) {
        throw new NotFoundException('Note not found')
      }

      await tx.noteUserNote.updateMany({
        where: { noteId: id, deletedAt: null },
        data: { deletedAt },
      })
      const note = await tx.note.update({
        where: { id },
        data: { deletedAt },
      })

      return {
        note,
        images: existing.userNotes.flatMap((userNote) => userNote.images),
      }
    })

    if (images.length > 0) {
      try {
        await this.noteUserImageStorage.removeMany([...new Set(images)])
      } catch (error) {
        this.logger.warn(`清理已删除笔记备注图片失败: noteId=${id} error=${this.describeError(error)}`)
      }
    }

    return note
  }

  async listUserNotes(noteId: string) {
    await this.ensureActive(noteId)
    const items = await this.prisma.noteUserNote.findMany({
      where: { noteId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    return { items }
  }

  async createUserNote(noteId: string, dto: CreateUserNoteDto, files: Express.Multer.File[]) {
    await this.ensureActive(noteId)
    const content = (dto.content ?? '').trim()
    const images = await this.noteUserImageStorage.saveMany(files)
    if (!content && images.length === 0) {
      await this.noteUserImageStorage.removeMany(images)
      throw new BadRequestException('备注内容和图片不能同时为空')
    }

    try {
      return await this.prisma.noteUserNote.create({
        data: { noteId, content, images },
      })
    } catch (error) {
      await this.noteUserImageStorage.removeMany(images)
      throw error
    }
  }

  async updateUserNote(
    noteId: string,
    userNoteId: string,
    dto: UpdateUserNoteDto,
    files: Express.Multer.File[],
  ) {
    await this.ensureActive(noteId)
    const existing = await this.prisma.noteUserNote.findFirst({
      where: { id: userNoteId, noteId, deletedAt: null },
    })
    if (!existing) {
      throw new NotFoundException('User note not found')
    }

    const keepImages = this.parseKeepImages(dto.keepImages, existing.images)
    const addedImages = await this.noteUserImageStorage.saveMany(files)
    const nextImages = [...keepImages, ...addedImages]
    const content = (dto.content ?? existing.content ?? '').trim()

    if (nextImages.length > MAX_USER_NOTE_IMAGES) {
      await this.noteUserImageStorage.removeMany(addedImages)
      throw new BadRequestException(`备注图片最多只能保留 ${MAX_USER_NOTE_IMAGES} 张`)
    }

    if (!content && nextImages.length === 0) {
      await this.noteUserImageStorage.removeMany(addedImages)
      throw new BadRequestException('备注内容和图片不能同时为空')
    }

    let updated: Awaited<ReturnType<PrismaService['noteUserNote']['update']>>
    try {
      updated = await this.prisma.noteUserNote.update({
        where: { id: userNoteId },
        data: { content, images: nextImages },
      })
    } catch (error) {
      await this.noteUserImageStorage.removeMany(addedImages)
      throw error
    }

    const removedImages = existing.images.filter((path) => !keepImages.includes(path))
    if (removedImages.length > 0) {
      try {
        await this.noteUserImageStorage.removeMany(removedImages)
      } catch (error) {
        this.logger.warn(
          `清理已移除备注图片失败: noteId=${noteId} userNoteId=${userNoteId} error=${this.describeError(error)}`,
        )
      }
    }

    return updated
  }

  async softDeleteUserNote(noteId: string, userNoteId: string) {
    await this.ensureActive(noteId)
    const existing = await this.prisma.noteUserNote.findFirst({
      where: { id: userNoteId, noteId, deletedAt: null },
    })
    if (!existing) {
      throw new NotFoundException('User note not found')
    }
    const deleted = await this.prisma.noteUserNote.update({
      where: { id: userNoteId },
      data: { deletedAt: new Date() },
    })

    try {
      await this.noteUserImageStorage.removeMany(existing.images)
    } catch (error) {
      this.logger.warn(
        `清理已删除备注图片失败: noteId=${noteId} userNoteId=${userNoteId} error=${this.describeError(error)}`,
      )
    }

    return deleted
  }

  private async ensureActive(id: string) {
    const note = await this.prisma.note.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    })
    if (!note) {
      throw new NotFoundException('Note not found')
    }
  }

  private parseKeepImages(rawKeepImages: string | undefined, existingImages: string[]) {
    if (rawKeepImages === undefined) {
      return existingImages
    }

    if (!rawKeepImages.trim()) {
      return []
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawKeepImages)
    } catch {
      throw new BadRequestException('keepImages must be a JSON string array')
    }

    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
      throw new BadRequestException('keepImages must be a JSON string array')
    }

    const requested = new Set(parsed)
    return existingImages.filter((path) => requested.has(path))
  }

  private describeError(error: unknown) {
    if (error instanceof Error) {
      return error.message
    }
    return String(error)
  }
}

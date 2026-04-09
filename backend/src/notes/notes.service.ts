import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateNoteDto } from './dto/create-note.dto'
import { CreateUserNoteDto } from './dto/create-user-note.dto'
import { UpdateNoteDto } from './dto/update-note.dto'
import { normalizeConfusableGroups, normalizePartOfSpeechList } from './types/note-extensions'

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

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
      },
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
    })

    return { items }
  }

  async detail(id: string) {
    const note = await this.prisma.note.findFirst({
      where: { id, deletedAt: null },
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

    if (Object.keys(data).length === 0) {
      return this.detail(id)
    }

    return this.prisma.note.update({
      where: { id },
      data,
    })
  }

  async softDelete(id: string) {
    await this.ensureActive(id)
    return this.prisma.note.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  async listUserNotes(noteId: string) {
    await this.ensureActive(noteId)
    const items = await this.prisma.noteUserNote.findMany({
      where: { noteId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    return { items }
  }

  async createUserNote(noteId: string, dto: CreateUserNoteDto) {
    await this.ensureActive(noteId)
    return this.prisma.noteUserNote.create({
      data: { noteId, content: dto.content },
    })
  }

  async softDeleteUserNote(noteId: string, userNoteId: string) {
    await this.ensureActive(noteId)
    const existing = await this.prisma.noteUserNote.findFirst({
      where: { id: userNoteId, noteId, deletedAt: null },
    })
    if (!existing) {
      throw new NotFoundException('User note not found')
    }
    return this.prisma.noteUserNote.update({
      where: { id: userNoteId },
      data: { deletedAt: new Date() },
    })
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
}

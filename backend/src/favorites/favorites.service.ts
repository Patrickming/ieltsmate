import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(search?: string) {
    const noteWhere: Prisma.NoteWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { content: { contains: search, mode: 'insensitive' } },
              { translation: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const rows = await this.prisma.favorite.findMany({
      where: { note: noteWhere },
      include: { note: true },
      orderBy: { createdAt: 'desc' },
    })

    return { items: rows.map((r) => r.note) }
  }

  async toggle(noteId: string): Promise<{ noteId: string; isFavorite: boolean }> {
    await this.ensureActiveNote(noteId)

    const existing = await this.prisma.favorite.findUnique({
      where: { noteId },
    })

    if (existing) {
      await this.prisma.favorite.deleteMany({ where: { noteId } })
      return { noteId, isFavorite: false }
    }

    try {
      await this.prisma.favorite.create({ data: { noteId } })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { noteId, isFavorite: true }
      }
      throw e
    }

    return { noteId, isFavorite: true }
  }

  private async ensureActiveNote(id: string) {
    const note = await this.prisma.note.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    })
    if (!note) {
      throw new NotFoundException('Note not found')
    }
  }
}

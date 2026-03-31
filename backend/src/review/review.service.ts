import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { StartReviewDto } from './dto/start-review.dto'
import { RateReviewDto } from './dto/rate-review.dto'

function shuffled<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async start(dto: StartReviewDto) {
    const noteWhere: Prisma.NoteWhereInput = {
      deletedAt: null,
      ...(dto.categories?.length ? { category: { in: dto.categories } } : {}),
      ...(dto.range === 'wrong' ? { wrongCount: { gt: 0 } } : {}),
      ...(dto.source === 'favorites' ? { favorites: { some: {} } } : {}),
    }

    const notes = await this.prisma.note.findMany({
      where: noteWhere,
      orderBy: { createdAt: 'desc' },
    })
    const cards = dto.mode === 'random' ? shuffled(notes) : notes

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.reviewSession.create({
        data: {
          sourceType: dto.source,
          rangeType: dto.range,
          modeType: dto.mode,
          totalCards: cards.length,
        },
      })

      if (cards.length > 0) {
        await tx.reviewSessionCard.createMany({
          data: cards.map((card, index) => ({
            sessionId: created.id,
            noteId: card.id,
            orderIndex: index,
            cardType: card.category,
          })),
        })
      }

      return created
    })

    return {
      sessionId: session.id,
      totalCards: cards.length,
      cards,
    }
  }

  async rate(sessionId: string, dto: RateReviewDto) {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.reviewSessionCard.findFirst({
        where: { sessionId, noteId: dto.noteId },
      })
      if (!card) throw new NotFoundException('Card not found in session')

      await tx.reviewSessionCard.update({
        where: { id: card.id },
        data: {
          isDone: true,
          rating: dto.rating,
          spellingAnswer: dto.spellingAnswer ?? null,
          answeredAt: new Date(),
        },
      })

      const note = await tx.note.findUniqueOrThrow({ where: { id: dto.noteId } })

      const isSpellingCorrect = dto.spellingAnswer
        ? dto.spellingAnswer.trim().toLowerCase() === note.content.trim().toLowerCase()
        : null

      await tx.reviewLog.create({
        data: {
          noteId: dto.noteId,
          sessionId,
          rating: dto.rating,
          spellingAnswer: dto.spellingAnswer ?? null,
          isSpellingCorrect,
        },
      })

      const newCorrect = note.correctCount + (dto.rating === 'easy' ? 1 : 0)
      const newWrong = note.wrongCount + (dto.rating === 'again' ? 1 : 0)

      let newStatus = note.reviewStatus
      if (note.reviewStatus === 'new') {
        newStatus = 'learning'
      }
      if (dto.rating === 'again') {
        newStatus = 'learning'
      } else if (dto.rating === 'easy' && newCorrect >= 3) {
        newStatus = 'mastered'
      }

      await tx.note.update({
        where: { id: dto.noteId },
        data: {
          reviewCount: { increment: 1 },
          correctCount: newCorrect,
          wrongCount: newWrong,
          reviewStatus: newStatus,
          lastReviewedAt: new Date(),
        },
      })

      return { ok: true }
    })
  }
}

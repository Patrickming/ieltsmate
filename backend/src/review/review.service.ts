import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { StartReviewDto } from './dto/start-review.dto'
import { RateReviewDto } from './dto/rate-review.dto'
import { todayCSTMidnight } from '../common/date.util'

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

    if (cards.length === 0) {
      throw new BadRequestException('No cards available for review with selected filters')
    }

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

  async end(sessionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.reviewSession.findUniqueOrThrow({
        where: { id: sessionId },
      })

      const cards = await tx.reviewSessionCard.findMany({
        where: { sessionId },
      })

      const ratedCards = cards.filter((c) => c.isDone)
      const easyCount = ratedCards.filter((c) => c.rating === 'easy').length
      const againCount = ratedCards.filter((c) => c.rating === 'again').length

      const savedExtensionCount = await tx.note.count({
        where: {
          id: { in: ratedCards.map((c) => c.noteId) },
          updatedAt: { gte: session.startedAt },
        },
      })

      if (session.endedAt) {
        return this.buildSummary(session, easyCount, againCount, savedExtensionCount)
      }

      const updatedSession = await tx.reviewSession.update({
        where: { id: sessionId },
        data: {
          endedAt: new Date(),
          totalCards: cards.length,
        },
      })

      return this.buildSummary(updatedSession, easyCount, againCount, savedExtensionCount)
    })
  }

  async abort(sessionId: string) {
    const session = await this.prisma.reviewSession.findUnique({
      where: { id: sessionId },
    })
    if (!session) throw new NotFoundException('Session not found')

    if (session.endedAt) {
      return { ok: true }
    }

    await this.prisma.reviewSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    })
    return { ok: true }
  }

  private buildSummary(
    session: { id: string; totalCards: number; startedAt: Date; endedAt: Date | null },
    easyCount: number,
    againCount: number,
    savedExtensionCount: number,
  ) {
    return {
      sessionId: session.id,
      totalCards: session.totalCards,
      results: { easy: easyCount, again: againCount },
      savedExtensionCount,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    }
  }

  async rate(sessionId: string, dto: RateReviewDto) {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.reviewSessionCard.findFirst({
        where: { sessionId, noteId: dto.noteId },
      })
      if (!card) throw new NotFoundException('Card not found in session')

      if (card.isDone) {
        return { ok: true }
      }

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

      const activityDate = todayCSTMidnight()
      await tx.dailyActivity.upsert({
        where: { activityDate },
        create: { activityDate, studyCount: 1, allTodosDone: false },
        update: { studyCount: { increment: 1 } },
      })

      return { ok: true }
    })
  }
}

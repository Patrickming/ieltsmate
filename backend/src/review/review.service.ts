import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { StartReviewDto } from './dto/start-review.dto'

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
}

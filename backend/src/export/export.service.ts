import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotesJson(): Promise<Buffer> {
    const notes = await this.prisma.note.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        content: true,
        translation: true,
        category: true,
        phonetic: true,
        synonyms: true,
        antonyms: true,
        example: true,
        memoryTip: true,
        reviewStatus: true,
        reviewCount: true,
        correctCount: true,
        wrongCount: true,
        lastReviewedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return Buffer.from(JSON.stringify(notes, null, 2), 'utf-8')
  }

  async getNotesCsv(): Promise<Buffer> {
    const notes = await this.prisma.note.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        content: true,
        translation: true,
        category: true,
        phonetic: true,
        synonyms: true,
        antonyms: true,
        example: true,
        memoryTip: true,
        reviewStatus: true,
        reviewCount: true,
        correctCount: true,
        wrongCount: true,
        lastReviewedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const headers = [
      'id', 'content', 'translation', 'category', 'phonetic',
      'synonyms', 'antonyms', 'example', 'memoryTip',
      'reviewStatus', 'reviewCount', 'correctCount', 'wrongCount',
      'lastReviewedAt', 'createdAt', 'updatedAt',
    ]

    const escapeCell = (val: unknown): string => {
      const str = val === null || val === undefined ? '' : String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows = notes.map((n) => [
      n.id,
      n.content,
      n.translation,
      n.category,
      n.phonetic ?? '',
      n.synonyms.join('|'),
      n.antonyms.join('|'),
      n.example ?? '',
      n.memoryTip ?? '',
      n.reviewStatus,
      n.reviewCount,
      n.correctCount,
      n.wrongCount,
      n.lastReviewedAt?.toISOString() ?? '',
      n.createdAt.toISOString(),
      n.updatedAt.toISOString(),
    ].map(escapeCell).join(','))

    const csv = [headers.join(','), ...rows].join('\n')
    return Buffer.from('\uFEFF' + csv, 'utf-8') // BOM for Excel
  }
}

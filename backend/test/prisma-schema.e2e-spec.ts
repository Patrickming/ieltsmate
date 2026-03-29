import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import { PrismaModule } from '../src/prisma/prisma.module'
import { PrismaService } from '../src/prisma/prisma.service'

describe('Prisma schema', () => {
  const prisma = new PrismaClient()
  const createdIds: string[] = []

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.note.deleteMany({ where: { id: { in: createdIds } } })
    }
    await prisma.$disconnect()
  })

  it('can create and query a note', async () => {
    const created = await prisma.note.create({
      data: {
        content: 'get out of',
        translation: '避免',
        category: '短语',
      },
    })
    createdIds.push(created.id)
    const fetched = await prisma.note.findUnique({ where: { id: created.id } })
    expect(fetched?.content).toBe('get out of')
  })

  it('PrismaService connects via onModuleInit and can create/query a note', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile()
    const app: INestApplication = moduleRef.createNestApplication()
    await app.init()
    const prismaService = app.get(PrismaService)
    const created = await prismaService.note.create({
      data: {
        content: 'via nest',
        translation: '经 Nest',
        category: '短语',
      },
    })
    createdIds.push(created.id)
    const fetched = await prismaService.note.findUnique({ where: { id: created.id } })
    expect(fetched?.content).toBe('via nest')
    await app.close()
  })
})

import 'reflect-metadata'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { HttpExceptionFilter } from '../src/common/http-exception.filter'
import { ResponseInterceptor } from '../src/common/response.interceptor'

describe('Review Start API', () => {
  const prisma = new PrismaClient()
  let app: INestApplication
  const createdIds: string[] = []
  const createdSessionIds: string[] = []

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    app.useGlobalInterceptors(new ResponseInterceptor())
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.init()
  })

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.favorite.deleteMany({ where: { noteId: { in: createdIds } } })
      await prisma.reviewSessionCard.deleteMany({ where: { noteId: { in: createdIds } } })
      await prisma.reviewLog.deleteMany({ where: { noteId: { in: createdIds } } })
      await prisma.note.deleteMany({ where: { id: { in: createdIds } } })
    }
    if (createdSessionIds.length > 0) {
      await prisma.reviewSession.deleteMany({ where: { id: { in: createdSessionIds } } })
    }
    await app.close()
    await prisma.$disconnect()
  })

  it('POST /review/sessions/start creates a session and filters by source/category/range', async () => {
    const c1 = await request(app.getHttpServer())
      .post('/notes')
      .send({ content: 'r1-alpha', translation: '阿尔法', category: 'Task4.1A' })
      .expect(201)
    const id1 = c1.body.data.id as string
    createdIds.push(id1)

    const c2 = await request(app.getHttpServer())
      .post('/notes')
      .send({ content: 'r1-beta', translation: '贝塔', category: 'Task4.1A' })
      .expect(201)
    const id2 = c2.body.data.id as string
    createdIds.push(id2)

    await prisma.note.update({ where: { id: id2 }, data: { wrongCount: 2 } })

    const startWrong = await request(app.getHttpServer())
      .post('/review/sessions/start')
      .send({
        source: 'notes',
        categories: ['Task4.1A'],
        range: 'wrong',
        mode: 'continue',
      })
      .expect(201)

    expect(startWrong.body.data.totalCards).toBe(1)
    expect((startWrong.body.data.cards as { id: string }[]).map((n) => n.id)).toEqual([id2])
    expect(typeof startWrong.body.data.sessionId).toBe('string')
    createdSessionIds.push(startWrong.body.data.sessionId as string)

    const sessionRow = await prisma.reviewSession.findUnique({
      where: { id: startWrong.body.data.sessionId as string },
      include: { cards: { orderBy: { orderIndex: 'asc' } } },
    })
    expect(sessionRow?.sourceType).toBe('notes')
    expect(sessionRow?.rangeType).toBe('wrong')
    expect(sessionRow?.modeType).toBe('continue')
    expect(sessionRow?.totalCards).toBe(1)
    expect(sessionRow?.cards.map((c) => c.noteId)).toEqual([id2])
  })

  it('POST /review/sessions/start supports favorites source and excludes soft-deleted notes', async () => {
    const c1 = await request(app.getHttpServer())
      .post('/notes')
      .send({ content: 'r2-alpha', translation: '阿尔法2', category: 'Task4.1B' })
      .expect(201)
    const id1 = c1.body.data.id as string
    createdIds.push(id1)

    const c2 = await request(app.getHttpServer())
      .post('/notes')
      .send({ content: 'r2-beta', translation: '贝塔2', category: 'Task4.1B' })
      .expect(201)
    const id2 = c2.body.data.id as string
    createdIds.push(id2)

    await request(app.getHttpServer()).post('/favorites/toggle').send({ noteId: id1 }).expect(200)
    await request(app.getHttpServer()).post('/favorites/toggle').send({ noteId: id2 }).expect(200)
    await request(app.getHttpServer()).delete(`/notes/${id2}`).expect(200)

    const startFav = await request(app.getHttpServer())
      .post('/review/sessions/start')
      .send({
        source: 'favorites',
        categories: ['Task4.1B'],
        range: 'all',
        mode: 'continue',
      })
      .expect(201)

    const ids = (startFav.body.data.cards as { id: string }[]).map((n) => n.id)
    expect(ids).toContain(id1)
    expect(ids).not.toContain(id2)
    expect(startFav.body.data.totalCards).toBe(1)
    createdSessionIds.push(startFav.body.data.sessionId as string)
  })

  it('POST /review/sessions/start range new_only returns only notes with reviewStatus new', async () => {
    const c1 = await request(app.getHttpServer())
      .post('/notes')
      .send({ content: 'r3-new', translation: '新', category: 'Task4.1C' })
      .expect(201)
    const idNew = c1.body.data.id as string
    createdIds.push(idNew)

    const c2 = await request(app.getHttpServer())
      .post('/notes')
      .send({ content: 'r3-learning', translation: '学', category: 'Task4.1C' })
      .expect(201)
    const idLearning = c2.body.data.id as string
    createdIds.push(idLearning)

    await prisma.note.update({
      where: { id: idLearning },
      data: { reviewStatus: 'learning' },
    })

    const start = await request(app.getHttpServer())
      .post('/review/sessions/start')
      .send({
        source: 'notes',
        categories: ['Task4.1C'],
        range: 'new_only',
        mode: 'continue',
      })
      .expect(201)

    expect(start.body.data.totalCards).toBe(1)
    expect((start.body.data.cards as { id: string }[]).map((n) => n.id)).toEqual([idNew])
    createdSessionIds.push(start.body.data.sessionId as string)
  })
})

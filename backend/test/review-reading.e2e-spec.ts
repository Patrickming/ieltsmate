import 'reflect-metadata'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AiService } from '../src/ai/ai.service'
import { AppModule } from '../src/app.module'
import { HttpExceptionFilter } from '../src/common/http-exception.filter'
import { ResponseInterceptor } from '../src/common/response.interceptor'

const TEN_MINUTES_SECONDS = 600
const VERY_LONG_TIMEOUT_SECONDS = 9999 * 60
const SINGLE_ARTICLE_TIMEOUT_MS = 8 * 60 * 1000

function extractCandidateIds(prompt: string): string[] {
  return [...prompt.matchAll(/"id":\s*"([^"]+)"/g)].map((m) => m[1])
}

function extractCandidateContents(prompt: string): string[] {
  return [...prompt.matchAll(/"content":\s*"([^"]+)"/g)].map((m) => m[1])
}

function buildArticlePayload(prompt: string) {
  const contents = extractCandidateContents(prompt).slice(0, 50)
  const filler = Array.from({ length: 920 }, (_, i) => `academic${i}`)
  const article = [...contents, ...filler].join(' ')
  return JSON.stringify({
    title: 'Networks of Urban Belonging',
    article,
    wordCount: 920,
  })
}

function buildTranslationPayload() {
  return JSON.stringify({
    paragraphTranslations: ['这是一段关于城市归属感的中文翻译。'],
  })
}

function buildReadingCompletion(prompt: string) {
  if (prompt.includes('paragraphTranslations')) {
    return buildTranslationPayload()
  }
  return buildArticlePayload(prompt)
}

describe('AI reading review API', () => {
  const prisma = new PrismaClient()
  let app: INestApplication
  let completeMock: jest.Mock
  const createdNoteIds: string[] = []
  const createdBatchIds: string[] = []

  beforeAll(async () => {
    completeMock = jest.fn()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiService)
      .useValue({
        complete: completeMock,
        resolveCompletionTarget: jest.fn(async () => ({
          providerName: 'ZenMux',
          modelId: 'deepseek/deepseek-v4-pro',
        })),
      })
      .compile()
    app = moduleRef.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    app.useGlobalInterceptors(new ResponseInterceptor())
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.init()
  })

  beforeEach(() => {
    completeMock.mockReset()
    completeMock.mockImplementation(async ({ messages }: { messages: Array<{ content: string }> }) =>
      buildReadingCompletion(messages[0]?.content ?? ''),
    )
  })

  afterAll(async () => {
    for (const batchId of createdBatchIds) {
      await prisma.$executeRawUnsafe('DELETE FROM "AiReadingReviewBatch" WHERE id = $1', batchId)
    }
    if (createdNoteIds.length > 0) {
      await prisma.note.deleteMany({ where: { id: { in: createdNoteIds } } })
    }
    await app.close()
    await prisma.$disconnect()
  })

  it('creates a saved reading batch with article details and note mappings', async () => {
    for (let i = 0; i < 55; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/notes')
        .send({
          content: i === 0 ? 'fellow' : `reading-note-${i}`,
          translation: `阅读笔记 ${i}`,
          category: 'TaskReadingE2E',
        })
        .expect(201)
      createdNoteIds.push(res.body.data.id as string)
    }

    const created = await request(app.getHttpServer())
      .post('/review/reading/batches')
      .send({
        source: 'notes',
        categories: ['TaskReadingE2E'],
        range: 'all',
        articleTarget: 1,
        timeoutSeconds: TEN_MINUTES_SECONDS,
      })
      .expect(201)

    const batchId = created.body.data.id as string
    createdBatchIds.push(batchId)

    let batch = created.body.data as {
      id: string
      status: string
      generatedArticles: number
      totalNotes: number
      usedNotes: number
      timeoutSeconds: number
      modelProvider?: string | null
      modelId?: string | null
      articles?: Array<{ id: string }>
    }
    for (let i = 0; i < 10 && batch.status !== 'completed'; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      const progress = await request(app.getHttpServer())
        .get(`/review/reading/batches/${batchId}`)
        .expect(200)
      batch = progress.body.data
    }

    expect(batch.status).toBe('completed')
    expect(batch.generatedArticles).toBe(1)
    expect(batch.modelProvider).toBe('ZenMux')
    expect(batch.modelId).toBe('deepseek/deepseek-v4-pro')
    expect(batch.totalNotes).toBe(55)
    expect(batch.usedNotes).toBe(50)
    expect(batch.articles).toHaveLength(1)

    const articleId = batch.articles?.[0].id
    expect(articleId).toBeTruthy()
    const article = await request(app.getHttpServer())
      .get(`/review/reading/articles/${articleId}`)
      .expect(200)

    expect(article.body.data.title).toBe('Networks of Urban Belonging')
    expect(article.body.data.wordCount).toBe(920)
    expect(article.body.data.paragraphTranslations).toEqual(['这是一段关于城市归属感的中文翻译。'])
    expect(article.body.data.notes).toHaveLength(50)
    expect(article.body.data.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          noteId: createdNoteIds[0],
          noteContent: 'fellow',
          expression: 'fellow',
          isVariant: false,
        }),
      ]),
    )

    await request(app.getHttpServer())
      .post(`/review/reading/batches/${batchId}/continue`)
      .send({ articleTarget: 1, timeoutSeconds: VERY_LONG_TIMEOUT_SECONDS })
      .expect(200)

    let continuedBatch = batch
    for (let i = 0; i < 10 && continuedBatch.generatedArticles < 2; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      const progress = await request(app.getHttpServer())
        .get(`/review/reading/batches/${batchId}`)
        .expect(200)
      continuedBatch = progress.body.data
    }

    expect(continuedBatch.generatedArticles).toBe(2)
    expect(continuedBatch.usedNotes).toBe(55)
    expect(continuedBatch.timeoutSeconds).toBe(VERY_LONG_TIMEOUT_SECONDS)
    const secondArticleId = continuedBatch.articles?.[1]?.id
    expect(secondArticleId).toBeTruthy()
    const secondArticle = await request(app.getHttpServer())
      .get(`/review/reading/articles/${secondArticleId}`)
      .expect(200)
    expect(secondArticle.body.data.notes[0]).toMatchObject({
      noteId: createdNoteIds[50],
      noteContent: 'reading-note-50',
    })
    expect(completeMock.mock.calls.map(([arg]) => (arg as { timeoutMs?: number }).timeoutMs)).toEqual(
      expect.arrayContaining([SINGLE_ARTICLE_TIMEOUT_MS]),
    )
    expect(completeMock.mock.calls.every(([arg]) => (arg as { stream?: boolean }).stream === true)).toBe(true)
    const firstPrompt = (completeMock.mock.calls[0]?.[0] as { messages?: Array<{ content: string }> }).messages?.[0]?.content ?? ''
    expect(firstPrompt).toContain('"id":"')
    expect(firstPrompt).toContain('"content":"fellow"')
    expect(firstPrompt).not.toContain('"translation"')
    expect(firstPrompt).not.toContain('"category"')
    expect(firstPrompt).not.toContain('阅读笔记 0')
    expect(firstPrompt).not.toContain('"usedNotes"')
    expect(firstPrompt).not.toContain('"noteId"')
    expect(firstPrompt).not.toContain('"explanation"')

    const listed = await request(app.getHttpServer()).get('/review/reading/batches').expect(200)
    expect((listed.body.data.items as Array<{ id: string }>).some((item) => item.id === batchId)).toBe(true)

    await request(app.getHttpServer()).delete(`/review/reading/articles/${articleId}`).expect(200)
    const afterDelete = await request(app.getHttpServer())
      .get(`/review/reading/articles/${articleId}`)
      .expect(404)
    expect(afterDelete.body.message).toContain('not found')
  })

  it('lets the in-flight article finish after the batch timeout and then stops', async () => {
    for (let i = 0; i < 110; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/notes')
        .send({
          content: `deadline-note-${i}`,
          translation: `截止测试笔记 ${i}`,
          category: 'TaskReadingDeadlineE2E',
        })
        .expect(201)
      createdNoteIds.push(res.body.data.id as string)
    }

    completeMock.mockImplementationOnce(async ({ messages }: { messages: Array<{ content: string }> }) => {
      await new Promise((resolve) => setTimeout(resolve, 1100))
      return buildArticlePayload(messages[0]?.content ?? '')
    })

    const created = await request(app.getHttpServer())
      .post('/review/reading/batches')
      .send({
        source: 'notes',
        categories: ['TaskReadingDeadlineE2E'],
        range: 'all',
        articleTarget: 2,
        timeoutSeconds: 1,
      })
      .expect(201)

    const batchId = created.body.data.id as string
    createdBatchIds.push(batchId)

    let batch = created.body.data as {
      status: string
      generatedArticles: number
      usedNotes: number
      articles?: Array<{ id: string }>
    }
    for (let i = 0; i < 20 && batch.status !== 'completed'; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      const progress = await request(app.getHttpServer())
        .get(`/review/reading/batches/${batchId}`)
        .expect(200)
      batch = progress.body.data
    }

    expect(batch.status).toBe('completed')
    expect(batch.generatedArticles).toBe(1)
    expect(batch.usedNotes).toBe(50)
    expect(batch.articles).toHaveLength(1)
    expect(completeMock).toHaveBeenCalledTimes(2)
    expect((completeMock.mock.calls[0]?.[0] as { timeoutMs?: number }).timeoutMs).toBe(SINGLE_ARTICLE_TIMEOUT_MS)
  })

  it('keeps a cancelled batch clean when an in-flight AI request fails later', async () => {
    for (let i = 0; i < 55; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/notes')
        .send({
          content: `cancel-note-${i}`,
          translation: `取消测试笔记 ${i}`,
          category: 'TaskReadingCancelE2E',
        })
        .expect(201)
      createdNoteIds.push(res.body.data.id as string)
    }

    const pendingGeneration: { reject: ((error: Error) => void) | null } = { reject: null }
    let generationSignal: AbortSignal | undefined
    completeMock.mockImplementationOnce(({ signal }: { signal?: AbortSignal }) => new Promise<string>((_resolve, reject) => {
      generationSignal = signal
      pendingGeneration.reject = reject
    }))

    const created = await request(app.getHttpServer())
      .post('/review/reading/batches')
      .send({
        source: 'notes',
        categories: ['TaskReadingCancelE2E'],
        range: 'all',
        articleTarget: 1,
        timeoutSeconds: 0,
      })
      .expect(201)

    const batchId = created.body.data.id as string
    createdBatchIds.push(batchId)

    await request(app.getHttpServer())
      .post(`/review/reading/batches/${batchId}/cancel`)
      .expect(200)

    expect(generationSignal?.aborted).toBe(true)
    expect(pendingGeneration.reject).toBeTruthy()
    pendingGeneration.reject?.(new Error('late failure after cancellation'))
    await new Promise((resolve) => setTimeout(resolve, 50))

    const cancelled = await request(app.getHttpServer())
      .get(`/review/reading/batches/${batchId}`)
      .expect(200)

    expect(cancelled.body.data.status).toBe('cancelled')
    expect(cancelled.body.data.failedArticles).toBe(0)
    expect(cancelled.body.data.errorMessage).toBeNull()
  })

  it('records the latest generation error on failed batches', async () => {
    for (let i = 0; i < 55; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/notes')
        .send({
          content: `failure-log-note-${i}`,
          translation: `失败日志测试笔记 ${i}`,
          category: 'TaskReadingFailureLogE2E',
        })
        .expect(201)
      createdNoteIds.push(res.body.data.id as string)
    }
    completeMock.mockResolvedValue('not json')

    const created = await request(app.getHttpServer())
      .post('/review/reading/batches')
      .send({
        source: 'notes',
        categories: ['TaskReadingFailureLogE2E'],
        range: 'all',
        articleTarget: 1,
        timeoutSeconds: TEN_MINUTES_SECONDS,
      })
      .expect(201)

    const batchId = created.body.data.id as string
    createdBatchIds.push(batchId)

    let batch = created.body.data as {
      status: string
      failedArticles: number
      errorMessage?: string | null
    }
    for (let i = 0; i < 40 && batch.status !== 'failed'; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      const progress = await request(app.getHttpServer())
        .get(`/review/reading/batches/${batchId}`)
        .expect(200)
      batch = progress.body.data
    }

    expect(batch.status).toBe('failed')
    expect(batch.failedArticles).toBe(3)
    expect(batch.errorMessage).toBe('AI returned invalid reading article JSON')
  })
})

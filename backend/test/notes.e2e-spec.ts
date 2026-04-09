import 'reflect-metadata'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { HttpExceptionFilter } from '../src/common/http-exception.filter'
import { ResponseInterceptor } from '../src/common/response.interceptor'

describe('Notes API', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    app.useGlobalInterceptors(new ResponseInterceptor())
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /notes then GET /notes supports search and category', async () => {
    const created = await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'get out of',
        translation: '避免',
        category: '短语',
      })
      .expect(201)
    const id = created.body.data.id as string

    const res = await request(app.getHttpServer())
      .get('/notes?category=短语&search=get')
      .expect(200)

    expect(Array.isArray(res.body.data.items)).toBe(true)
    expect(
      res.body.data.items.some(
        (n: { id: string; content: string }) => n.id === id && n.content.includes('get'),
      ),
    ).toBe(true)
  })

  it('GET /notes/:id returns detail; PATCH updates; DELETE soft-deletes (hidden from list)', async () => {
    const created = await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'abandon ship',
        translation: '弃船',
        category: '单词',
      })
      .expect(201)

    const id = created.body.data.id as string
    expect(id).toBeDefined()

    const detail = await request(app.getHttpServer()).get(`/notes/${id}`).expect(200)
    expect(detail.body.data.content).toBe('abandon ship')

    const patched = await request(app.getHttpServer())
      .patch(`/notes/${id}`)
      .send({ translation: '放弃' })
      .expect(200)
    expect(patched.body.data.translation).toBe('放弃')

    await request(app.getHttpServer()).delete(`/notes/${id}`).expect(200)

    await request(app.getHttpServer()).get(`/notes/${id}`).expect(404)

    const list = await request(app.getHttpServer()).get('/notes?search=abandon').expect(200)
    expect(list.body.data.items.some((n: { id: string }) => n.id === id)).toBe(false)
  })

  it('POST /notes 与 PATCH /notes/:id 支持 partsOfSpeech/confusables 且服务端去重归一化', async () => {
    const created = await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'eligible',
        translation: '合格的',
        category: '单词',
        synonyms: [' good ', 'good', ' fit '],
        antonyms: [' bad ', 'bad'],
        partsOfSpeech: [
          { pos: 'adj.', label: '形容词', meaning: '义1' },
          { pos: 'ADJ.', label: '形', meaning: '义1' },
        ],
        confusables: [
          {
            kind: 'form',
            words: [
              { word: 'eligible', meaning: 'm1' },
              { word: 'illegible', meaning: 'm2' },
            ],
          },
          {
            kind: 'form',
            words: [
              { word: 'illegible', meaning: 'm2' },
              { word: 'eligible', meaning: 'm1' },
            ],
          },
        ],
      })
      .expect(201)

    const id = created.body.data.id as string
    const pos = created.body.data.partsOfSpeech as Array<{ pos: string; meaning: string }>
    const conf = created.body.data.confusables as Array<{ kind: string; words: Array<{ word: string }> }>
    expect(Array.isArray(pos)).toBe(true)
    expect(pos).toHaveLength(1)
    expect(created.body.data.synonyms).toEqual(['good', 'fit'])
    expect(created.body.data.antonyms).toEqual(['bad'])
    expect(Array.isArray(conf)).toBe(true)
    expect(conf).toHaveLength(1)
    expect(conf[0].kind).toBe('form')

    const patched = await request(app.getHttpServer())
      .patch(`/notes/${id}`)
      .send({
        partsOfSpeech: [
          { pos: 'n.', label: '名', meaning: '新' },
          { pos: 'n.', label: '名', meaning: '新' },
        ],
      })
      .expect(200)

    const pos2 = patched.body.data.partsOfSpeech as unknown[]
    expect(pos2).toHaveLength(1)
  })

  it('POST/PATCH 传 partsOfSpeech 或 confusables 为 null 返回 400', async () => {
    await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'null-case-create',
        translation: '测试',
        category: '单词',
        partsOfSpeech: null,
      })
      .expect(400)

    const created = await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'null-case-patch',
        translation: '测试',
        category: '单词',
      })
      .expect(201)

    const id = created.body.data.id as string

    await request(app.getHttpServer())
      .patch(`/notes/${id}`)
      .send({
        confusables: null,
      })
      .expect(400)
  })

  it('user-notes: POST list DELETE flow; list excludes soft-deleted; note deleted => 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'remark parent',
        translation: '父笔记',
        category: '单词',
      })
      .expect(201)
    const noteId = created.body.data.id as string

    const empty = await request(app.getHttpServer()).get(`/notes/${noteId}/user-notes`).expect(200)
    expect(empty.body.data.items).toEqual([])

    const a = await request(app.getHttpServer())
      .post(`/notes/${noteId}/user-notes`)
      .send({ content: 'first remark' })
      .expect(201)
    const userNoteId = a.body.data.id as string
    expect(a.body.data.content).toBe('first remark')
    expect(a.body.data.deletedAt).toBeNull()

    await request(app.getHttpServer()).post(`/notes/${noteId}/user-notes`).send({ content: '' }).expect(400)

    const listed = await request(app.getHttpServer()).get(`/notes/${noteId}/user-notes`).expect(200)
    expect(listed.body.data.items).toHaveLength(1)
    expect(listed.body.data.items[0].id).toBe(userNoteId)

    await request(app.getHttpServer())
      .delete(`/notes/${noteId}/user-notes/${userNoteId}`)
      .expect(200)

    const afterDel = await request(app.getHttpServer()).get(`/notes/${noteId}/user-notes`).expect(200)
    expect(afterDel.body.data.items).toEqual([])

    await request(app.getHttpServer())
      .delete(`/notes/${noteId}/user-notes/${userNoteId}`)
      .expect(404)

    await request(app.getHttpServer()).delete(`/notes/${noteId}`).expect(200)
    await request(app.getHttpServer()).get(`/notes/${noteId}/user-notes`).expect(404)
  })
})

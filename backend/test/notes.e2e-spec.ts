import 'reflect-metadata'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { HttpExceptionFilter } from '../src/common/http-exception.filter'
import { ResponseInterceptor } from '../src/common/response.interceptor'
import { PrismaService } from '../src/prisma/prisma.service'

describe('Notes API', () => {
  let app: INestApplication
  let prisma: PrismaService
  let uploadRoot: string
  const { AbstractLoader } = require('@nestjs/serve-static/dist/loaders/abstract.loader')
  const { ExpressLoader } = require('@nestjs/serve-static/dist/loaders/express.loader')
  const ONE_BY_ONE_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnRk8wAAAAASUVORK5CYII=',
    'base64',
  )

  const countStoredImages = () =>
    readdirSync(uploadRoot, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).length

  beforeAll(async () => {
    uploadRoot = mkdtempSync(join(tmpdir(), 'ieltsmate-user-note-images-'))
    process.env.NOTE_USER_IMAGE_ROOT = uploadRoot
    const { AppModule } = await import('../src/app.module')
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AbstractLoader)
      .useValue(new ExpressLoader())
      .compile()
    prisma = moduleRef.get(PrismaService)
    app = moduleRef.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    app.useGlobalInterceptors(new ResponseInterceptor())
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
    rmSync(uploadRoot, { recursive: true, force: true })
    delete process.env.NOTE_USER_IMAGE_ROOT
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

  it('POST /notes 与 PATCH /notes/:id 支持 wordFamily 且服务端归一化去重', async () => {
    const created = await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'popular',
        translation: '受欢迎的',
        category: '单词',
        wordFamily: {
          base: { word: 'popular', pos: 'adjective', meaning: '受欢迎的', phonetic: '/p/' },
          derivedByPos: {
            noun: [
              { word: 'popularity', pos: 'noun', meaning: '普及', phonetic: '/n/' },
              { word: 'popularity', pos: 'noun', meaning: '普及', phonetic: '/dup/' },
            ],
            verb: [],
            adjective: [],
            adverb: [],
          },
        },
      })
      .expect(201)

    const id = created.body.data.id as string
    const wf = created.body.data.wordFamily as { derivedByPos: { noun: unknown[] } }
    expect(wf.derivedByPos.noun).toHaveLength(1)

    const patched = await request(app.getHttpServer())
      .patch(`/notes/${id}`)
      .send({
        wordFamily: {
          base: { word: 'popular', pos: 'adjective', meaning: '受欢迎的', phonetic: '/p/' },
          derivedByPos: {
            noun: [{ word: 'popularity', pos: 'noun', meaning: '普及', phonetic: '/n/' }],
            verb: [{ word: 'popularize', pos: 'verb', meaning: '普及化', phonetic: '' }],
            adjective: [],
            adverb: [],
          },
        },
      })
      .expect(200)

    const wf2 = patched.body.data.wordFamily as { derivedByPos: { noun: unknown[]; verb: unknown[] } }
    expect(wf2.derivedByPos.noun).toHaveLength(1)
    expect(wf2.derivedByPos.verb).toHaveLength(1)
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

  it('user-notes accepts multipart images, updates keepImages, and returns image urls', async () => {
    const created = await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'hostel',
        translation: '旅舍',
        category: '单词',
      })
      .expect(201)
    const noteId = created.body.data.id as string

    const multipartCreated = await request(app.getHttpServer())
      .post(`/notes/${noteId}/user-notes`)
      .field('content', '第一条备注')
      .attach('images', ONE_BY_ONE_PNG, { filename: 'a.png', contentType: 'image/png' })
      .attach('images', ONE_BY_ONE_PNG, { filename: 'b.png', contentType: 'image/png' })
      .expect(201)

    expect(multipartCreated.body.data.content).toBe('第一条备注')
    expect(multipartCreated.body.data.images).toHaveLength(2)
    expect(multipartCreated.body.data.images[0]).toMatch(/^\/note-user-images\//)
    expect(
      existsSync(join(uploadRoot, multipartCreated.body.data.images[0].replace('/note-user-images/', ''))),
    ).toBe(true)
    await request(app.getHttpServer())
      .get(multipartCreated.body.data.images[0] as string)
      .expect('Content-Type', /image\/png/)
      .expect(200)

    const userNoteId = multipartCreated.body.data.id as string
    const keptImage = multipartCreated.body.data.images[0] as string
    const removedImage = multipartCreated.body.data.images[1] as string

    const patched = await request(app.getHttpServer())
      .patch(`/notes/${noteId}/user-notes/${userNoteId}`)
      .field('content', '')
      .field('keepImages', JSON.stringify([keptImage]))
      .attach('images', ONE_BY_ONE_PNG, { filename: 'c.png', contentType: 'image/png' })
      .expect(200)

    expect(patched.body.data.content).toBe('')
    expect(patched.body.data.images).toEqual(expect.arrayContaining([keptImage]))
    expect(patched.body.data.images).toHaveLength(2)
    expect(
      existsSync(join(uploadRoot, removedImage.replace('/note-user-images/', ''))),
    ).toBe(false)

    const listed = await request(app.getHttpServer()).get(`/notes/${noteId}/user-notes`).expect(200)
    expect(listed.body.data.items[0].images).toHaveLength(2)

    await request(app.getHttpServer())
      .delete(`/notes/${noteId}/user-notes/${userNoteId}`)
      .expect(200)

    const afterDelete = await request(app.getHttpServer()).get(`/notes/${noteId}/user-notes`).expect(200)
    expect(afterDelete.body.data.items).toEqual([])
    expect(existsSync(join(uploadRoot, keptImage.replace('/note-user-images/', '')))).toBe(false)
    expect(
      existsSync(join(uploadRoot, patched.body.data.images[1].replace('/note-user-images/', ''))),
    ).toBe(false)
  })

  it('user-notes rejects empty content + empty images', async () => {
    const created = await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'empty guard',
        translation: '测试',
        category: '单词',
      })
      .expect(201)

    await request(app.getHttpServer())
      .post(`/notes/${created.body.data.id}/user-notes`)
      .field('content', '   ')
      .expect(400)
  })

  it('user-notes accepts image-only multipart create and persists normalized empty content', async () => {
    const created = await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'image only guard',
        translation: '测试',
        category: '单词',
      })
      .expect(201)

    const imageOnly = await request(app.getHttpServer())
      .post(`/notes/${created.body.data.id}/user-notes`)
      .attach('images', ONE_BY_ONE_PNG, { filename: 'only-image.png', contentType: 'image/png' })
      .expect(201)

    expect(imageOnly.body.data.content).toBe('')
    expect(imageOnly.body.data.images).toHaveLength(1)
    expect(imageOnly.body.data.images[0]).toMatch(/^\/note-user-images\//)

    const listed = await request(app.getHttpServer())
      .get(`/notes/${created.body.data.id}/user-notes`)
      .expect(200)

    expect(listed.body.data.items).toHaveLength(1)
    expect(listed.body.data.items[0].content).toBe('')
    expect(listed.body.data.items[0].images).toHaveLength(1)
    expect(listed.body.data.items[0].id).toBe(imageOnly.body.data.id)
  })

  it('user-notes PATCH rejects empty final content with no kept or new images', async () => {
    const created = await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'patch empty guard',
        translation: '测试',
        category: '单词',
      })
      .expect(201)

    const createdUserNote = await request(app.getHttpServer())
      .post(`/notes/${created.body.data.id}/user-notes`)
      .field('content', '原备注')
      .attach('images', ONE_BY_ONE_PNG, { filename: 'guard.png', contentType: 'image/png' })
      .expect(201)

    await request(app.getHttpServer())
      .patch(`/notes/${created.body.data.id}/user-notes/${createdUserNote.body.data.id}`)
      .field('content', '   ')
      .field('keepImages', JSON.stringify([]))
      .expect(400)
  })

  it('user-notes PATCH rejects final image count above 10 and cleans newly uploaded files', async () => {
    const created = await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'patch image overflow',
        translation: '测试',
        category: '单词',
      })
      .expect(201)

    const createReq = request(app.getHttpServer())
      .post(`/notes/${created.body.data.id}/user-notes`)
      .field('content', '原备注')
    for (let index = 0; index < 9; index += 1) {
      createReq.attach('images', ONE_BY_ONE_PNG, {
        filename: `seed-${index}.png`,
        contentType: 'image/png',
      })
    }
    const createdUserNote = await createReq.expect(201)

    const existingImages = createdUserNote.body.data.images as string[]
    expect(existingImages).toHaveLength(9)
    const fileCountBeforePatch = countStoredImages()

    const patchReq = request(app.getHttpServer())
      .patch(`/notes/${created.body.data.id}/user-notes/${createdUserNote.body.data.id}`)
      .field('content', '原备注')
      .field('keepImages', JSON.stringify(existingImages))
      .attach('images', ONE_BY_ONE_PNG, { filename: 'overflow-a.png', contentType: 'image/png' })
      .attach('images', ONE_BY_ONE_PNG, { filename: 'overflow-b.png', contentType: 'image/png' })

    await patchReq.expect(400)
    expect(countStoredImages()).toBe(fileCountBeforePatch)

    const listed = await request(app.getHttpServer())
      .get(`/notes/${created.body.data.id}/user-notes`)
      .expect(200)

    expect(listed.body.data.items).toHaveLength(1)
    expect(listed.body.data.items[0].images).toHaveLength(9)
    expect(listed.body.data.items[0].images).toEqual(existingImages)
  })

  it('DELETE /notes/:id also cleans up child user-note images on disk', async () => {
    const created = await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'delete parent cleanup',
        translation: '测试',
        category: '单词',
      })
      .expect(201)

    const noteId = created.body.data.id as string
    const createdUserNote = await request(app.getHttpServer())
      .post(`/notes/${noteId}/user-notes`)
      .field('content', '带图备注')
      .attach('images', ONE_BY_ONE_PNG, { filename: 'parent-a.png', contentType: 'image/png' })
      .attach('images', ONE_BY_ONE_PNG, { filename: 'parent-b.png', contentType: 'image/png' })
      .expect(201)

    const imagePaths = createdUserNote.body.data.images as string[]
    expect(imagePaths).toHaveLength(2)
    for (const imagePath of imagePaths) {
      expect(existsSync(join(uploadRoot, imagePath.replace('/note-user-images/', '')))).toBe(true)
    }

    await request(app.getHttpServer()).delete(`/notes/${noteId}`).expect(200)

    await request(app.getHttpServer()).get(`/notes/${noteId}`).expect(404)
    for (const imagePath of imagePaths) {
      expect(existsSync(join(uploadRoot, imagePath.replace('/note-user-images/', '')))).toBe(false)
    }

    const deletedUserNotes = await prisma.noteUserNote.findMany({
      where: { noteId },
      select: { deletedAt: true },
    })
    expect(deletedUserNotes).toHaveLength(1)
    expect(deletedUserNotes[0]?.deletedAt).not.toBeNull()
  })
})

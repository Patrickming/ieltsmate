import 'reflect-metadata'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { HttpExceptionFilter } from '../src/common/http-exception.filter'
import { ResponseInterceptor } from '../src/common/response.interceptor'

describe('Favorites API', () => {
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

  it('POST /favorites/toggle: first call favorites, second unfavorites', async () => {
    const created = await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'toggle fav',
        translation: '切换收藏',
        category: '单词',
      })
      .expect(201)
    const noteId = created.body.data.id as string

    const on = await request(app.getHttpServer())
      .post('/favorites/toggle')
      .send({ noteId })
      .expect(200)
    expect(on.body.data).toEqual({ noteId, isFavorite: true })

    const off = await request(app.getHttpServer())
      .post('/favorites/toggle')
      .send({ noteId })
      .expect(200)
    expect(off.body.data).toEqual({ noteId, isFavorite: false })
  })

  it('POST /favorites/toggle returns 404 when note missing or soft-deleted', async () => {
    await request(app.getHttpServer())
      .post('/favorites/toggle')
      .send({ noteId: '00000000-0000-4000-8000-000000000001' })
      .expect(404)

    const created = await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'deleted parent',
        translation: '已删',
        category: '单词',
      })
      .expect(201)
    const noteId = created.body.data.id as string
    await request(app.getHttpServer()).delete(`/notes/${noteId}`).expect(200)

    await request(app.getHttpServer()).post('/favorites/toggle').send({ noteId }).expect(404)
  })

  it('GET /favorites: toggled note appears; search filters; soft-deleted note excluded', async () => {
    const alpha = await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'alphaUniqueContent',
        translation: '阿尔法',
        category: '单词',
      })
      .expect(201)
    const alphaId = alpha.body.data.id as string

    const beta = await request(app.getHttpServer())
      .post('/notes')
      .send({
        content: 'betaOther',
        translation: '贝塔词',
        category: '单词',
      })
      .expect(201)
    const betaId = beta.body.data.id as string

    await request(app.getHttpServer()).post('/favorites/toggle').send({ noteId: alphaId }).expect(200)
    await request(app.getHttpServer()).post('/favorites/toggle').send({ noteId: betaId }).expect(200)

    const all = await request(app.getHttpServer()).get('/favorites').expect(200)
    const ids = (all.body.data.items as { id: string }[]).map((n) => n.id)
    expect(ids).toContain(alphaId)
    expect(ids).toContain(betaId)

    const searched = await request(app.getHttpServer())
      .get('/favorites')
      .query({ search: 'uniquecontent' })
      .expect(200)
    const searchIds = (searched.body.data.items as { id: string }[]).map((n) => n.id)
    expect(searchIds).toEqual([alphaId])

    await request(app.getHttpServer()).delete(`/notes/${alphaId}`).expect(200)

    const afterDelete = await request(app.getHttpServer()).get('/favorites').expect(200)
    const afterIds = (afterDelete.body.data.items as { id: string }[]).map((n) => n.id)
    expect(afterIds).not.toContain(alphaId)
    expect(afterIds).toContain(betaId)
  })
})

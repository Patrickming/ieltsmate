import 'dotenv/config'
import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { json, urlencoded } from 'express'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/http-exception.filter'
import { ResponseInterceptor } from './common/response.interceptor'

async function bootstrap() {
  // Disable the built-in body parser so we can set our own size limit (images can be large)
  const app = await NestFactory.create(AppModule, { bodyParser: false })
  app.use(json({ limit: '10mb' }))
  app.use(urlencoded({ limit: '10mb', extended: true }))
  app.enableCors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.useGlobalInterceptors(new ResponseInterceptor())
  app.useGlobalFilters(new HttpExceptionFilter())
  await app.listen(Number(process.env.PORT ?? 3000))
}
bootstrap().catch((error) => {
  // Keep startup failures explicit in container logs.
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap backend:', error)
  process.exit(1)
})

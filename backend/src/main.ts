import 'dotenv/config'
import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/http-exception.filter'
import { ResponseInterceptor } from './common/response.interceptor'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
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

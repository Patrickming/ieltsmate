import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { AiModule } from '../ai/ai.module'
import { PrismaModule } from '../prisma/prisma.module'
import { ImportController } from './import.controller'
import { ImportService } from './import.service'

@Module({
  imports: [
    PrismaModule,
    AiModule,
    MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } }),
  ],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}

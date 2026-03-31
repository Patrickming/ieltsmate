import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { PrismaModule } from '../prisma/prisma.module'
import { ReviewAiService } from './review-ai.service'
import { ReviewController } from './review.controller'
import { ReviewService } from './review.service'

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [ReviewController],
  providers: [ReviewService, ReviewAiService],
})
export class ReviewModule {}

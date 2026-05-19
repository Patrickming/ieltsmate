import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { PrismaModule } from '../prisma/prisma.module'
import { ReviewAiService } from './review-ai.service'
import { ReviewReadingController } from './review-reading.controller'
import { ReviewReadingService } from './review-reading.service'
import { ReviewController } from './review.controller'
import { ReviewService } from './review.service'

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [ReviewController, ReviewReadingController],
  providers: [ReviewService, ReviewAiService, ReviewReadingService],
})
export class ReviewModule {}

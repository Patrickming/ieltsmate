import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import { StartReviewDto } from './dto/start-review.dto'
import { RateReviewDto } from './dto/rate-review.dto'
import { GenerateReviewDto } from './dto/generate-review.dto'
import { ReviewService } from './review.service'
import { ReviewAiService } from './review-ai.service'

@Controller('review')
export class ReviewController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly reviewAiService: ReviewAiService,
  ) {}

  @Post('sessions/start')
  @HttpCode(HttpStatus.CREATED)
  start(@Body() dto: StartReviewDto) {
    return this.reviewService.start(dto)
  }

  @Patch('sessions/:sessionId/rate')
  @HttpCode(HttpStatus.OK)
  rate(
    @Param('sessionId') sessionId: string,
    @Body() dto: RateReviewDto,
  ) {
    return this.reviewService.rate(sessionId, dto)
  }

  @Post('sessions/:sessionId/end')
  @HttpCode(HttpStatus.OK)
  end(@Param('sessionId') sessionId: string) {
    return this.reviewService.end(sessionId)
  }

  @Post('sessions/:sessionId/abort')
  @HttpCode(HttpStatus.OK)
  abort(@Param('sessionId') sessionId: string) {
    return this.reviewService.abort(sessionId)
  }

  @Post('ai/generate')
  @HttpCode(HttpStatus.OK)
  generate(@Body() dto: GenerateReviewDto) {
    return this.reviewAiService.generate(dto.noteId, dto.cardType)
  }
}

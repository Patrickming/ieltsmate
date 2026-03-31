import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import { StartReviewDto } from './dto/start-review.dto'
import { RateReviewDto } from './dto/rate-review.dto'
import { ReviewService } from './review.service'

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

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
}

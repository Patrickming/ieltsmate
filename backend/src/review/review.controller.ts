import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { StartReviewDto } from './dto/start-review.dto'
import { ReviewService } from './review.service'

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post('sessions/start')
  @HttpCode(HttpStatus.CREATED)
  start(@Body() dto: StartReviewDto) {
    return this.reviewService.start(dto)
  }
}

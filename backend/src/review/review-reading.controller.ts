import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common'
import { ContinueReadingReviewBatchDto, CreateReadingReviewBatchDto } from './dto/create-reading-review-batch.dto'
import { ReviewReadingService } from './review-reading.service'

@Controller('review/reading')
export class ReviewReadingController {
  constructor(private readonly reviewReadingService: ReviewReadingService) {}

  @Post('batches')
  @HttpCode(HttpStatus.CREATED)
  createBatch(@Body() dto: CreateReadingReviewBatchDto) {
    return this.reviewReadingService.createBatch(dto)
  }

  @Get('batches')
  listBatches() {
    return this.reviewReadingService.listBatches()
  }

  @Get('batches/:id')
  getBatch(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reviewReadingService.getBatch(id)
  }

  @Post('batches/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelBatch(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reviewReadingService.cancelBatch(id)
  }

  @Post('batches/:id/continue')
  @HttpCode(HttpStatus.OK)
  continueBatch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ContinueReadingReviewBatchDto,
  ) {
    return this.reviewReadingService.continueBatch(id, dto)
  }

  @Delete('batches/:id')
  deleteBatch(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reviewReadingService.deleteBatch(id)
  }

  @Get('articles/:id')
  getArticle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reviewReadingService.getArticle(id)
  }

  @Delete('articles/:id')
  deleteArticle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reviewReadingService.deleteArticle(id)
  }
}

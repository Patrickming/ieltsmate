import { Controller, Get, Param } from '@nestjs/common'
import { WritingService } from './writing.service'

@Controller('writing-notes')
export class WritingController {
  constructor(private readonly writingService: WritingService) {}

  @Get()
  list() {
    return this.writingService.list()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.writingService.findOne(id)
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ImportService } from './import.service'
import { SaveNotesDto } from './dto/save-notes.dto'

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('notes/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async preview(
    @UploadedFile() file: Express.Multer.File,
    @Query('modelId') modelId?: string,
    @Query('forceAi') forceAi?: string,
  ) {
    if (!file) throw new BadRequestException('请上传文件')
    const ext = file.originalname.split('.').pop()?.toLowerCase()
    if (ext !== 'md') throw new BadRequestException('仅支持 .md 文件')
    const forceAiEnabled = ['1', 'true', 'yes', 'on'].includes((forceAi ?? '').toLowerCase())
    return this.importService.preview(file.buffer, modelId, forceAiEnabled)
  }

  @Post('notes/save')
  async save(@Body() dto: SaveNotesDto) {
    return this.importService.save(dto.notes)
  }
}

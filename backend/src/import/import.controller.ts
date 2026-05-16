import { BadRequestException, Body, Controller, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ImportService } from './import.service'
import { PreviewImportTextDto } from './dto/preview-import-text.dto'
import { SaveNotesDto } from './dto/save-notes.dto'

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  private static readonly PREVIEW_MAX_BYTES = 5 * 1024 * 1024

  /** 上传 .md 文件预览（multipart） */
  @Post('notes/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: ImportController.PREVIEW_MAX_BYTES } }))
  async preview(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('modelId') modelId?: string,
    @Query('forceAi') forceAi?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请先上传 .md 文件')
    }
    const ext = file.originalname.split('.').pop()?.toLowerCase()
    if (ext !== 'md') throw new BadRequestException('仅支持 .md 文件')

    const forceAiEnabled = ['1', 'true', 'yes', 'on'].includes((forceAi ?? '').toLowerCase())
    return this.importService.preview(file.buffer, modelId, forceAiEnabled)
  }

  /** 粘贴 Markdown / 词条文本预览（JSON Body，避免 multipart 在无文件时解析异常） */
  @Post('notes/preview-text')
  async previewText(
    @Body() dto: PreviewImportTextDto,
    @Query('modelId') modelId?: string,
    @Query('forceAi') forceAi?: string,
  ) {
    const mdTrimmed = dto.markdown.trim()
    if (!mdTrimmed.length) {
      throw new BadRequestException('请先粘贴笔记内容')
    }
    const buffer = Buffer.from(mdTrimmed, 'utf-8')
    if (buffer.length > ImportController.PREVIEW_MAX_BYTES) {
      throw new BadRequestException(`粘贴内容过大，最大 ${ImportController.PREVIEW_MAX_BYTES / (1024 * 1024)} MB`)
    }
    const forceAiEnabled = ['1', 'true', 'yes', 'on'].includes((forceAi ?? '').toLowerCase())
    return this.importService.preview(buffer, modelId, forceAiEnabled)
  }

  @Post('notes/save')
  async save(@Body() dto: SaveNotesDto) {
    return this.importService.save(dto.notes)
  }
}

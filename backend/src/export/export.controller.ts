import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common'
import { Response } from 'express'
import { ExportService } from './export.service'

@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('notes')
  async exportNotes(
    @Query('format') format: 'json' | 'csv' = 'json',
    @Res() res: Response,
  ) {
    if (format !== 'json' && format !== 'csv') {
      throw new BadRequestException('format must be json or csv')
    }
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const filename = `ieltsmate-notes-${today}.${format}`

    if (format === 'csv') {
      const buffer = await this.exportService.getNotesCsv()
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(buffer)
    } else {
      const buffer = await this.exportService.getNotesJson()
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(buffer)
    }
  }
}

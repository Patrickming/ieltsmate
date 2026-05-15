import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { CreateNoteDto } from './dto/create-note.dto'
import { CreateUserNoteDto } from './dto/create-user-note.dto'
import { UpdateNoteDto } from './dto/update-note.dto'
import { UpdateUserNoteDto } from './dto/update-user-note.dto'
import { NotesService } from './notes.service'

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  create(@Body() dto: CreateNoteDto) {
    return this.notesService.create(dto)
  }

  @Get()
  list(@Query('category') category?: string, @Query('search') search?: string) {
    return this.notesService.list({ category, search })
  }

  @Get(':id/user-notes')
  listUserNotes(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.notesService.listUserNotes(id)
  }

  @Post(':id/user-notes')
  @UseInterceptors(FilesInterceptor('images', 10, { limits: { fileSize: 5 * 1024 * 1024 } }))
  createUserNote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateUserNoteDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.notesService.createUserNote(id, dto, files ?? [])
  }

  @Patch(':id/user-notes/:userNoteId')
  @UseInterceptors(FilesInterceptor('images', 10, { limits: { fileSize: 5 * 1024 * 1024 } }))
  updateUserNote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userNoteId', new ParseUUIDPipe()) userNoteId: string,
    @Body() dto: UpdateUserNoteDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.notesService.updateUserNote(id, userNoteId, dto, files ?? [])
  }

  @Delete(':id/user-notes/:userNoteId')
  removeUserNote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userNoteId', new ParseUUIDPipe()) userNoteId: string,
  ) {
    return this.notesService.softDeleteUserNote(id, userNoteId)
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.notesService.detail(id)
  }

  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateNoteDto) {
    return this.notesService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.notesService.softDelete(id)
  }
}

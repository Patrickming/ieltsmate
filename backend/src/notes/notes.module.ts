import { Module } from '@nestjs/common'
import { NotesController } from './notes.controller'
import { NoteUserImageStorage } from './note-user-image.storage'
import { NotesService } from './notes.service'

@Module({
  controllers: [NotesController],
  providers: [NotesService, NoteUserImageStorage],
})
export class NotesModule {}

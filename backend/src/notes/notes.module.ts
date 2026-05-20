import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { DictionaryModule } from '../dictionary/dictionary.module'
import { NotesController } from './notes.controller'
import { NoteUserImageStorage } from './note-user-image.storage'
import { NotesService } from './notes.service'

@Module({
  imports: [DictionaryModule, AiModule],
  controllers: [NotesController],
  providers: [NotesService, NoteUserImageStorage],
  exports: [NotesService],
})
export class NotesModule {}

import { Controller, Get, Module } from '@nestjs/common'
import { ServeStaticModule } from '@nestjs/serve-static'
import { AiModule } from './ai/ai.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { ExportModule } from './export/export.module'
import { ImportModule } from './import/import.module'
import { FavoritesModule } from './favorites/favorites.module'
import { NotesModule } from './notes/notes.module'
import { PrismaModule } from './prisma/prisma.module'
import { ReviewModule } from './review/review.module'
import { SettingsModule } from './settings/settings.module'
import { TodosModule } from './todos/todos.module'
import { getNotesRoot } from './writing/writing.service'
import { WritingModule } from './writing/writing.module'

@Controller()
class HealthController {
  @Get('/health')
  health() {
    return { status: 'ok' }
  }
}

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: getNotesRoot(),
      serveRoot: '/writing-assets',
      serveStaticOptions: { index: false },
    }),
    PrismaModule,
    NotesModule,
    FavoritesModule,
    ReviewModule,
    SettingsModule,
    AiModule,
    TodosModule,
    DashboardModule,
    ExportModule,
    ImportModule,
    WritingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

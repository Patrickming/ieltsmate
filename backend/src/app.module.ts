import { Controller, Get, Module } from '@nestjs/common'
import { FavoritesModule } from './favorites/favorites.module'
import { NotesModule } from './notes/notes.module'
import { PrismaModule } from './prisma/prisma.module'
import { ReviewModule } from './review/review.module'
import { SettingsModule } from './settings/settings.module'

@Controller()
class HealthController {
  @Get('/health')
  health() {
    return { status: 'ok' }
  }
}

@Module({
  imports: [PrismaModule, NotesModule, FavoritesModule, ReviewModule, SettingsModule],
  controllers: [HealthController],
})
export class AppModule {}

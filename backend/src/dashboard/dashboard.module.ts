import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { SettingsModule } from '../settings/settings.module'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'

@Module({
  imports: [AiModule, SettingsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

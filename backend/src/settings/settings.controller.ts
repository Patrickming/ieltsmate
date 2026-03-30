import { Body, Controller, Get, Patch } from '@nestjs/common'
import { PatchSettingsDto } from './dto/patch-settings.dto'
import { SettingsService } from './settings.service'

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getAll() {
    return this.settingsService.getAll()
  }

  @Patch()
  patch(@Body() dto: PatchSettingsDto) {
    return this.settingsService.patch(dto.settings)
  }
}

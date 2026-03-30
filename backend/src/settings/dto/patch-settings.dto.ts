import { IsObject } from 'class-validator'

export class PatchSettingsDto {
  @IsObject()
  settings!: Record<string, string>
}

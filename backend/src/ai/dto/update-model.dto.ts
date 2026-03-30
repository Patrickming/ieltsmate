import { IsBoolean, IsOptional } from 'class-validator'

export class UpdateModelDto {
  @IsOptional()
  @IsBoolean()
  verified?: boolean

  @IsOptional()
  @IsBoolean()
  isThinking?: boolean

  @IsOptional()
  @IsBoolean()
  isVision?: boolean
}

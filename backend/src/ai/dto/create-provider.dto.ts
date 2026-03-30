import { IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateProviderDto {
  @IsString() @MaxLength(100) name!: string
  @IsString() @MaxLength(100) displayName!: string
  @IsString() @MaxLength(50)  presetId!: string
  @IsString() @MaxLength(20)  color!: string
  @IsString() @MaxLength(500) baseUrl!: string
  @IsOptional() @IsString() @MaxLength(500) apiKey?: string
}

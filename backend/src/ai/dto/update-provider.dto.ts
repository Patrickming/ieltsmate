import { IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateProviderDto {
  @IsOptional() @IsString() @MaxLength(100) displayName?: string
  @IsOptional() @IsString() @MaxLength(500) baseUrl?: string
  @IsOptional() @IsString() @MaxLength(500) apiKey?: string
  @IsOptional() @IsString() @MaxLength(20)  color?: string
}

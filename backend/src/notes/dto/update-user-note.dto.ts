import { IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateUserNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  content?: string

  @IsOptional()
  @IsString()
  keepImages?: string
}

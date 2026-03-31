import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

class ParsedNoteDto {
  @IsString()
  content!: string

  @IsString()
  translation!: string

  @IsString()
  category!: string

  @IsString()
  @IsOptional()
  phonetic?: string

  @IsString({ each: true })
  @IsOptional()
  synonyms?: string[]

  @IsString({ each: true })
  @IsOptional()
  antonyms?: string[]

  @IsString()
  @IsOptional()
  example?: string

  @IsString()
  @IsOptional()
  memoryTip?: string
}

export class SaveNotesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParsedNoteDto)
  notes!: ParsedNoteDto[]
}

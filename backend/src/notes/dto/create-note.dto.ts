import { ReviewStatus } from '@prisma/client'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'
import { ConfusableGroupDto, PartOfSpeechItemDto } from './note-extension-fields.dto'
import { WordFamilyDto } from './word-family-fields.dto'

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  content!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  translation!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  category!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  phonetic?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  synonyms?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  antonyms?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  example?: string

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  memoryTip?: string

  @IsOptional()
  @IsEnum(ReviewStatus)
  reviewStatus?: ReviewStatus

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartOfSpeechItemDto)
  partsOfSpeech?: PartOfSpeechItemDto[]

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfusableGroupDto)
  confusables?: ConfusableGroupDto[]

  @ValidateIf((_, value) => value !== undefined)
  @ValidateNested()
  @Type(() => WordFamilyDto)
  wordFamily?: WordFamilyDto
}

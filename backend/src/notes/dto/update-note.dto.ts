import { ReviewStatus } from '@prisma/client'
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  content?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  translation?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  category?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  phonetic?: string | null

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
  example?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  memoryTip?: string | null

  @IsOptional()
  @IsEnum(ReviewStatus)
  reviewStatus?: ReviewStatus
}

import { Type } from 'class-transformer'
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'

const POS4 = ['noun', 'verb', 'adjective', 'adverb'] as const

export class WordFamilyBaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  word!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  pos!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  meaning!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  phonetic?: string
}

export class WordFamilyItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  word!: string

  @IsIn(POS4)
  pos!: (typeof POS4)[number]

  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  meaning!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  phonetic?: string
}

export class WordFamilyDerivedDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WordFamilyItemDto)
  noun!: WordFamilyItemDto[]

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WordFamilyItemDto)
  verb!: WordFamilyItemDto[]

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WordFamilyItemDto)
  adjective!: WordFamilyItemDto[]

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WordFamilyItemDto)
  adverb!: WordFamilyItemDto[]
}

export class WordFamilyDto {
  @ValidateNested()
  @Type(() => WordFamilyBaseDto)
  base!: WordFamilyBaseDto

  @ValidateNested()
  @Type(() => WordFamilyDerivedDto)
  derivedByPos!: WordFamilyDerivedDto
}

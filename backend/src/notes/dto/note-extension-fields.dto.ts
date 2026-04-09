import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

export class PartOfSpeechItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  pos!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  label!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  meaning!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @ValidateIf((_, value) => value !== undefined)
  phonetic?: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  @ValidateIf((_, value) => value !== undefined)
  example?: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  @ValidateIf((_, value) => value !== undefined)
  exampleTranslation?: string
}

export class ConfusableWordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  word!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  meaning!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @ValidateIf((_, value) => value !== undefined)
  phonetic?: string
}

export class ConfusableGroupDto {
  @IsIn(['form', 'meaning'])
  kind!: 'form' | 'meaning'

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => ConfusableWordDto)
  words!: ConfusableWordDto[]

  @ValidateIf((o: ConfusableGroupDto) => o.kind === 'meaning')
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  difference?: string
}

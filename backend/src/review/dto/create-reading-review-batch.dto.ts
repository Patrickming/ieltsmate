import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

export class CreateReadingReviewBatchDto {
  @IsIn(['notes', 'favorites'])
  source!: 'notes' | 'favorites'

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  categories?: string[]

  @IsIn(['all', 'wrong', 'exclude_mastered', 'new_only'])
  range!: 'all' | 'wrong' | 'exclude_mastered' | 'new_only'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  articleTarget?: number

  @IsOptional()
  @IsBoolean()
  generateAll?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(599940)
  timeoutSeconds?: number
}

export class ContinueReadingReviewBatchDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  articleTarget?: number

  @IsOptional()
  @IsBoolean()
  generateAll?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(599940)
  timeoutSeconds?: number
}

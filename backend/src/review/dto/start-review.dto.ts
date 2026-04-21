import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class StartReviewDto {
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

  @IsIn(['random', 'continue'])
  mode!: 'random' | 'continue'
}

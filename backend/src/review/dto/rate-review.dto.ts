import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class RateReviewDto {
  @IsUUID()
  noteId!: string

  @IsIn(['easy', 'again'])
  rating!: 'easy' | 'again'

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  spellingAnswer?: string
}

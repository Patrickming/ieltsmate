import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator'

export class RateReviewDto {
  @IsUUID()
  noteId!: string

  @IsIn(['easy', 'again'])
  rating!: 'easy' | 'again'

  @IsOptional()
  @IsString()
  spellingAnswer?: string
}

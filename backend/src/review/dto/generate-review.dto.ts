import { IsIn, IsUUID } from 'class-validator'

export class GenerateReviewDto {
  @IsUUID()
  noteId!: string

  @IsIn(['word-speech', 'phrase', 'synonym', 'sentence', 'spelling'])
  cardType!: 'word-speech' | 'phrase' | 'synonym' | 'sentence' | 'spelling'
}

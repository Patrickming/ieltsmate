import { IsIn, IsUUID } from 'class-validator'
import { CARD_TYPES, CardType } from '../types/card-ai-content'

export class GenerateReviewDto {
  @IsUUID()
  noteId!: string

  @IsIn(CARD_TYPES)
  cardType!: CardType
}

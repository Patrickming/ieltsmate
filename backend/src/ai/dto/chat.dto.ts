import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class ChatMessageDto {
  @IsIn(['user', 'assistant', 'system'])
  role!: 'user' | 'assistant' | 'system'

  @IsString() @MaxLength(100_000)
  content!: string
}

export class ChatDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[]

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string

  @IsOptional()
  @IsIn(['classify', 'review', 'chat'])
  slot?: 'classify' | 'review' | 'chat'
}

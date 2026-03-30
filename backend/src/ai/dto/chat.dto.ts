import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class ChatMessageDto {
  @IsIn(['user', 'assistant', 'system'])
  role!: 'user' | 'assistant' | 'system'

  // Accept string (plain text) or array (multi-modal: text + image_url parts)
  @IsNotEmpty()
  content!: string | unknown[]
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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  searchQuery?: string

  // When true, adds reasoning_effort: "high" to the API call (for o1/o3-style models)
  @IsOptional()
  @IsBoolean()
  enableThinking?: boolean
}

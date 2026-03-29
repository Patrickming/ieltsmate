import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator'

export class CreateUserNoteDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'content must contain non-whitespace characters' })
  @MaxLength(5_000)
  content!: string
}

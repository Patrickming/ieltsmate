import { IsString, MaxLength } from 'class-validator'

export class AddModelDto {
  @IsString() @MaxLength(200) modelId!: string
}

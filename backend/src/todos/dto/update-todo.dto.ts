import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class UpdateTodoDto {
  @IsOptional()
  @IsBoolean()
  done?: boolean

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  text?: string

  @IsOptional()
  @IsInt()
  sortOrder?: number
}

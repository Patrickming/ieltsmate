import { IsInt, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator'

export class CreateTodoDto {
  @IsString()
  @IsNotEmpty()
  text!: string

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '日期格式需为 YYYY-MM-DD' })
  taskDate!: string

  @IsOptional()
  @IsInt()
  sortOrder?: number
}

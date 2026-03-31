import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common'
import { CreateTodoDto } from './dto/create-todo.dto'
import { UpdateTodoDto } from './dto/update-todo.dto'
import { TodosService } from './todos.service'

@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  list(@Query('date') date: string) {
    return this.todosService.listByDate(date)
  }

  @Post()
  create(@Body() dto: CreateTodoDto) {
    return this.todosService.create(dto)
  }

  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateTodoDto) {
    return this.todosService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.todosService.remove(id)
  }
}

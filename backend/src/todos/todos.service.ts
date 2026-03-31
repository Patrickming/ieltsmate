import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { parseCSTDate, formatCSTDate } from '../common/date.util'
import { PrismaService } from '../prisma/prisma.service'
import { CreateTodoDto } from './dto/create-todo.dto'
import { UpdateTodoDto } from './dto/update-todo.dto'

type TxClient = Prisma.TransactionClient

function formatTodo(t: { id: string; text: string; done: boolean; sortOrder: number; taskDate: Date }) {
  return {
    id: t.id,
    text: t.text,
    done: t.done,
    sortOrder: t.sortOrder,
    taskDate: formatCSTDate(t.taskDate),
  }
}

@Injectable()
export class TodosService {
  constructor(private readonly prisma: PrismaService) {}

  async listByDate(dateStr: string) {
    const taskDate = parseCSTDate(dateStr)
    const nextDay = new Date(taskDate.getTime() + 24 * 60 * 60 * 1000)
    const todos = await this.prisma.todo.findMany({
      where: { taskDate: { gte: taskDate, lt: nextDay } },
      orderBy: { sortOrder: 'asc' },
    })
    return todos.map(formatTodo)
  }

  async create(dto: CreateTodoDto) {
    const taskDate = parseCSTDate(dto.taskDate)
    return this.prisma.$transaction(async (tx) => {
      const todo = await tx.todo.create({
        data: {
          text: dto.text,
          taskDate,
          sortOrder: dto.sortOrder ?? 0,
        },
      })
      await this.syncAllTodosDoneForDate(taskDate, tx)
      return formatTodo(todo)
    })
  }

  async update(id: string, dto: UpdateTodoDto) {
    const existing = await this.prisma.todo.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Todo not found')

    if (dto.done === undefined && dto.text === undefined && dto.sortOrder === undefined) {
      return formatTodo(existing)
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.todo.update({
        where: { id },
        data: {
          ...(dto.done !== undefined ? { done: dto.done } : {}),
          ...(dto.text !== undefined ? { text: dto.text } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      })
      await this.syncAllTodosDoneForDate(existing.taskDate, tx)
      return formatTodo(updated)
    })
  }

  async remove(id: string) {
    const existing = await this.prisma.todo.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Todo not found')

    await this.prisma.$transaction(async (tx) => {
      await tx.todo.delete({ where: { id } })
      await this.syncAllTodosDoneForDate(existing.taskDate, tx)
    })

    return null
  }

  private async syncAllTodosDoneForDate(taskDate: Date, tx: TxClient) {
    const nextDay = new Date(taskDate.getTime() + 24 * 60 * 60 * 1000)
    const todos = await tx.todo.findMany({
      where: { taskDate: { gte: taskDate, lt: nextDay } },
    })
    const allDone = todos.length > 0 && todos.every((t) => t.done)
    await tx.dailyActivity.upsert({
      where: { activityDate: taskDate },
      create: { activityDate: taskDate, studyCount: 0, allTodosDone: allDone },
      update: { allTodosDone: allDone },
    })
  }
}

import { BadRequestException, Injectable } from '@nestjs/common'
import { parseCSTDate, todayCSTMidnight, formatCSTDate } from '../common/date.util'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const today = todayCSTMidnight()
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

    const [createdToday, mastered, total] = await Promise.all([
      this.prisma.note.count({
        where: { deletedAt: null, createdAt: { gte: today, lt: tomorrow } },
      }),
      this.prisma.note.count({
        where: { deletedAt: null, reviewStatus: 'mastered' },
      }),
      this.prisma.note.count({ where: { deletedAt: null } }),
    ])

    const streak = await this.calcStreak(today)

    return { createdToday, mastered, streak, total }
  }

  private async calcStreak(today: Date): Promise<number> {
    const MS_PER_DAY = 24 * 60 * 60 * 1000
    const since = new Date(today.getTime() - 364 * MS_PER_DAY)

    const rows = await this.prisma.dailyActivity.findMany({
      where: { activityDate: { gte: since } },
      select: { activityDate: true, studyCount: true },
    })

    const activityMap = new Map<string, number>()
    for (const row of rows) {
      activityMap.set(formatCSTDate(row.activityDate), row.studyCount)
    }

    const todayKey = formatCSTDate(today)
    const todayCount = activityMap.get(todayKey) ?? 0

    // 锚点：今天有复习则从今天算，否则从昨天算
    const anchorOffset = todayCount > 0 ? 0 : 1
    let streak = 0

    for (let i = anchorOffset; i <= 365; i++) {
      const checkDate = new Date(today.getTime() - i * MS_PER_DAY)
      const key = formatCSTDate(checkDate)
      const count = activityMap.get(key) ?? 0
      if (count === 0) break
      streak++
    }

    return streak
  }

  async getActivity(startStr: string, endStr: string) {
    const start = parseCSTDate(startStr)
    const end = parseCSTDate(endStr)

    if (start > end) {
      throw new BadRequestException('start 不能晚于 end')
    }

    const endNextDay = new Date(end.getTime() + 24 * 60 * 60 * 1000)

    const rows = await this.prisma.dailyActivity.findMany({
      where: { activityDate: { gte: start, lt: endNextDay } },
      select: { activityDate: true, studyCount: true, allTodosDone: true },
    })

    const result: Record<string, { studyCount: number; allTodosDone: boolean }> = {}
    for (const row of rows) {
      if (row.studyCount > 0 || row.allTodosDone) {
        result[formatCSTDate(row.activityDate)] = {
          studyCount: row.studyCount,
          allTodosDone: row.allTodosDone,
        }
      }
    }

    return result
  }
}

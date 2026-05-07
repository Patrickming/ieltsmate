import { BadRequestException, Injectable } from '@nestjs/common'
import { AiService } from '../ai/ai.service'
import { parseCSTDate, todayCSTMidnight, formatCSTDate } from '../common/date.util'
import { PrismaService } from '../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'

const DASHBOARD_INSIGHT_KEY = 'dashboardInsightV1'
const INSIGHT_REFRESH_MS = 60 * 60 * 1000

export type DashboardInsightPayload = {
  summary: string
  encouragement: string
  /** 独立一段：雅思听说读写/词汇/应试等实用干货，与错题摘要角度不同 */
  ieltsTip: string
  generatedAt: string
  nextRefreshAt: string
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly settings: SettingsService,
  ) {}

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
      select: { activityDate: true, studyCount: true, allTodosDone: true, hasTodos: true },
    })

    const result: Record<string, { studyCount: number; allTodosDone: boolean; hasTodos: boolean }> = {}
    for (const row of rows) {
      if (row.studyCount > 0 || row.hasTodos) {
        result[formatCSTDate(row.activityDate)] = {
          studyCount: row.studyCount,
          allTodosDone: row.allTodosDone,
          hasTodos: row.hasTodos,
        }
      }
    }

    return result
  }

  /**
   * 仪表盘 AI 洞察：使用设置里「AI 助手」对应的 chat 模型；每 1 小时最多重新生成一次（由服务端持久化 nextRefreshAt）。
   */
  async getOrRefreshInsight(): Promise<DashboardInsightPayload> {
    const settings = await this.settings.getAll()
    const parsed = this.parseStoredInsight(settings[DASHBOARD_INSIGHT_KEY])
    const now = Date.now()
    if (parsed && new Date(parsed.nextRefreshAt).getTime() > now) {
      return parsed
    }
    return this.generateInsight(parsed)
  }

  /**
   * 手动刷新：忽略冷却时间，基于当前缓存内容作为「上一次」生成新版本，并写入新的 nextRefreshAt（+1 小时）。
   */
  async forceRegenerateInsight(): Promise<DashboardInsightPayload> {
    const settings = await this.settings.getAll()
    const previous = this.parseStoredInsight(settings[DASHBOARD_INSIGHT_KEY])
    return this.generateInsight(previous)
  }

  private parseStoredInsight(raw: string | undefined): DashboardInsightPayload | null {
    if (!raw?.trim()) return null
    try {
      const o = JSON.parse(raw) as Partial<DashboardInsightPayload>
      if (
        typeof o.summary === 'string' &&
        typeof o.encouragement === 'string' &&
        typeof o.generatedAt === 'string' &&
        typeof o.nextRefreshAt === 'string'
      ) {
        return {
          ...o,
          ieltsTip: typeof o.ieltsTip === 'string' ? o.ieltsTip : '',
        } as DashboardInsightPayload
      }
    } catch {
      /* ignore */
    }
    return null
  }

  private async pickHighErrorNotes() {
    const notes = await this.prisma.note.findMany({
      where: { deletedAt: null },
      select: {
        content: true,
        translation: true,
        wrongCount: true,
        correctCount: true,
        category: true,
      },
    })

    return notes
      .map((n) => {
        const denom = n.wrongCount + n.correctCount
        const rate = denom > 0 ? n.wrongCount / denom : 0
        return { ...n, rate, denom }
      })
      .filter((n) => n.denom > 0)
      .sort((a, b) => b.rate - a.rate || b.wrongCount - a.wrongCount)
      .slice(0, 18)
  }

  private parseInsightJson(raw: string): {
    summary: string
    encouragement: string
    ieltsTip: string
  } {
    const trimmed = raw.trim()
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = fence ? fence[1].trim() : trimmed
    try {
      const o = JSON.parse(jsonStr) as {
        summary?: unknown
        encouragement?: unknown
        ieltsTip?: unknown
      }
      const summary = typeof o.summary === 'string' ? o.summary : ''
      const encouragement = typeof o.encouragement === 'string' ? o.encouragement : ''
      const ieltsTip = typeof o.ieltsTip === 'string' ? o.ieltsTip : ''
      if (summary || encouragement || ieltsTip) return { summary, encouragement, ieltsTip }
    } catch {
      /* fall through */
    }
    return { summary: trimmed.slice(0, 2000), encouragement: '', ieltsTip: '' }
  }

  private async generateInsight(
    previous: DashboardInsightPayload | null,
  ): Promise<DashboardInsightPayload> {
    const notes = await this.pickHighErrorNotes()
    const prevBlock =
      previous && (previous.summary || previous.encouragement || previous.ieltsTip)
        ? [previous.summary, previous.encouragement, previous.ieltsTip].filter(Boolean).join('\n').trim()
        : ''

    const generatedAt = new Date().toISOString()
    const nextRefreshAt = new Date(Date.now() + INSIGHT_REFRESH_MS).toISOString()

    if (notes.length === 0) {
      const payload: DashboardInsightPayload = {
        summary:
          '目前还没有足够的复习打分记录，无法从数据中归纳「易错释义」。多完成几次复习后，这里会基于你的错题自动总结中文释义层面的薄弱点。',
        encouragement:
          '雅思备考是一段需要耐心与节律的旅程：当你愿意为每一次模糊与失误驻足厘清，分数与语感自会水到渠成。',
        ieltsTip:
          '【口语 Part 2】拿到话题卡后先用 10 秒在草稿上写 3～4 个关键词（时态、人/事/感受），再展开 1～2 分钟独白，可避免跑题与长时间停顿。',
        generatedAt,
        nextRefreshAt,
      }
      await this.settings.patch({ [DASHBOARD_INSIGHT_KEY]: JSON.stringify(payload) })
      return payload
    }

    const payloadJson = notes.map((n) => ({
      english: n.content.slice(0, 400),
      chineseMeaning: n.translation.slice(0, 400),
      category: n.category,
      wrongRate: Math.round(n.rate * 1000) / 1000,
      wrongCount: n.wrongCount,
      gradedAnswers: n.denom,
    }))

    const system = [
      '你是专业的雅思学习顾问。',
      '请严格只输出一段 JSON（不要 markdown 代码围栏），格式：',
      '{"summary":"...","encouragement":"...","ieltsTip":"..."}',
      'summary：用 2～5 句中文，概括用户当前「中文释义/理解」上容易混淆或答错的点，必须紧扣下面给出的笔记数据（可点名若干释义关键词）。',
      'encouragement：单独一句或两句，语气得体、有文采，鼓励用户坚持雅思备考；可中英混用但要有水准。',
      'ieltsTip：单独一段中文（3～6 句），提供与上面错题摘要不同的「雅思实用干货」——可以是听力/阅读/写作/口语任一科的技巧、评分要点、时间分配、常见陷阱、地道表达或词汇辨析；要具体可执行，避免空泛鸡汤。',
      '若提供了「上一次生成内容」，你必须换角度、换措辞、换例子，不得复述或仅做同义替换；ieltsTip 每次也要换主题或角度。',
    ].join('\n')

    const diversityNonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    const user = [
      '以下笔记按错题率从高到低节选（wrongRate 为答错次数/已计分答题次数）：',
      JSON.stringify(payloadJson, null, 0),
      '',
      '上一次生成内容（请避免重复）：',
      prevBlock || '（无）',
      '',
      `随机盐（仅用于促使你换一套表述，不要在输出里引用此串）：${diversityNonce}`,
    ].join('\n')

    let raw: string
    try {
      raw = await this.ai.complete({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        slot: 'chat',
        timeoutMs: 90_000,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (previous) return previous
      const fallback: DashboardInsightPayload = {
        summary: `洞察生成暂时失败：${msg.slice(0, 280)}`,
        encouragement: '请稍后重试，并确认「设置 → AI 模型」中 AI 助手模型可用。',
        ieltsTip:
          '【阅读】判断题（T/F/NG）以原文为准：只有明确同义改写才算 TRUE；未提及才是 NG，勿把「没写」当成 FALSE。',
        generatedAt,
        nextRefreshAt,
      }
      await this.settings.patch({ [DASHBOARD_INSIGHT_KEY]: JSON.stringify(fallback) })
      return fallback
    }

    const { summary, encouragement, ieltsTip } = this.parseInsightJson(raw)
    const payload: DashboardInsightPayload = {
      summary: summary || '（本次摘要为空）',
      encouragement:
        encouragement ||
        '保持节奏，持续练习：雅思之路贵在坚持、复盘与对细节的耐心。',
      ieltsTip:
        ieltsTip ||
        '【写作 Task 2】开头段用 2～3 句完成：背景改写题目 + 明确立场；主体段每段只推进一个中心句，并用例子支撑，避免堆砌抽象形容词。',
      generatedAt,
      nextRefreshAt,
    }
    await this.settings.patch({ [DASHBOARD_INSIGHT_KEY]: JSON.stringify(payload) })
    return payload
  }
}

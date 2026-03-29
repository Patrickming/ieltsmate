import { useMemo } from 'react'

const WEEKS = 40
const CELL = 10
const GAP = 2

interface ActivityHeatmapProps {
  todayAllDone?: boolean
}

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_NAMES_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

function toKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function generateMockActivity(todayKey: string): Record<string, number> {
  const data: Record<string, number> = {}
  const today = new Date(todayKey)
  const totalDays = WEEKS * 7

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = toKey(d)
    const rand = Math.random()
    if (rand < 0.12) data[key] = 0
    else if (rand < 0.40) data[key] = Math.floor(Math.random() * 3) + 1
    else if (rand < 0.72) data[key] = Math.floor(Math.random() * 4) + 4
    else data[key] = Math.floor(Math.random() * 5) + 8
  }
  // Ensure today has activity
  data[todayKey] = Math.floor(Math.random() * 5) + 6
  return data
}

function getCellColor(count: number): string {
  if (count === 0) return '#27272a'
  if (count <= 3) return '#312e81'
  if (count <= 7) return '#4338ca'
  return '#818cf8'
}

// Calculate streaks from activity data
function calcStreaks(activity: Record<string, number>, todayKey: string) {
  const keys = Object.keys(activity).sort()
  let longest = 0
  let current = 0
  let streak = 0

  // Current streak: count backwards from today
  const today = new Date(todayKey)
  for (let i = 0; ; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const k = toKey(d)
    if (activity[k] && activity[k] > 0) {
      current++
    } else {
      break
    }
  }

  // Longest streak
  for (const k of keys) {
    if (activity[k] > 0) {
      streak++
      longest = Math.max(longest, streak)
    } else {
      streak = 0
    }
  }

  return { longest, current }
}

// Find most active month and day
function calcStats(activity: Record<string, number>) {
  const monthTotals: Record<number, number> = {}
  let maxDay = { key: '', count: 0 }

  for (const [key, count] of Object.entries(activity)) {
    if (count === 0) continue
    const month = new Date(key).getMonth()
    monthTotals[month] = (monthTotals[month] ?? 0) + count
    if (count > maxDay.count) maxDay = { key, count }
  }

  let maxMonth = -1
  let maxMonthCount = 0
  for (const [m, c] of Object.entries(monthTotals)) {
    if (c > maxMonthCount) { maxMonthCount = c; maxMonth = Number(m) }
  }

  const mostActiveDay = maxDay.key
    ? new Date(maxDay.key).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    : '—'

  return {
    mostActiveMonth: maxMonth >= 0 ? MONTH_NAMES_ZH[maxMonth] : '—',
    mostActiveDay,
  }
}

export function ActivityHeatmap({ todayAllDone = false }: ActivityHeatmapProps) {
  const todayKey = toKey(new Date())

  const activity = useMemo(() => generateMockActivity(todayKey), [todayKey])

  // Build week columns starting from (WEEKS*7) days ago
  const startDate = new Date(todayKey)
  startDate.setDate(startDate.getDate() - (WEEKS * 7 - 1))

  const columns: { date: Date; key: string; count: number }[][] = []
  const cur = new Date(startDate)
  for (let w = 0; w < WEEKS; w++) {
    const week: { date: Date; key: string; count: number }[] = []
    for (let d = 0; d < 7; d++) {
      const key = toKey(cur)
      week.push({ date: new Date(cur), key, count: activity[key] ?? 0 })
      cur.setDate(cur.getDate() + 1)
    }
    columns.push(week)
  }

  // Month label positions: first column index where a new month starts
  const monthMarkers: { weekIdx: number; initial: string }[] = []
  columns.forEach((week, wi) => {
    const d = week[0].date
    const isNewMonth = wi === 0 || d.getDate() <= 7
    if (isNewMonth) {
      const initial = MONTH_INITIALS[d.getMonth()]
      const prev = monthMarkers[monthMarkers.length - 1]
      if (!prev || prev.weekIdx !== wi) {
        monthMarkers.push({ weekIdx: wi, initial })
      }
    }
  })

  const { longest, current } = calcStreaks(activity, todayKey)
  const { mostActiveMonth, mostActiveDay } = calcStats(activity)
  const totalStudied = Object.values(activity).filter((v) => v > 0).length

  const svgW = WEEKS * (CELL + GAP) - GAP
  const svgH = 7 * (CELL + GAP) - GAP

  // Weekday label rows: only M(1), W(3), F(5) — index 0=Sun
  const LABEL_ROWS: Record<number, string> = { 1: 'M', 3: 'W', 5: 'F' }
  const LEFT_PAD = 18

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold text-text-primary">{totalStudied}</span>
        <span className="text-sm text-text-subtle">天学习记录</span>
      </div>

      {/* Grid area */}
      <div style={{ paddingLeft: LEFT_PAD }}>
        {/* Month labels */}
        <div className="flex" style={{ marginBottom: 4, marginLeft: 0 }}>
          {columns.map((_, wi) => {
            const marker = monthMarkers.find((m) => m.weekIdx === wi)
            return (
              <div
                key={wi}
                style={{ width: CELL + GAP, flexShrink: 0 }}
                className="text-[9px] text-text-subtle font-medium"
              >
                {marker ? marker.initial : ''}
              </div>
            )
          })}
        </div>

        {/* Rows with weekday labels */}
        <div className="relative">
          {/* Weekday labels (absolute, left of SVG) */}
          <div
            className="absolute flex flex-col"
            style={{ left: -LEFT_PAD, top: 0, gap: GAP }}
          >
            {Array.from({ length: 7 }, (_, di) => (
              <div
                key={di}
                style={{ height: CELL, lineHeight: `${CELL}px`, width: LEFT_PAD - 4 }}
                className="text-[9px] text-text-subtle text-right"
              >
                {LABEL_ROWS[di] ?? ''}
              </div>
            ))}
          </div>

          {/* SVG heatmap */}
          <svg width={svgW} height={svgH} style={{ display: 'block' }}>
            {columns.map((week, wi) =>
              week.map((day, di) => {
                const x = wi * (CELL + GAP)
                const y = di * (CELL + GAP)
                const isToday = day.key === todayKey
                const fill = isToday && todayAllDone
                  ? '#fbbf24'
                  : getCellColor(day.count)
                const stroke = isToday ? (todayAllDone ? '#f59e0b' : '#a5b4fc') : 'none'

                return (
                  <g key={day.key}>
                    <title>{`${day.key} · 复习 ${day.count} 张${isToday && todayAllDone ? ' ★ 今日任务全完成' : ''}`}</title>
                    <rect
                      x={x} y={y}
                      width={CELL} height={CELL}
                      rx={2}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isToday ? 1.5 : 0}
                    />
                  </g>
                )
              })
            )}
          </svg>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 pt-3 border-t border-border">
        {[
          { label: '最活跃月份', value: mostActiveMonth },
          { label: '最活跃日期', value: mostActiveDay },
          { label: '最长连续打卡', value: `${longest}d` },
          { label: '当前连续打卡', value: `${current}d` },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-[11px] text-text-subtle">{label}</span>
            <span className="text-[15px] font-semibold text-text-primary">{value}</span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-text-subtle">Fewer</span>
        {[0, 2, 5, 9].map((v) => (
          <div
            key={v}
            style={{ width: CELL, height: CELL, borderRadius: 2, background: getCellColor(v), flexShrink: 0 }}
          />
        ))}
        <span className="text-[10px] text-text-subtle">More</span>
      </div>
    </div>
  )
}

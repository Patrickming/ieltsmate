import { useMemo, useRef, useState, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'

const WEEKS = 52          // full year
const GAP   = 3           // gap between cells (px, in SVG units)
const LEFT_LABEL_W = 22   // space reserved for Mon/Wed/Fri labels
const TOP_LABEL_H  = 18   // space reserved for month labels

interface ActivityHeatmapProps {
  todayAllDone?: boolean
}

const MONTH_INITIALS = ['J','F','M','A','M','J','J','A','S','O','N','D']
const MONTH_NAMES_ZH = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const LABEL_ROWS: Record<number, string> = { 1: 'M', 3: 'W', 5: 'F' }

function getCSTDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

function getCellColor(count: number): string {
  if (count === 0) return '#27272a'
  if (count <= 3)  return '#312e81'
  if (count <= 7)  return '#4338ca'
  return '#818cf8'
}

function calcStreaks(activity: Record<string, number>, todayKey: string) {
  const keys = Object.keys(activity).sort()
  let longest = 0, current = 0, streak = 0
  const today = new Date(todayKey + 'T00:00:00+08:00')
  for (let i = 0; ; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    if (activity[getCSTDateString(d)] > 0) current++; else break
  }
  for (const k of keys) {
    if (activity[k] > 0) { streak++; longest = Math.max(longest, streak) }
    else streak = 0
  }
  return { longest, current }
}

function calcStats(activity: Record<string, number>) {
  const monthTotals: Record<number, number> = {}
  let maxDay = { key: '', count: 0 }
  for (const [key, count] of Object.entries(activity)) {
    if (count === 0) continue
    const month = new Date(key).getMonth()
    monthTotals[month] = (monthTotals[month] ?? 0) + count
    if (count > maxDay.count) maxDay = { key, count }
  }
  let maxMonth = -1, maxMonthCount = 0
  for (const [m, c] of Object.entries(monthTotals)) {
    if (c > maxMonthCount) { maxMonthCount = c; maxMonth = Number(m) }
  }
  return {
    mostActiveMonth: maxMonth >= 0 ? MONTH_NAMES_ZH[maxMonth] : '—',
    mostActiveDay: maxDay.key
      ? new Date(maxDay.key).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
      : '—',
  }
}

export function ActivityHeatmap({ todayAllDone: todayAllDoneProp = false }: ActivityHeatmapProps) {
  const todayKey = getCSTDateString(new Date())
  const { activity: storeActivity, loadActivity, activityLoading } = useAppStore()

  useEffect(() => {
    const end = todayKey
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - (WEEKS * 7 - 1))
    const start = getCSTDateString(startDate)
    void loadActivity(start, end)
  }, [todayKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const activity = useMemo(() => {
    const map: Record<string, number> = {}
    for (const [key, val] of Object.entries(storeActivity)) {
      map[key] = val.studyCount
    }
    return map
  }, [storeActivity])

  const todayAllDoneFromStore = storeActivity[todayKey]?.allTodosDone ?? false
  const todayAllDone = todayAllDoneFromStore || todayAllDoneProp

  // ── Measure container width ──────────────────────────────
  const wrapRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(600)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    setContainerW(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Derive cell size from container width so grid fills perfectly
  const availW = containerW - LEFT_LABEL_W - GAP
  const CELL = Math.max(8, Math.floor((availW + GAP) / WEEKS) - GAP)

  // ── Build columns ───────────────────────────────────────
  const startDate = new Date(todayKey + 'T00:00:00+08:00')
  startDate.setDate(startDate.getDate() - (WEEKS * 7 - 1))
  const columns: { date: Date; key: string; count: number }[][] = []
  const cur = new Date(startDate)
  for (let w = 0; w < WEEKS; w++) {
    const week: { date: Date; key: string; count: number }[] = []
    for (let d = 0; d < 7; d++) {
      const key = getCSTDateString(cur)
      week.push({ date: new Date(cur), key, count: activity[key] ?? 0 })
      cur.setDate(cur.getDate() + 1)
    }
    columns.push(week)
  }

  // Month markers
  const monthMarkers: { weekIdx: number; initial: string }[] = []
  columns.forEach((week, wi) => {
    const d = week[0].date
    if (wi === 0 || d.getDate() <= 7) {
      const initial = MONTH_INITIALS[d.getMonth()]
      const prev = monthMarkers[monthMarkers.length - 1]
      if (!prev || prev.weekIdx !== wi) monthMarkers.push({ weekIdx: wi, initial })
    }
  })

  const { longest, current } = calcStreaks(activity, todayKey)
  const { mostActiveMonth, mostActiveDay } = calcStats(activity)
  const totalStudied = Object.values(activity).filter(v => v > 0).length

  // SVG dimensions (everything inside one SVG including labels)
  const svgW = LEFT_LABEL_W + WEEKS * (CELL + GAP) - GAP
  const svgH = TOP_LABEL_H + 7 * (CELL + GAP) - GAP

  if (activityLoading && Object.keys(storeActivity).length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-6 w-32 rounded bg-[#27272a] animate-pulse" />
        <div className="h-[120px] rounded-lg bg-[#27272a] animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold text-text-primary">{totalStudied}</span>
        <span className="text-sm text-text-subtle">天学习记录</span>
      </div>

      {/* SVG fills the full width */}
      <div ref={wrapRef} className="w-full">
        <svg
          width="100%"
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          preserveAspectRatio="xMinYMin meet"
          style={{ display: 'block', overflow: 'visible' }}
        >
          {/* ── Month labels ── */}
          {monthMarkers.map(({ weekIdx, initial }) => (
            <text
              key={weekIdx}
              x={LEFT_LABEL_W + weekIdx * (CELL + GAP)}
              y={TOP_LABEL_H - 5}
              fontSize={9}
              fill="#52525b"
              fontFamily="Inter, Arial, sans-serif"
              fontWeight={500}
            >
              {initial}
            </text>
          ))}

          {/* ── Weekday labels (M / W / F) ── */}
          {Array.from({ length: 7 }, (_, di) => LABEL_ROWS[di] && (
            <text
              key={di}
              x={LEFT_LABEL_W - 4}
              y={TOP_LABEL_H + di * (CELL + GAP) + CELL * 0.75}
              fontSize={9}
              fill="#52525b"
              fontFamily="Inter, Arial, sans-serif"
              textAnchor="end"
            >
              {LABEL_ROWS[di]}
            </text>
          ))}

          {/* ── Cells ── */}
          {columns.map((week, wi) =>
            week.map((day, di) => {
              const x = LEFT_LABEL_W + wi * (CELL + GAP)
              const y = TOP_LABEL_H + di * (CELL + GAP)
              const isToday = day.key === todayKey
              const fill   = isToday && todayAllDone ? '#fbbf24' : getCellColor(day.count)
              const stroke = isToday ? (todayAllDone ? '#f59e0b' : '#a5b4fc') : 'none'
              return (
                <g key={day.key}>
                  <title>{`${day.key} · 复习 ${day.count} 张${isToday && todayAllDone ? ' ★ 今日任务全完成' : ''}`}</title>
                  <rect
                    x={x} y={y}
                    width={CELL} height={CELL}
                    rx={Math.max(1, CELL * 0.2)}
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

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 pt-3 border-t border-border">
        {[
          { label: '最活跃月份',  value: mostActiveMonth },
          { label: '最活跃日期',  value: mostActiveDay },
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
        {[0, 2, 5, 9].map(v => (
          <div key={v} style={{ width: 10, height: 10, borderRadius: 2, background: getCellColor(v), flexShrink: 0 }} />
        ))}
        <span className="text-[10px] text-text-subtle">More</span>
      </div>
    </div>
  )
}

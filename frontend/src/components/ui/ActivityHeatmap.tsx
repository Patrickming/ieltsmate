import { useMemo, useRef, useState, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'

const GAP          = 3
const LEFT_LABEL_W = 26   // 中文星期标签宽度
const TOP_LABEL_H  = 20   // 月份标签高度

const MONTH_NAMES_ZH = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const LABEL_ROWS: Record<number, string> = { 1: '一', 3: '三', 5: '五' }

const RANGE_OPTIONS = [
  { label: '3个月', weeks: 13 },
  { label: '半年',  weeks: 26 },
  { label: '一年',  weeks: 52 },
] as const

interface DayData {
  date: Date
  key: string
  count: number
  allDone: boolean
}

interface TooltipState {
  x: number
  y: number
  day: DayData
}

interface ActivityHeatmapProps {
  todayAllDone?: boolean
}

function getCSTDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

function getCellColor(count: number, allDone: boolean): string {
  if (allDone) return '#fbbf24'      // 任务全完成 → 黄色
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

function formatTooltipDate(key: string): string {
  const d = new Date(key + 'T12:00:00+08:00')
  const weekNames = ['日','一','二','三','四','五','六']
  return `${key}  周${weekNames[d.getDay()]}`
}

export function ActivityHeatmap({ todayAllDone: todayAllDoneProp = false }: ActivityHeatmapProps) {
  const todayKey = getCSTDateString(new Date())
  const { activity: storeActivity, loadActivity, activityLoading } = useAppStore()

  const [rangeWeeks, setRangeWeeks] = useState<13 | 26 | 52>(52)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // 切换时间范围时重新拉数据
  useEffect(() => {
    const end = todayKey
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - (rangeWeeks * 7 - 1))
    const start = getCSTDateString(startDate)
    void loadActivity(start, end)
  }, [todayKey, rangeWeeks]) // eslint-disable-line react-hooks/exhaustive-deps

  // 构建 activityMap（包含 allDone）
  const activityMap = useMemo(() => {
    const map: Record<string, { count: number; allDone: boolean }> = {}
    for (const [key, val] of Object.entries(storeActivity)) {
      map[key] = { count: val.studyCount, allDone: val.allTodosDone }
    }
    return map
  }, [storeActivity])

  const todayAllDoneFromStore = storeActivity[todayKey]?.allTodosDone ?? false
  const todayAllDone = todayAllDoneFromStore || todayAllDoneProp

  // 容器宽度监听
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

  const availW = containerW - LEFT_LABEL_W - GAP
  const CELL = Math.max(8, Math.floor((availW + GAP) / rangeWeeks) - GAP)

  // 构建列数据
  const startDate = new Date(todayKey + 'T00:00:00+08:00')
  startDate.setDate(startDate.getDate() - (rangeWeeks * 7 - 1))
  const columns: DayData[][] = []
  const cur = new Date(startDate)
  for (let w = 0; w < rangeWeeks; w++) {
    const week: DayData[] = []
    for (let d = 0; d < 7; d++) {
      const key = getCSTDateString(cur)
      const isToday = key === todayKey
      const stored = activityMap[key]
      week.push({
        date: new Date(cur),
        key,
        count: stored?.count ?? 0,
        allDone: isToday ? todayAllDone : (stored?.allDone ?? false),
      })
      cur.setDate(cur.getDate() + 1)
    }
    columns.push(week)
  }

  // 月份标记（最小间隔 3 周，避免重叠）
  const monthMarkers: { weekIdx: number; label: string }[] = []
  columns.forEach((week, wi) => {
    const d = week[0].date
    if (wi === 0 || d.getDate() <= 7) {
      const label = MONTH_NAMES_ZH[d.getMonth()]
      const prev = monthMarkers[monthMarkers.length - 1]
      if (!prev || wi - prev.weekIdx >= 3) {
        monthMarkers.push({ weekIdx: wi, label })
      }
    }
  })

  // 统计
  const plainActivity: Record<string, number> = {}
  for (const [k, v] of Object.entries(activityMap)) plainActivity[k] = v.count
  const { longest, current } = calcStreaks(plainActivity, todayKey)
  const { mostActiveMonth, mostActiveDay } = calcStats(plainActivity)
  const totalStudied = Object.values(activityMap).filter(v => v.count > 0).length

  const svgW = LEFT_LABEL_W + rangeWeeks * (CELL + GAP) - GAP
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
      {/* Header：学习天数 + 范围选择器 */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-text-primary">{totalStudied}</span>
          <span className="text-sm text-text-subtle">天学习记录</span>
        </div>
        <div className="flex items-center gap-1">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.weeks}
              onClick={() => setRangeWeeks(opt.weeks as 13 | 26 | 52)}
              className={[
                'px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors',
                rangeWeeks === opt.weeks
                  ? 'bg-indigo-600 text-white'
                  : 'text-text-subtle hover:text-text-primary hover:bg-surface-hover',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* SVG 热力图 */}
      <div ref={wrapRef} className="w-full relative">
        <svg
          width="100%"
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          preserveAspectRatio="xMinYMin meet"
          style={{ display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* 月份标签 */}
          {monthMarkers.map(({ weekIdx, label }) => (
            <text
              key={weekIdx}
              x={LEFT_LABEL_W + weekIdx * (CELL + GAP)}
              y={TOP_LABEL_H - 5}
              fontSize={9}
              fill="#52525b"
              fontFamily="system-ui, sans-serif"
              fontWeight={500}
            >
              {label}
            </text>
          ))}

          {/* 星期标签（一/三/五） */}
          {Array.from({ length: 7 }, (_, di) => LABEL_ROWS[di] && (
            <text
              key={di}
              x={LEFT_LABEL_W - 4}
              y={TOP_LABEL_H + di * (CELL + GAP) + CELL * 0.75}
              fontSize={9}
              fill="#52525b"
              fontFamily="system-ui, sans-serif"
              textAnchor="end"
            >
              {LABEL_ROWS[di]}
            </text>
          ))}

          {/* 格子 */}
          {columns.map((week, wi) =>
            week.map((day, di) => {
              const x = LEFT_LABEL_W + wi * (CELL + GAP)
              const y = TOP_LABEL_H + di * (CELL + GAP)
              const isToday = day.key === todayKey
              const fill   = getCellColor(day.count, day.allDone)
              const stroke = isToday
                ? (day.allDone ? '#f59e0b' : '#a5b4fc')
                : 'none'
              return (
                <rect
                  key={day.key}
                  x={x} y={y}
                  width={CELL} height={CELL}
                  rx={Math.max(1, CELL * 0.2)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isToday ? 1.5 : 0}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, day })}
                  onMouseMove={(e)  => setTooltip({ x: e.clientX, y: e.clientY, day })}
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })
          )}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{ left: tooltip.x + 12, top: tooltip.y - 64 }}
          >
            <div className="bg-[#18181b] border border-[#3f3f46] rounded-lg px-3 py-2 shadow-xl min-w-[130px]">
              <div className="text-[11px] text-text-subtle mb-1 whitespace-nowrap">
                {formatTooltipDate(tooltip.day.key)}
              </div>
              <div className="text-[13px] font-semibold text-text-primary">
                {tooltip.day.count > 0
                  ? `复习了 ${tooltip.day.count} 张卡片`
                  : '未复习'}
              </div>
              {tooltip.day.allDone && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                  <span>★</span>
                  <span>任务全部完成</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 底部统计 */}
      <div className="grid grid-cols-4 gap-4 pt-3 border-t border-border">
        {[
          { label: '最活跃月份',  value: mostActiveMonth },
          { label: '最活跃日期',  value: mostActiveDay },
          { label: '最长连续打卡', value: `${longest} 天` },
          { label: '当前连续打卡', value: `${current} 天` },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-[11px] text-text-subtle">{label}</span>
            <span className="text-[15px] font-semibold text-text-primary">{value}</span>
          </div>
        ))}
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-subtle">少</span>
        {[0, 2, 5, 9].map(v => (
          <div
            key={v}
            style={{ width: 10, height: 10, borderRadius: 2, background: getCellColor(v, false), flexShrink: 0 }}
          />
        ))}
        <span className="text-[10px] text-text-subtle">多</span>
        <div className="ml-3 flex items-center gap-1.5">
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#fbbf24', flexShrink: 0 }} />
          <span className="text-[10px] text-text-subtle">任务全完成</span>
        </div>
      </div>
    </div>
  )
}

import { useMemo, useRef, useState, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'

const GAP          = 3
const LEFT_LABEL_W = 26
const TOP_LABEL_H  = 20
const MAX_WEEKS    = 104  // 最多展示 2 年

const MONTH_NAMES_ZH = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const LABEL_ROWS: Record<number, string> = { 1: '一', 3: '三', 5: '五' }

const PRESET_OPTIONS = [
  { label: '3个月', weeks: 13 },
  { label: '半年',  weeks: 26 },
  { label: '一年',  weeks: 52 },
] as const

type PresetWeeks = 13 | 26 | 52

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

  // ── 范围状态 ──
  const [mode, setMode] = useState<'preset' | 'custom'>('preset')
  const [presetWeeks, setPresetWeeks] = useState<PresetWeeks>(52)
  // 自定义模式：默认显示最近 3 个月到今天
  const defaultCustomStart = (() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3)
    return getCSTDateString(d)
  })()
  const [customStart, setCustomStart] = useState(defaultCustomStart)
  const [customEnd,   setCustomEnd]   = useState(todayKey)
  // 自定义模式暂存（点应用后才生效）
  const [pendingStart, setPendingStart] = useState(defaultCustomStart)
  const [pendingEnd,   setPendingEnd]   = useState(todayKey)

  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // ── 推导当前视图的起止日期 & 周数 ──
  const { viewStart, viewEnd, weeksCount } = useMemo(() => {
    if (mode === 'custom') {
      const s = new Date(customStart + 'T00:00:00+08:00')
      const e = new Date(customEnd   + 'T00:00:00+08:00')
      if (s > e) return { viewStart: customEnd, viewEnd: customEnd, weeksCount: 1 }
      const dayDiff = Math.round((e.getTime() - s.getTime()) / 86_400_000)
      const wks = Math.min(MAX_WEEKS, Math.ceil(dayDiff / 7) + 1)
      // 从周日/周一对齐起点
      const aligned = new Date(s)
      aligned.setDate(aligned.getDate() - aligned.getDay())
      return {
        viewStart: getCSTDateString(aligned),
        viewEnd: customEnd,
        weeksCount: wks,
      }
    }
    // preset
    const endDate = new Date(todayKey + 'T00:00:00+08:00')
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - (presetWeeks * 7 - 1))
    return {
      viewStart: getCSTDateString(startDate),
      viewEnd: todayKey,
      weeksCount: presetWeeks,
    }
  }, [mode, presetWeeks, customStart, customEnd, todayKey])

  // 范围变化时拉取数据
  useEffect(() => {
    void loadActivity(viewStart, viewEnd)
  }, [viewStart, viewEnd]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── activityMap ──
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

    let raf1 = 0
    let raf2 = 0

    const commitWidth = (nextWidth: number) => {
      if (nextWidth > 0) {
        setContainerW(Math.round(nextWidth))
      }
    }

    const measureNow = () => {
      const rectW = el.getBoundingClientRect().width
      commitWidth(rectW || el.clientWidth)
    }

    // 部分场景首帧宽度会读到 0（如路由切换/动画阶段），补两帧重测兜底。
    measureNow()
    raf1 = requestAnimationFrame(() => {
      measureNow()
      raf2 = requestAnimationFrame(measureNow)
    })

    const ro = new ResizeObserver(([entry]) => commitWidth(entry.contentRect.width))
    ro.observe(el)

    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [])

  const availW = containerW - LEFT_LABEL_W - GAP
  const CELL = Math.max(6, Math.floor((availW + GAP) / weeksCount) - GAP)

  // ── 构建列数据 ──
  const columns: DayData[][] = useMemo(() => {
    const cols: DayData[][] = []
    const cur = new Date(viewStart + 'T00:00:00+08:00')
    for (let w = 0; w < weeksCount; w++) {
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
      cols.push(week)
    }
    return cols
  }, [viewStart, weeksCount, activityMap, todayKey, todayAllDone])

  // 月份标记
  const monthMarkers = useMemo(() => {
    const markers: { weekIdx: number; label: string }[] = []
    columns.forEach((week, wi) => {
      const d = week[0].date
      if (wi === 0 || d.getDate() <= 7) {
        const label = MONTH_NAMES_ZH[d.getMonth()]
        const prev = markers[markers.length - 1]
        if (!prev || wi - prev.weekIdx >= 3) {
          markers.push({ weekIdx: wi, label })
        }
      }
    })
    return markers
  }, [columns])

  // 统计
  const plainActivity: Record<string, number> = {}
  for (const [k, v] of Object.entries(activityMap)) plainActivity[k] = v.count
  const { longest, current } = calcStreaks(plainActivity, todayKey)
  const { mostActiveMonth, mostActiveDay } = calcStats(plainActivity)
  const totalStudied = Object.values(activityMap).filter(v => v.count > 0).length

  const svgW = LEFT_LABEL_W + weeksCount * (CELL + GAP) - GAP
  const svgH = TOP_LABEL_H + 7 * (CELL + GAP) - GAP

  // 应用自定义范围
  function applyCustomRange() {
    if (!pendingStart || !pendingEnd) return
    const s = pendingStart <= pendingEnd ? pendingStart : pendingEnd
    const e = pendingStart <= pendingEnd ? pendingEnd   : pendingStart
    setCustomStart(s)
    setCustomEnd(e)
  }

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-text-primary">{totalStudied}</span>
          <span className="text-sm text-text-subtle">天学习记录</span>
        </div>

        {/* 范围选择器 */}
        <div className="flex items-center gap-1 flex-wrap">
          {PRESET_OPTIONS.map(opt => (
            <button
              key={opt.weeks}
              onClick={() => { setMode('preset'); setPresetWeeks(opt.weeks) }}
              className={[
                'px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors',
                mode === 'preset' && presetWeeks === opt.weeks
                  ? 'bg-indigo-600 text-white'
                  : 'text-text-subtle hover:text-text-primary hover:bg-[#27272a]',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setMode('custom')}
            className={[
              'px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors',
              mode === 'custom'
                ? 'bg-indigo-600 text-white'
                : 'text-text-subtle hover:text-text-primary hover:bg-[#27272a]',
            ].join(' ')}
          >
            自定义
          </button>
        </div>
      </div>

      {/* 自定义范围日期选择器 */}
      {mode === 'custom' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-text-subtle">从</span>
          <input
            type="date"
            value={pendingStart}
            max={pendingEnd || todayKey}
            onChange={e => setPendingStart(e.target.value)}
            className="h-7 px-2 rounded-lg text-[11px] bg-[#27272a] border border-[#3f3f46] text-text-primary outline-none focus:border-indigo-500 transition-colors"
            style={{ colorScheme: 'dark' }}
          />
          <span className="text-[11px] text-text-subtle">到</span>
          <input
            type="date"
            value={pendingEnd}
            min={pendingStart}
            max={todayKey}
            onChange={e => setPendingEnd(e.target.value)}
            className="h-7 px-2 rounded-lg text-[11px] bg-[#27272a] border border-[#3f3f46] text-text-primary outline-none focus:border-indigo-500 transition-colors"
            style={{ colorScheme: 'dark' }}
          />
          <button
            onClick={applyCustomRange}
            disabled={!pendingStart || !pendingEnd}
            className="h-7 px-3 rounded-lg text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
          >
            应用
          </button>
          {(customStart !== defaultCustomStart || customEnd !== todayKey) && (
            <button
              onClick={() => {
                setPendingStart(defaultCustomStart)
                setPendingEnd(todayKey)
                setCustomStart(defaultCustomStart)
                setCustomEnd(todayKey)
              }}
              className="h-7 px-2 rounded-lg text-[11px] text-text-subtle hover:text-text-muted transition-colors"
            >
              重置
            </button>
          )}
        </div>
      )}

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
                  onMouseEnter={(e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    setTooltip({ x: r.left + r.width / 2, y: r.top, day })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })
          )}
        </svg>

        {/* Tooltip — 锚定在格子正上方，不随鼠标移动，避免频繁重渲 */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none -translate-x-1/2"
            style={{ left: tooltip.x, top: tooltip.y - 8, transform: 'translate(-50%, -100%)' }}
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

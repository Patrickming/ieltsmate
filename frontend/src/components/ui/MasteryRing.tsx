import type { Note } from '../../data/mockData'

interface MasteryRingProps {
  notes: Note[]
}

const SIZE = 120
const STROKE = 14
const R = (SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * R
const CX = SIZE / 2
const CY = SIZE / 2

const SEGMENTS = [
  { key: 'mastered' as const, label: '已掌握', color: '#34d399', bg: '#022c22' },
  { key: 'learning' as const, label: '学习中', color: '#818cf8', bg: '#1e1b4b' },
  { key: 'new'      as const, label: '新词',   color: '#52525b', bg: '#27272a' },
]

export function MasteryRing({ notes }: MasteryRingProps) {
  const total = notes.length

  const counts = {
    mastered: notes.filter((n) => n.reviewStatus === 'mastered').length,
    learning: notes.filter((n) => n.reviewStatus === 'learning').length,
    new:      notes.filter((n) => n.reviewStatus === 'new').length,
  }

  let offset = 0
  const arcs = SEGMENTS.map((seg) => {
    const frac = total > 0 ? counts[seg.key] / total : 0
    const len = frac * CIRC
    const arc = { ...seg, len, dasharray: `${len} ${CIRC - len}`, dashoffset: CIRC / 4 - offset }
    offset += len
    return arc
  })

  const masteredPct = total > 0 ? Math.round((counts.mastered / total) * 100) : 0

  return (
    <div className="flex flex-col gap-4">
      <span className="text-sm font-semibold text-text-secondary">掌握进度</span>

      {/* Ring — centered */}
      <div className="flex justify-center">
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE}>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#27272a" strokeWidth={STROKE} />
            {arcs.map((arc) =>
              arc.len > 0 ? (
                <circle
                  key={arc.key}
                  cx={CX} cy={CY} r={R}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={STROKE}
                  strokeDasharray={arc.dasharray}
                  strokeDashoffset={arc.dashoffset}
                  strokeLinecap="butt"
                  style={{ transition: 'stroke-dasharray 0.5s ease' }}
                />
              ) : null
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[20px] font-bold text-text-primary leading-none">{masteredPct}%</span>
            <span className="text-[10px] text-text-subtle mt-0.5">已掌握</span>
          </div>
        </div>
      </div>

      {/* Stats rows */}
      <div className="flex flex-col gap-2">
        {SEGMENTS.map((seg) => {
          const count = counts[seg.key]
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div key={seg.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
                  <span className="text-[12px] text-text-muted">{seg.label}</span>
                </div>
                <span className="text-[12px] font-medium text-text-muted">{count} <span className="text-text-subtle font-normal opacity-60 text-[11px]">{pct}%</span></span>
              </div>
              {/* Progress bar */}
              <div className="h-1 rounded-full bg-[#27272a] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: seg.color }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-border pt-2.5 text-center">
        <span className="text-[11px] text-text-subtle">共 <span className="text-text-muted font-medium">{total}</span> 条笔记</span>
      </div>
    </div>
  )
}

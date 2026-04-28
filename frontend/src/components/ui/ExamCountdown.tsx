import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, X } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'

const STORAGE_KEY = 'ieltsmate-exam-date'
/** 考试日目标时间：该日 00:00（东八区自然日界），按满 24 小时为「一天」 */
function examTargetMs(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00+08:00`).getTime()
}

function loadStoredDate(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

const RING_SIZE = 112
const STROKE = 8
const R = (RING_SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * R
const CX = RING_SIZE / 2
const CY = RING_SIZE / 2

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

function splitRemaining(ms: number) {
  if (ms <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 }
  }
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return { days, hours, minutes, seconds, totalMs: ms }
}

interface DigitCellProps {
  value: number
  label: string
  narrow?: boolean
}

function DigitCell({ value, label, narrow }: DigitCellProps) {
  const str = narrow ? pad2(value) : String(value)
  return (
    <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
      <div className="relative w-full rounded-lg bg-[#27272a]/80 border border-border/80 overflow-hidden py-2 px-1">
        <motion.span
          key={str}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="block text-center text-[18px] sm:text-[20px] font-bold tabular-nums text-text-primary leading-none tracking-tight"
        >
          {str}
        </motion.span>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            background:
              'linear-gradient(180deg, rgba(129,140,248,0.5) 0%, transparent 55%)',
          }}
        />
      </div>
      <span className="text-[10px] text-text-subtle font-medium">{label}</span>
    </div>
  )
}

export function ExamCountdown() {
  const reduceMotion = useReducedMotion()
  const [dateStr, setDateStr] = useState<string | null>(loadStoredDate)
  const [now, setNow] = useState(() => Date.now())
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const targetMs = dateStr ? examTargetMs(dateStr) : null
  const remaining = targetMs != null ? targetMs - now : null
  const parts = remaining != null ? splitRemaining(remaining) : null

  const ringProgress = useMemo(() => {
    if (remaining == null || remaining <= 0) return 0
    return Math.min(1, remaining / YEAR_MS)
  }, [remaining])

  const strokeDashoffset = CIRC * (1 - ringProgress)

  const persist = useCallback((next: string | null) => {
    setDateStr(next)
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const onPickDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    if (v) persist(v)
  }

  const handleClear = () => {
    persist(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const examPassed = targetMs != null && remaining != null && remaining <= 0
  const formattedDate = dateStr
    ? new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      }).format(new Date(`${dateStr}T12:00:00+08:00`))
    : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-text-secondary">考试倒计时</span>
        <div className="flex items-center gap-1 shrink-0">
          <input
            ref={fileInputRef}
            type="date"
            className="sr-only"
            aria-label="选择考试日期"
            value={dateStr ?? ''}
            onChange={onPickDate}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.showPicker?.() ?? fileInputRef.current?.click()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-[#27272a]/50 text-text-muted hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
            title="选择考试日期"
          >
            <Calendar size={15} strokeWidth={2} />
          </button>
          {dateStr && (
            <button
              type="button"
              onClick={handleClear}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-[#27272a]/50 text-text-muted hover:border-rose-500/40 hover:text-rose-400 hover:bg-rose-500/5 transition-all"
              title="清除日期"
            >
              <X size={15} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {!dateStr ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.showPicker?.() ?? fileInputRef.current?.click()}
          className="rounded-xl border border-dashed border-border/60 bg-[#141416]/60 py-8 px-3 text-center transition-colors hover:border-primary/35 hover:bg-primary/[0.04]"
        >
          <p className="text-[13px] text-text-muted">点击选择你的 IELTS 考试日期</p>
          <p className="text-[11px] text-text-subtle mt-1.5">默认以考试日当天 00:00（北京时间，自然日界）为截止</p>
        </button>
      ) : (
        <>
          <p className="text-[11px] text-text-subtle text-center leading-snug -mt-1">{formattedDate}</p>

          <div className="flex flex-col items-center gap-3">
            <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
              {!reduceMotion && (
                <motion.div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    inset: -6,
                    background:
                      'radial-gradient(circle, rgba(129,140,248,0.25) 0%, transparent 65%)',
                  }}
                  animate={
                    examPassed
                      ? { opacity: 0.25, scale: 1 }
                      : { opacity: [0.35, 0.65, 0.35], scale: [1, 1.03, 1] }
                  }
                  transition={
                    examPassed
                      ? { duration: 0.3 }
                      : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
                  }
                />
              )}
              <svg width={RING_SIZE} height={RING_SIZE} className="relative z-[1]">
                <defs>
                  <linearGradient id="exam-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="50%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <circle
                  cx={CX}
                  cy={CY}
                  r={R}
                  fill="none"
                  stroke="#27272a"
                  strokeWidth={STROKE}
                />
                <motion.circle
                  cx={CX}
                  cy={CY}
                  r={R}
                  fill="none"
                  stroke="url(#exam-ring-grad)"
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  transform={`rotate(-90 ${CX} ${CY})`}
                  initial={false}
                  animate={{
                    strokeDashoffset: examPassed ? CIRC : strokeDashoffset,
                  }}
                  transition={{ type: 'spring', stiffness: 55, damping: 16 }}
                  style={{
                    filter: examPassed ? undefined : 'drop-shadow(0 0 6px rgba(129,140,248,0.35))',
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-[2]">
                {examPassed ? (
                  <span className="text-[12px] font-semibold text-text-muted text-center px-2">
                    已到考试时间
                  </span>
                ) : (
                  <>
                    <motion.span
                      key={parts?.days ?? 0}
                      initial={{ opacity: 0.5, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.25 }}
                      className="text-[28px] font-bold tabular-nums leading-none text-text-primary"
                      style={{ textShadow: '0 0 24px rgba(129,140,248,0.35)' }}
                    >
                      {parts?.days ?? 0}
                    </motion.span>
                    <span className="text-[10px] text-text-subtle mt-0.5 font-medium">天</span>
                  </>
                )}
              </div>
            </div>

            {!examPassed && parts && (
              <div className="grid grid-cols-3 gap-2 w-full">
                <DigitCell value={parts.hours} label="时" narrow />
                <DigitCell value={parts.minutes} label="分" narrow />
                <DigitCell value={parts.seconds} label="秒" narrow />
              </div>
            )}

            {examPassed && (
              <p className="text-[11px] text-text-subtle text-center leading-relaxed">
                可重新选择日期以开始新的倒计时
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

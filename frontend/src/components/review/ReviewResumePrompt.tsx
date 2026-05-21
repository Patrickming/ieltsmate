import { Play } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'

type ReviewResumePromptProps = {
  variant?: 'banner' | 'compact'
  className?: string
}

/** 有进行中的复习（内存或 sessionStorage 快照）时展示「继续当前复习」 */
export function ReviewResumePrompt({
  variant = 'banner',
  className = '',
}: ReviewResumePromptProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const reviewSession = useAppStore((s) => s.reviewSession)
  const getPausedReviewMeta = useAppStore((s) => s.getPausedReviewMeta)
  const resumePausedReviewSession = useAppStore((s) => s.resumePausedReviewSession)

  // 已在卡片复习页时不展示（避免侧栏重复入口）
  if (location.pathname === '/review/cards') return null

  const meta = getPausedReviewMeta()
  if (!meta && !reviewSession) return null

  const remaining = meta?.remaining ?? reviewSession?.cards.length ?? 0
  const warmed = meta?.warmed ?? 0
  const position = meta
    ? meta.current + meta.completedOffset + 1
    : (reviewSession?.current ?? 0) + (reviewSession?.completedOffset ?? 0) + 1
  const total = meta
    ? meta.remaining + meta.completedOffset
    : (reviewSession?.cards.length ?? 0) + (reviewSession?.completedOffset ?? 0)

  const handleResume = () => {
    if (!reviewSession) {
      const ok = resumePausedReviewSession()
      if (!ok) return
    }
    navigate('/review/cards')
  }

  if (variant === 'compact') {
    return (
      <div className={`block ${className}`}>
        <button
          type="button"
          onClick={handleResume}
          title={`继续当前复习 · 进度 ${position}/${total}`}
          className="group relative mx-2 mb-0.5 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-md px-3 py-2 text-left transition-[color,background-color] duration-200 ease-out active:scale-[0.985] motion-reduce:active:scale-100"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-md border border-[#34d399]/28 bg-gradient-to-br from-[#0d2818] via-[#122a1f] to-[#141420] shadow-[inset_0_1px_0_rgba(52,211,153,0.08)]"
          />
          <div
            aria-hidden
            className="absolute left-0 top-1.5 bottom-1.5 z-10 w-[3px] rounded-full bg-[#34d399] shadow-[0_0_12px_rgba(52,211,153,0.55)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-md bg-[#34d399]/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          />
          <Play
            size={15}
            className="relative z-10 mt-px shrink-0 text-[#6ee7b7] ml-0.5"
          />
          <span className="relative z-10 min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-semibold text-[#d1fae5]">
              继续当前复习
            </span>
            <span className="mt-0.5 block text-[10px] font-medium tabular-nums text-[#6ee7b7]/75">
              进度 {position}/{total}
            </span>
          </span>
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-primary/30 bg-[#1a1a3e]/80 px-4 py-3.5 ${className}`}
      style={{ boxShadow: '0 0 20px rgba(79,70,229,0.12)' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#c7d2fe]">你有进行中的复习</p>
        <p className="text-[12px] text-text-dim mt-0.5 leading-relaxed">
          还剩 {remaining} 张
          {warmed > 0 && !reviewSession?.skipAi && meta?.skipAi !== true
            ? ` · 已预热 ${warmed} 张 AI 内容`
            : ''}
          ，进度约 {position}/{total}。离开页面不会丢失本场预热。
        </p>
      </div>
      <button
        type="button"
        onClick={handleResume}
        className="shrink-0 inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold text-white transition-all"
        style={{
          background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
          boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
        }}
      >
        <Play size={14} />
        继续当前复习
      </button>
    </div>
  )
}

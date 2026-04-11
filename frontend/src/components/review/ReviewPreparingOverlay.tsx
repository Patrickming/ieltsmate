import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, Sparkles } from 'lucide-react'

interface ReviewPreparingOverlayProps {
  open: boolean
  done: number
  total: number
  phase: 'starting' | 'preparing'
}

export function ReviewPreparingOverlay({ open, done, total, phase }: ReviewPreparingOverlayProps) {
  const safeTotal = Math.max(total, 1)
  const progress = Math.min(100, Math.round((done / safeTotal) * 100))
  const preparing = phase === 'preparing'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-[#080810]/92 backdrop-blur-md flex items-center justify-center"
        >
          <div className="relative w-[min(520px,92vw)] rounded-3xl border border-[#312e81] bg-[#0d1025] p-8 overflow-hidden shadow-[0_0_60px_rgba(79,70,229,0.25)]">
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.6, 0.35] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
              className="pointer-events-none absolute -inset-20 bg-[radial-gradient(circle,rgba(129,140,248,0.35)_0%,rgba(79,70,229,0)_65%)]"
            />

            <motion.div
              animate={{ x: ['-25%', '125%'] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'linear' }}
              className="pointer-events-none absolute top-0 h-px w-1/2 bg-gradient-to-r from-transparent via-[#818cf8] to-transparent"
            />

            <div className="relative flex items-center gap-2 text-[#a5b4fc] text-xs tracking-[1.5px] uppercase font-semibold">
              <Sparkles size={14} />
              {preparing ? 'AI 联想生成中' : '复习会话启动中'}
            </div>

            <div className="relative mt-5 flex items-center gap-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                className="w-14 h-14 rounded-2xl border border-[#4f46e5] bg-[#1b1f43] flex items-center justify-center"
              >
                <Cpu size={24} className="text-[#818cf8]" />
              </motion.div>
              <div className="min-w-0">
                <div className="text-xl font-semibold text-[#e0e7ff]">
                  {preparing ? '正在预热首批复习联想' : '正在创建复习会话'}
                </div>
                <div className="text-sm text-[#a5b4fc]/80 mt-1">
                  {preparing ? '请稍候，完成后将自动进入第一张卡片' : '正在加载复习卡池与上下文信息'}
                </div>
              </div>
            </div>

            <div className="relative mt-7">
              <div className="h-2.5 rounded-full bg-[#1f2547] border border-[#312e81] overflow-hidden">
                {total > 0 ? (
                  // 不用 spring：轮询很快时弹簧会严重滞后，出现「文字 80% / 条只有一节」的错位
                  <div
                    className="h-full max-w-full bg-gradient-to-r from-[#4f46e5] via-[#6366f1] to-[#818cf8] transition-[width] duration-200 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                ) : (
                  <motion.div
                    animate={{ x: ['-100%', '220%'] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                    className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#818cf8] to-transparent"
                  />
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-[#a5b4fc]/90">
                {total > 0 ? (
                  <>
                    <span>已完成 {done}/{total}</span>
                    <span>{progress}%</span>
                  </>
                ) : (
                  <>
                    <span>会话初始化中</span>
                    <span>...</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

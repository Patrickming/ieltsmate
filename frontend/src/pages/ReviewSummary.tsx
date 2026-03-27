import { useNavigate } from 'react-router-dom'
import { Trophy, RotateCcw, Home, CheckCircle2, XCircle, Minus } from 'lucide-react'
import { motion } from 'framer-motion'
import { Layout } from '../components/layout/Layout'
import { useAppStore } from '../store/useAppStore'

export default function ReviewSummary() {
  const navigate = useNavigate()
  const { reviewSession, endReview, notes } = useAppStore()

  const results = reviewSession?.results ?? []
  const easy = results.filter((r) => r.rating === 'easy').length
  const hard = results.filter((r) => r.rating === 'hard').length
  const again = results.filter((r) => r.rating === 'again').length
  const total = results.length

  const accuracy = total > 0 ? Math.round((easy / total) * 100) : 0

  const handleHome = () => {
    endReview()
    navigate('/')
  }

  const handleReview = () => {
    const failed = results.filter((r) => r.rating !== 'easy')
    const cards = failed.map((r) => notes.find((n) => n.id === r.id)).filter(Boolean) as typeof notes
    if (cards.length > 0) {
      useAppStore.getState().startReview(cards)
      navigate('/review/cards')
    }
  }

  return (
    <Layout title="复习总结">
      <div className="flex flex-col items-center justify-center min-h-full p-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 80, damping: 16 }}
          className="w-full max-w-lg"
        >
          {/* Trophy */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              initial={{ rotateY: -90 }}
              animate={{ rotateY: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="w-16 h-16 rounded-full bg-[#1e1b4b] flex items-center justify-center mb-4"
            >
              <Trophy size={28} className="text-primary" />
            </motion.div>
            <h1 className="text-2xl font-bold text-text-primary">复习完成！</h1>
            <p className="text-text-dim text-sm mt-1">
              {accuracy >= 80 ? '太棒了，保持下去！' : accuracy >= 50 ? '继续努力！' : '没关系，多复习几遍就好'}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: '掌握', count: easy, color: '#34d399', bg: '#064e3b', icon: CheckCircle2 },
              { label: '模糊', count: hard, color: '#fbbf24', bg: '#2a1f0a', icon: Minus },
              { label: '不会', count: again, color: '#fb7185', bg: '#450a0a', icon: XCircle },
            ].map(({ label, count, color, bg, icon: Icon }) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border"
                style={{ background: bg, borderColor: color + '60' }}
              >
                <Icon size={20} style={{ color }} />
                <span className="text-2xl font-bold" style={{ color }}>{count}</span>
                <span className="text-xs text-text-dim">{label}</span>
              </motion.div>
            ))}
          </div>

          {/* Accuracy */}
          <div className="bg-surface-card border border-border rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-text-muted">掌握率</span>
              <span className="font-semibold text-text-primary">{accuracy}%</span>
            </div>
            <div className="h-2 bg-[#27272a] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: accuracy >= 80 ? '#34d399' : accuracy >= 50 ? '#fbbf24' : '#fb7185' }}
                initial={{ width: 0 }}
                animate={{ width: `${accuracy}%` }}
                transition={{ delay: 0.3, duration: 0.6 }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleHome}
              className="flex-1 flex items-center justify-center gap-2 h-10 bg-surface-card border border-border rounded-sm text-text-muted hover:text-text-secondary text-sm transition-colors"
            >
              <Home size={15} />
              返回首页
            </button>
            {again + hard > 0 && (
              <button
                onClick={handleReview}
                className="flex-1 flex items-center justify-center gap-2 h-10 bg-primary-btn hover:bg-[#4338ca] rounded-sm text-white text-sm font-medium transition-colors"
              >
                <RotateCcw size={15} />
                再练 {again + hard} 张
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </Layout>
  )
}

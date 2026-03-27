import { useNavigate } from 'react-router-dom'
import { RefreshCw, Home } from 'lucide-react'
import { motion } from 'framer-motion'
import { Layout } from '../components/layout/Layout'
import { useAppStore } from '../store/useAppStore'
import { CATEGORY_BAR, type Category } from '../data/mockData'

export default function ReviewSummary() {
  const navigate = useNavigate()
  const { reviewSession, endReview, startReview, notes } = useAppStore()

  const results = reviewSession?.results ?? []
  const cards = reviewSession?.cards ?? []
  const total = results.length || cards.length
  const correct = results.filter((r) => r.rating === 'easy').length
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  // Category breakdown
  const catStats: Record<string, { correct: number; total: number }> = {}
  cards.forEach((card) => {
    const cat = card.category
    if (!catStats[cat]) catStats[cat] = { correct: 0, total: 0 }
    catStats[cat].total++
  })
  results.forEach((r) => {
    const card = cards.find((c) => c.id === r.id)
    if (card && r.rating === 'easy') {
      catStats[card.category].correct++
    }
  })

  // Simulated saved extensions count
  const savedExtensions = results.length > 0 ? Math.floor(results.length * 0.6) : 0

  const handleHome = () => {
    endReview()
    navigate('/')
  }

  const handleAgain = () => {
    const wrongCards = results
      .filter((r) => r.rating === 'again')
      .map((r) => notes.find((n) => n.id === r.id))
      .filter(Boolean) as typeof notes

    if (wrongCards.length > 0) {
      startReview(wrongCards)
      navigate('/review/cards')
    } else {
      startReview(cards)
      navigate('/review/cards')
    }
  }

  return (
    <Layout title="复习总结">
      <div className="flex items-center justify-center min-h-full p-8">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 80, damping: 16 }}
          className="w-full max-w-[560px] bg-surface-card border border-border rounded-2xl p-10 flex flex-col gap-7"
        >
          {/* Title */}
          <h1 className="text-2xl font-bold text-text-primary text-center">本轮复习完成 🎉</h1>

          {/* Big stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center gap-1.5 py-5 rounded-xl" style={{ background: '#1e1e28' }}>
              <span className="text-4xl font-bold text-primary">{total}</span>
              <span className="text-sm text-text-dim">复习张数</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 py-5 rounded-xl" style={{ background: '#1e2e22' }}>
              <span className="text-4xl font-bold text-cat-phrase">{accuracy}%</span>
              <span className="text-sm text-text-dim">正确率</span>
            </div>
          </div>

          {/* Category stats */}
          {Object.keys(catStats).length > 0 && (
            <div className="bg-[#18181b] rounded-xl p-4 flex flex-col gap-2.5">
              <div className="text-xs font-semibold text-text-muted mb-1">分类统计</div>
              {Object.entries(catStats).map(([cat, { correct: c, total: t }]) => (
                <div key={cat} className="flex items-center gap-3">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: CATEGORY_BAR[cat as Category] ?? '#71717a' }}
                  />
                  <span className="text-sm text-text-muted flex-1">{cat}</span>
                  <span className="text-sm font-medium" style={{ color: '#fbbf24' }}>
                    {c}/{t} 正确
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Saved extensions */}
          {savedExtensions > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-[#1e1e2e] border border-primary/20 rounded-lg">
              <span className="text-sm text-text-muted">本次新增延伸知识</span>
              <span className="text-lg font-bold text-primary">{savedExtensions} 条</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleHome}
              className="flex-1 flex items-center justify-center gap-2 h-11 border border-border rounded-lg text-text-muted hover:text-text-secondary hover:bg-[#27272a] text-sm transition-colors"
            >
              <Home size={15} />
              返回首页
            </button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleAgain}
              className="flex-1 flex items-center justify-center gap-2 h-11 bg-primary-btn hover:bg-[#4338ca] rounded-lg text-white text-sm font-semibold transition-colors"
            >
              <RefreshCw size={15} />
              再来一轮
            </motion.button>
          </div>
        </motion.div>
      </div>
    </Layout>
  )
}

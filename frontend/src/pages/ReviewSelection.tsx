import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CirclePlay, RotateCcw } from 'lucide-react'
import { motion } from 'framer-motion'
import { Layout } from '../components/layout/Layout'
import { CATEGORY_BAR, CATEGORIES, type Category } from '../data/mockData'
import { useAppStore } from '../store/useAppStore'

export default function ReviewSelection() {
  const navigate = useNavigate()
  const { notes, startReview } = useAppStore()
  const [selected, setSelected] = useState<Set<Category | '全部'>>(new Set(['全部']))

  const toggle = (cat: Category | '全部') => {
    if (cat === '全部') {
      setSelected(new Set(['全部']))
      return
    }
    const next = new Set(selected)
    next.delete('全部')
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    if (next.size === 0) next.add('全部')
    setSelected(next)
  }

  const reviewableNotes = notes.filter((n) => {
    if (selected.has('全部')) return true
    return selected.has(n.category as Category)
  })

  const dueCount = reviewableNotes.filter((n) => n.dueToday || n.reviewStatus === 'new').length

  const handleStart = () => {
    const cards = reviewableNotes.filter((n) => n.dueToday || n.reviewStatus === 'new')
    if (cards.length === 0) return
    startReview(cards)
    navigate('/review/cards')
  }

  return (
    <Layout title="复习">
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-text-primary">开始复习</h1>
        <p className="text-sm text-text-dim mt-1 mb-8">选择要复习的分类</p>

        {/* Category selector */}
        <div className="flex flex-col gap-3 mb-8">
          {/* All */}
          <motion.button
            whileTap={{ scale: 0.99 }}
            onClick={() => toggle('全部')}
            className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
              selected.has('全部')
                ? 'border-primary bg-[#1e1b4b]'
                : 'border-border bg-surface-card hover:border-border-strong'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="flex-1 text-left text-sm font-medium text-text-secondary">全部分类</span>
            <span className="text-xs text-text-dim">{notes.length} 条</span>
            {selected.has('全部') && (
              <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            )}
          </motion.button>

          {CATEGORIES.map(({ name }) => {
            const count = notes.filter((n) => n.category === name).length
            const isSelected = selected.has(name)
            const color = CATEGORY_BAR[name]

            return (
              <motion.button
                key={name}
                whileTap={{ scale: 0.99 }}
                onClick={() => toggle(name)}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-primary bg-[#1e1b4b]'
                    : 'border-border bg-surface-card hover:border-border-strong'
                }`}
              >
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="flex-1 text-left text-sm font-medium text-text-secondary">{name}</span>
                <span className="text-xs text-text-dim">{count} 条</span>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                  isSelected ? 'border-primary bg-primary' : 'border-border'
                }`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* Summary + Start */}
        <div className="bg-surface-card border border-border rounded-lg p-5 flex items-center gap-4">
          <RotateCcw size={20} className="text-primary shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-text-secondary">本次复习</div>
            <div className="text-xs text-text-dim mt-0.5">{dueCount} 张待复习卡片</div>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleStart}
            disabled={dueCount === 0}
            className="flex items-center gap-2 h-9 px-5 bg-primary-btn hover:bg-[#4338ca] disabled:opacity-50 disabled:cursor-not-allowed rounded-sm text-white text-sm font-medium transition-colors"
          >
            <CirclePlay size={15} />
            开始复习
          </motion.button>
        </div>
      </div>
    </Layout>
  )
}

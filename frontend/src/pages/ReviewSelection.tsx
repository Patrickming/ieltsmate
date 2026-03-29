import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NotebookPen, Heart, Play, Shuffle, RotateCcw, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { Layout } from '../components/layout/Layout'
import { CATEGORY_BAR, type Category } from '../data/mockData'
import { useAppStore } from '../store/useAppStore'

const SUB_CATS: Category[] = ['口语', '短语', '同义替换', '拼写', '单词']

type Range = 'all' | 'wrong'
type Mode = 'random' | 'continue'

export default function ReviewSelection() {
  const navigate = useNavigate()
  const { notes, favorites, startReview } = useAppStore()
  const [bigCat, setBigCat] = useState<'杂笔记' | '收藏夹'>('杂笔记')
  const [subCats, setSubCats] = useState<Set<Category | '全部'>>(new Set(['全部']))
  const [range, setRange] = useState<Range>('all')
  const [mode, setMode] = useState<Mode>('random')

  const toggleSub = (cat: Category | '全部') => {
    if (cat === '全部') {
      setSubCats(new Set(['全部']))
      return
    }
    const next = new Set(subCats)
    next.delete('全部')
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    if (next.size === 0) next.add('全部')
    setSubCats(next)
  }

  // Count by category
  const countCat = (cat: Category) => notes.filter((n) => n.category === cat).length
  const countAll = notes.filter((n) => n.subcategory === '杂笔记').length
  const countFav = favorites.length

  const getFilteredNotes = () => {
    let pool = bigCat === '收藏夹'
      ? notes.filter((n) => favorites.includes(n.id))
      : notes.filter((n) => n.subcategory === '杂笔记')
    if (bigCat === '杂笔记' && !subCats.has('全部')) {
      pool = pool.filter((n) => subCats.has(n.category as Category))
    }
    if (range === 'wrong') {
      pool = pool.filter((n) => (n.wrongCount ?? 0) > 0)
    }
    if (mode === 'random') {
      pool = [...pool].sort(() => Math.random() - 0.5)
    }
    return pool
  }

  const reviewCards = getFilteredNotes()

  const handleStart = () => {
    if (reviewCards.length === 0) return
    startReview(reviewCards)
    navigate('/review/cards')
  }

  return (
    <Layout title="复习">
      <div className="p-8 flex flex-col gap-8 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">开始复习</h1>
          <p className="text-sm text-text-dim mt-1">选择复习内容和方式</p>
        </div>

        {/* Step 1: Big category */}
        <div className="flex flex-col gap-3">
          <div className="text-xs font-semibold text-text-subtle uppercase tracking-wide">选择大分类</div>
          <div className="grid grid-cols-2 gap-4">
            {([
              { key: '杂笔记', icon: NotebookPen, count: countAll, desc: '口语、短语、单词等' },
              { key: '收藏夹', icon: Heart, count: countFav, desc: '已收藏的笔记' },
            ] as const).map(({ key, icon: Icon, count, desc }) => (
              <motion.button
                key={key}
                whileTap={{ scale: 0.98 }}
                onClick={() => setBigCat(key)}
              className={`flex items-center gap-4 p-5 rounded-xl border transition-all text-left ${
                  bigCat === key
                    ? key === '收藏夹'
                      ? 'bg-[#2e1a1a] border-[#ef4444]'
                      : 'bg-[#1e1e2e] border-primary'
                    : 'bg-surface-card border-border hover:border-border-strong'
                }`}
            >
              <Icon
                size={24}
                className={bigCat === key ? (key === '收藏夹' ? 'text-[#ef4444]' : 'text-primary') : 'text-text-dim'}
                fill={bigCat === key && key === '收藏夹' ? '#ef4444' : 'none'}
              />
                <div>
                  <div className={`text-base font-semibold ${bigCat === key ? 'text-text-primary' : 'text-text-muted'}`}>{key}</div>
                  <div className={`text-xs mt-0.5 ${bigCat === key ? (key === '收藏夹' ? 'text-[#ef4444]' : 'text-primary') : 'text-text-dim'}`}>
                    {count > 0 ? `${count} 张待复习` : desc}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Step 2: Sub-category pills (only for 杂笔记; 收藏夹 has no sub-cats) */}
        {bigCat === '杂笔记' && (
          <div className="flex flex-col gap-3">
            <div className="text-xs font-semibold text-text-subtle uppercase tracking-wide">选择子分类</div>
            <div className="flex flex-wrap gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleSub('全部')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  subCats.has('全部')
                    ? 'bg-primary-btn border-primary text-white'
                    : 'border-border text-text-dim hover:border-border-strong'
                }`}
              >
                全部 {countAll}
              </motion.button>
              {SUB_CATS.map((cat) => {
                const isSelected = subCats.has(cat)
                const color = CATEGORY_BAR[cat]
                return (
                  <motion.button
                    key={cat}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleSub(cat)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      isSelected ? '' : 'border-border text-text-dim hover:border-border-strong'
                    }`}
                    style={isSelected ? {
                      background: color + '22',
                      borderColor: color,
                      color,
                    } : {}}
                  >
                    {cat} {countCat(cat)}
                  </motion.button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 3: Range */}
        <div className="flex flex-col gap-3">
          <div className="text-xs font-semibold text-text-subtle uppercase tracking-wide">选择复习范围</div>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'all', label: '全部复习', desc: '复习所有内容' },
              { key: 'wrong', label: '仅复习错误的', desc: '展示上次标记错误的内容' },
            ] as const).map(({ key, label, desc }) => (
              <motion.button
                key={key}
                whileTap={{ scale: 0.98 }}
                onClick={() => setRange(key)}
                className={`flex flex-col gap-1 p-4 rounded-lg border transition-all text-left ${
                  range === key
                    ? 'bg-[#1e1e2e] border-primary'
                    : 'bg-surface-card border-border hover:border-border-strong'
                }`}
              >
                <span className={`text-sm font-medium ${range === key ? 'text-text-primary' : 'text-text-muted'}`}>{label}</span>
                <span className="text-xs text-text-dim">{desc}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Step 4: Mode */}
        <div className="flex flex-col gap-3">
          <div className="text-xs font-semibold text-text-subtle uppercase tracking-wide">复习模式</div>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'random', icon: Shuffle, label: '随机顺序复习' },
              { key: 'continue', icon: RotateCcw, label: '继续上次复习' },
            ] as const).map(({ key, icon: Icon, label }) => (
              <motion.button
                key={key}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMode(key)}
                className={`flex items-center gap-3 p-4 rounded-lg border transition-all text-left ${
                  mode === key
                    ? 'bg-[#1e1e2e] border-primary'
                    : 'bg-surface-card border-border hover:border-border-strong'
                }`}
              >
                <Icon size={16} className={mode === key ? 'text-primary' : 'text-text-dim'} />
                <span className={`text-sm font-medium ${mode === key ? 'text-text-primary' : 'text-text-muted'}`}>{label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Summary + Start */}
        <div className="flex items-center gap-4 bg-surface-card border border-border rounded-xl p-5">
          <div className="flex-1">
            <div className="text-xs text-text-dim mb-1">当前筛选出 · 将复习</div>
            <div className="flex items-baseline gap-1.5">
              {reviewCards.length > 0 ? (
                <span className="text-3xl font-bold text-primary">{reviewCards.length}</span>
              ) : (
                <AlertCircle size={20} className="text-[#fbbf24]" />
              )}
              <span className="text-sm text-text-muted">张</span>
            </div>
            {reviewCards.length === 0 && (
              <p className="text-xs text-[#fbbf24] mt-1">该筛选条件下暂无内容</p>
            )}
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleStart}
            disabled={reviewCards.length === 0}
            className="flex items-center gap-2 h-11 px-7 bg-primary-btn hover:bg-[#4338ca] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-base font-semibold transition-colors"
          >
            <Play size={16} fill="white" />
            开始复习
          </motion.button>
        </div>
      </div>
    </Layout>
  )
}

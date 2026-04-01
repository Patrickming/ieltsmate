import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  NotebookPen, Heart, Play, Shuffle, RotateCcw,
  AlertCircle, CheckCheck, XCircle, ChevronRight, GraduationCap, ArrowDownUp,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layout } from '../components/layout/Layout'
import { CATEGORY_BAR, type Category } from '../data/mockData'
import { useAppStore, type StartReviewParams } from '../store/useAppStore'

const SUB_CATS: Category[] = ['口语', '短语', '同义替换', '拼写', '单词']

type Range = 'all' | 'wrong' | 'exclude_mastered'
type Order = 'random' | 'sequential'
type Mode = 'random' | 'continue'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

function loadContinueProgress() {
  try {
    const raw = localStorage.getItem('ielts_review_progress')
    if (!raw) return null
    const p = JSON.parse(raw) as { cardOrder: string[]; completedIds: string[]; timestamp: number; sessionParams?: StartReviewParams }
    if (Date.now() - p.timestamp > 7 * 24 * 60 * 60 * 1000) { localStorage.removeItem('ielts_review_progress'); return null }
    return p
  } catch { return null }
}

export default function ReviewSelection() {
  const navigate = useNavigate()
  const { notes, favorites, startReviewSession } = useAppStore()
  const [bigCat, setBigCat] = useState<'杂笔记' | '收藏夹'>('杂笔记')
  const [subCats, setSubCats] = useState<Set<Category | '全部'>>(new Set(['全部']))
  const [range, setRange] = useState<Range>('all')
  const [order, setOrder] = useState<Order>('random')
  const [mode, setMode] = useState<Mode>('random')
  const [starting, setStarting] = useState(false)

  const continueProgress = loadContinueProgress()
  const continueRemaining = continueProgress
    ? continueProgress.cardOrder.length - continueProgress.completedIds.length
    : 0

  const toggleSub = (cat: Category | '全部') => {
    if (cat === '全部') { setSubCats(new Set(['全部'])); return }
    const next = new Set(subCats)
    next.delete('全部')
    if (next.has(cat)) next.delete(cat); else next.add(cat)
    if (next.size === 0) next.add('全部')
    setSubCats(next)
  }

  const countCat = (cat: Category) => notes.filter((n) => n.category === cat).length
  const countAll = notes.filter((n) => n.subcategory === '杂笔记').length
  const countFav = favorites.length

  const getFilteredNotes = () => {
    let pool = bigCat === '收藏夹'
      ? notes.filter((n) => favorites.includes(n.id))
      : notes.filter((n) => n.subcategory === '杂笔记')
    if (bigCat === '杂笔记' && !subCats.has('全部'))
      pool = pool.filter((n) => subCats.has(n.category as Category))
    if (range === 'wrong') pool = pool.filter((n) => (n.wrongCount ?? 0) > 0)
    if (range === 'exclude_mastered') pool = pool.filter((n) => n.reviewStatus !== 'mastered')
    return pool
  }

  const reviewCards = getFilteredNotes()

  const handleStart = async () => {
    const isContinue = mode === 'continue'
    const canStart = isContinue ? continueRemaining > 0 : reviewCards.length > 0
    if (!canStart || starting) return
    setStarting(true)

    let params: StartReviewParams
    if (isContinue && continueProgress?.sessionParams) {
      // Use the original session's params so the backend returns the same card pool
      params = { ...continueProgress.sessionParams, mode: 'continue' }
    } else {
      params = {
        source: bigCat === '收藏夹' ? 'favorites' : 'notes',
        range,
        mode,
        order,
      }
      if (bigCat === '杂笔记' && !subCats.has('全部')) {
        params.categories = Array.from(subCats).filter((c) => c !== '全部') as string[]
      }
    }

    const ok = await startReviewSession(params)
    setStarting(false)
    if (ok) {
      navigate('/review/cards')
    } else {
      alert('当前筛选条件下暂无可复习内容，请调整筛选条件')
    }
  }

  return (
    <Layout title="复习">
      <div className="min-h-full" style={{ background: 'radial-gradient(ellipse at 30% 10%, rgba(79,70,229,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(129,140,248,0.04) 0%, transparent 60%)' }}>
        <div className="max-w-3xl mx-auto px-6 pt-10 pb-40">

          {/* ── 页头 ─────────────────────────── */}
          <motion.div variants={stagger} initial="hidden" animate="show" className="mb-10">
            <motion.div variants={fadeUp}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold tracking-[2px] uppercase text-text-subtle">Review</span>
              </div>
              <h1 className="text-[32px] font-bold text-text-primary leading-tight">开始复习</h1>
              <p className="text-sm text-text-dim mt-1.5">配置你的复习方式，然后开始高效记忆</p>
            </motion.div>
          </motion.div>

          <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-8">

            {/* ── Step 1: 大分类 ─────────────────── */}
            <motion.div variants={fadeUp} className="flex flex-col gap-3">
              <SectionLabel step={1} label="选择来源" />
              <div className="grid grid-cols-2 gap-3">
                {([
                  {
                    key: '杂笔记' as const,
                    icon: NotebookPen,
                    count: countAll,
                    desc: '口语 · 短语 · 单词 · 拼写',
                    accent: '#818cf8',
                    activeBg: 'linear-gradient(135deg, #1a1a3e 0%, #1e1b4b 100%)',
                    activeBorder: '#4f46e5',
                    glow: 'rgba(79,70,229,0.25)',
                  },
                  {
                    key: '收藏夹' as const,
                    icon: Heart,
                    count: countFav,
                    desc: '手动标记的重点笔记',
                    accent: '#f87171',
                    activeBg: 'linear-gradient(135deg, #2e1a1a 0%, #3b1e1e 100%)',
                    activeBorder: '#ef4444',
                    glow: 'rgba(239,68,68,0.25)',
                  },
                ]).map(({ key, icon: Icon, count, desc, accent, activeBg, activeBorder, glow }) => {
                  const active = bigCat === key
                  return (
                    <motion.button
                      key={key}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setBigCat(key)}
                      className="relative flex flex-col p-5 rounded-2xl border text-left overflow-hidden transition-colors duration-300"
                      style={{
                        background: active ? activeBg : '#1c1c20',
                        borderColor: active ? activeBorder : '#27272a',
                        boxShadow: active ? `0 0 24px ${glow}, inset 0 1px 0 rgba(255,255,255,0.06)` : '0 1px 3px rgba(0,0,0,0.3)',
                      }}
                    >
                      {/* Glow blob */}
                      {active && (
                        <div className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 blur-2xl transition-opacity duration-500"
                          style={{ background: accent }} />
                      )}

                      {/* Icon row */}
                      <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ background: active ? `${accent}22` : '#27272a', border: `1px solid ${active ? accent + '44' : '#3f3f46'}` }}>
                          <Icon size={17} style={{ color: active ? accent : '#71717a' }} fill={key === '收藏夹' && active ? accent : 'none'} />
                        </div>
                        {active && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: accent }}>
                            <CheckCheck size={10} className="text-white" strokeWidth={3} />
                          </motion.div>
                        )}
                      </div>

                      {/* Count */}
                      <div className="relative z-10 mb-1">
                        <span className="text-3xl font-bold" style={{ color: active ? accent : '#52525b' }}>{count}</span>
                        <span className="text-sm ml-1.5" style={{ color: active ? accent + 'aa' : '#3f3f46' }}>张</span>
                      </div>

                      {/* Label + desc */}
                      <div className="relative z-10">
                        <div className="text-[15px] font-semibold" style={{ color: active ? '#fafafa' : '#71717a' }}>{key}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: active ? accent + '99' : '#3f3f46' }}>{desc}</div>
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>

            {/* ── Step 2: 子分类 ─────────────────── */}
            <AnimatePresence>
              {bigCat === '杂笔记' && (
                <motion.div
                  key="sub-cats"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-3">
                    <SectionLabel step={2} label="筛选子分类" />
                    <div className="flex flex-wrap gap-2">
                      {(['全部', ...SUB_CATS] as (Category | '全部')[]).map((cat) => {
                        const isAll = cat === '全部'
                        const isSelected = subCats.has(cat)
                        const color = isAll ? '#818cf8' : (CATEGORY_BAR[cat as Category] ?? '#818cf8')
                        const cnt = isAll ? countAll : countCat(cat as Category)
                        return (
                          <motion.button
                            key={cat}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => toggleSub(cat)}
                            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all duration-200"
                            style={isSelected ? {
                              background: color + '18',
                              borderColor: color + '66',
                              color,
                            } : {
                              background: 'transparent',
                              borderColor: '#27272a',
                              color: '#52525b',
                            }}
                          >
                            {!isAll && (
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: isSelected ? color : '#3f3f46' }} />
                            )}
                            {cat}
                            <span className="text-[11px] opacity-60">{cnt}</span>
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Step 3: 复习设置 ─────────────── */}
            <motion.div variants={fadeUp} className="flex flex-col gap-4">
              <SectionLabel step={bigCat === '杂笔记' ? 3 : 2} label="复习设置" />

              {/* 主选择：重新开始 / 继续上次 */}
              <div className="grid grid-cols-2 gap-3">
                {/* 重新开始 */}
                {(() => {
                  const active = mode !== 'continue'
                  return (
                    <motion.button
                      whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                      onClick={() => setMode('random')}
                      className="relative flex items-start gap-3 p-4 rounded-xl border text-left transition-colors duration-200 overflow-hidden"
                      style={{
                        background: active ? 'linear-gradient(135deg, #1a1a3e, #1e1b4b)' : '#1c1c20',
                        borderColor: active ? '#4f46e5' : '#27272a',
                        boxShadow: active ? '0 0 16px rgba(79,70,229,0.2)' : 'none',
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center mt-0.5"
                        style={{ background: active ? '#4f46e522' : '#27272a', border: `1px solid ${active ? '#818cf866' : '#3f3f46'}` }}>
                        <Play size={14} className={active ? 'text-primary' : 'text-text-subtle'} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold" style={{ color: active ? '#e0e7ff' : '#71717a' }}>重新开始</div>
                        <div className="text-[11px] mt-0.5" style={{ color: active ? '#818cf877' : '#3f3f46' }}>自定义范围和顺序</div>
                      </div>
                      {active && <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary" />}
                    </motion.button>
                  )
                })()}

                {/* 继续上次 */}
                {(() => {
                  const active = mode === 'continue'
                  const hasRecord = continueRemaining > 0
                  return (
                    <motion.button
                      whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                      onClick={() => setMode('continue')}
                      className="relative flex items-start gap-3 p-4 rounded-xl border text-left transition-colors duration-200 overflow-hidden"
                      style={{
                        background: active ? 'linear-gradient(135deg, #1a1a3e, #1e1b4b)' : '#1c1c20',
                        borderColor: active ? '#4f46e5' : '#27272a',
                        boxShadow: active ? '0 0 16px rgba(79,70,229,0.2)' : 'none',
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center mt-0.5"
                        style={{ background: active ? '#4f46e522' : '#27272a', border: `1px solid ${active ? '#818cf866' : '#3f3f46'}` }}>
                        <RotateCcw size={14} className={active ? 'text-primary' : 'text-text-subtle'} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold" style={{ color: active ? '#e0e7ff' : '#71717a' }}>继续上次</div>
                        <div className="text-[11px] mt-0.5" style={{ color: hasRecord ? (active ? '#818cf8' : '#52525b') : (active ? '#818cf877' : '#3f3f46') }}>
                          {hasRecord ? `还剩 ${continueRemaining} 张未复习` : '暂无上次记录'}
                        </div>
                      </div>
                      {active && <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary" />}
                    </motion.button>
                  )
                })()}
              </div>

              {/* 重新开始的子选项：范围 + 顺序 */}
              <AnimatePresence>
                {mode !== 'continue' && (
                  <motion.div
                    key="fresh-options"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-3 pt-1">
                      {/* 范围 */}
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold tracking-[1.5px] uppercase text-text-subtle">复习范围</span>
                        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #27272a, transparent)' }} />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {([
                          { key: 'all' as const, icon: CheckCheck, label: '全部复习', desc: '复习所有内容' },
                          { key: 'wrong' as const, icon: XCircle, label: '仅复习错题', desc: '上次标记错误的' },
                          { key: 'exclude_mastered' as const, icon: GraduationCap, label: '剔除已掌握', desc: '跳过已掌握内容' },
                        ]).map(({ key, icon: Icon, label, desc }) => {
                          const active = range === key
                          return (
                          <motion.button
                            key={key} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                            onClick={() => setRange(key)}
                            className="relative flex flex-col gap-2.5 p-3.5 rounded-xl border text-left transition-colors duration-200 overflow-hidden"
                            style={{
                              background: active ? 'linear-gradient(135deg, #1a1a3e, #1e1b4b)' : '#1c1c20',
                              borderColor: active ? '#4f46e5' : '#27272a',
                              boxShadow: active ? '0 0 16px rgba(79,70,229,0.2)' : 'none',
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: active ? '#4f46e522' : '#27272a', border: `1px solid ${active ? '#818cf866' : '#3f3f46'}` }}>
                                <Icon size={13} className={active ? 'text-primary' : 'text-text-subtle'} />
                              </div>
                              {active && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[12px] font-semibold leading-tight" style={{ color: active ? '#e0e7ff' : '#71717a' }}>{label}</div>
                              <div className="text-[10px] mt-0.5 leading-tight" style={{ color: active ? '#818cf877' : '#3f3f46' }}>{desc}</div>
                            </div>
                          </motion.button>
                        )})}
                      </div>

                      {/* 剔除已掌握提示 */}
                      {range === 'exclude_mastered' && (() => {
                        const masteredCount = (bigCat === '收藏夹'
                          ? notes.filter(n => favorites.includes(n.id))
                          : notes.filter(n => n.subcategory === '杂笔记')
                        ).filter(n => n.reviewStatus === 'mastered').length
                        return masteredCount > 0 ? (
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px]"
                            style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', color: '#4ade80' }}>
                            <GraduationCap size={11} />
                            <span>将跳过 <strong>{masteredCount}</strong> 张已掌握的笔记</span>
                          </div>
                        ) : null
                      })()}

                      {/* 顺序 */}
                      <div className="flex items-center gap-2 mt-1 mb-0.5">
                        <span className="text-[10px] font-bold tracking-[1.5px] uppercase text-text-subtle">顺序</span>
                        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #27272a, transparent)' }} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          { key: 'random' as const, icon: Shuffle, label: '随机顺序', desc: '打乱顺序复习' },
                          { key: 'sequential' as const, icon: ArrowDownUp, label: '按添加顺序', desc: '按笔记添加时间' },
                        ]).map(({ key, icon: Icon, label, desc }) => {
                          const active = order === key
                          return (
                            <motion.button
                              key={key} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                              onClick={() => setOrder(key)}
                              className="relative flex items-start gap-3 p-4 rounded-xl border text-left transition-colors duration-200 overflow-hidden"
                              style={{
                                background: active ? 'linear-gradient(135deg, #1a1a3e, #1e1b4b)' : '#1c1c20',
                                borderColor: active ? '#4f46e5' : '#27272a',
                                boxShadow: active ? '0 0 16px rgba(79,70,229,0.2)' : 'none',
                              }}
                            >
                              <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center mt-0.5"
                                style={{ background: active ? '#4f46e522' : '#27272a', border: `1px solid ${active ? '#818cf866' : '#3f3f46'}` }}>
                                <Icon size={14} className={active ? 'text-primary' : 'text-text-subtle'} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[13px] font-semibold" style={{ color: active ? '#e0e7ff' : '#71717a' }}>{label}</div>
                                <div className="text-[11px] mt-0.5" style={{ color: active ? '#818cf877' : '#3f3f46' }}>{desc}</div>
                              </div>
                              {active && <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary" />}
                            </motion.button>
                          )
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

          </motion.div>
        </div>

        {/* ── 底部固定栏 ─────────────────────── */}
        <div className="fixed bottom-0 left-60 right-0 z-30 pointer-events-none">
          <div className="max-w-3xl mx-auto px-6 pb-6 pointer-events-auto">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4, ease: 'easeOut' }}
              className="flex items-center gap-5 rounded-2xl border px-6 py-4"
              style={{
                background: 'rgba(24,24,27,0.85)',
                backdropFilter: 'blur(16px)',
                borderColor: '#27272a',
                boxShadow: '0 -4px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
              }}
            >
              {/* Count display */}
              {(() => {
                const isContinue = mode === 'continue'
                const count = isContinue ? continueRemaining : reviewCards.length
                const hasContent = count > 0
                return (
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: hasContent ? '#4f46e5' : '#27272a' }}>
                      {hasContent
                        ? <Play size={14} fill="white" className="text-white ml-0.5" />
                        : <AlertCircle size={14} className="text-text-subtle" />
                      }
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <motion.span
                          key={count}
                          initial={{ scale: 1.3, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.25 }}
                          className="text-2xl font-bold"
                          style={{ color: hasContent ? '#818cf8' : '#52525b' }}
                        >
                          {count}
                        </motion.span>
                        <span className="text-sm text-text-dim">张卡片待复习</span>
                      </div>
                      {!hasContent ? (
                        <p className="text-[11px] text-[#fbbf24]">
                          {isContinue ? '暂无上次记录' : '当前筛选条件下暂无内容'}
                        </p>
                      ) : (
                        <p className="text-[11px] text-text-subtle">
                          {isContinue ? '继续上次 · 断点续复' : `${bigCat} · ${range === 'all' ? '全部' : '仅错题'} · 随机`}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Start button */}
              <motion.button
                whileHover={(mode === 'continue' ? continueRemaining > 0 : reviewCards.length > 0) && !starting ? { scale: 1.02 } : {}}
                whileTap={(mode === 'continue' ? continueRemaining > 0 : reviewCards.length > 0) && !starting ? { scale: 0.97 } : {}}
                onClick={() => { void handleStart() }}
                disabled={(mode === 'continue' ? continueRemaining === 0 : reviewCards.length === 0) || starting}
                className="flex items-center gap-2.5 h-11 px-7 rounded-xl font-semibold text-[15px] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={(() => {
                  const hasContent = mode === 'continue' ? continueRemaining > 0 : reviewCards.length > 0
                  return {
                    background: hasContent ? 'linear-gradient(135deg, #4f46e5, #6d28d9)' : '#27272a',
                    color: hasContent ? '#fff' : '#52525b',
                    boxShadow: hasContent ? '0 4px 20px rgba(79,70,229,0.45)' : 'none',
                  }
                })()}
              >
                <Play size={15} fill="currentColor" />
                {starting ? '加载中...' : '开始复习'}
                {!starting && <ChevronRight size={15} strokeWidth={2.5} />}
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

function SectionLabel({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
        style={{ background: 'linear-gradient(135deg, #4f46e5, #818cf8)', color: '#fff' }}>
        {step}
      </div>
      <span className="text-[11px] font-bold text-text-subtle tracking-[1.5px] uppercase">{label}</span>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #27272a, transparent)' }} />
    </div>
  )
}

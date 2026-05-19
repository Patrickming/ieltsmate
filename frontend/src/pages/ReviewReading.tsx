import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, BookOpen, CheckCheck, ChevronRight, Clock, FileText,
  GraduationCap, Heart, NotebookPen, RotateCcw, Sparkles, StopCircle, XCircle,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Layout } from '../components/layout/Layout'
import { useAppStore } from '../store/useAppStore'
import { CATEGORY_BAR, type Category } from '../data/mockData'

type ArticleTarget = '5' | '10' | 'all' | 'custom'
type SourceType = 'notes' | 'favorites'
type RangeType = 'all' | 'wrong' | 'exclude_mastered' | 'new_only'
type GenerateMode = 'new' | 'continue'
const SUB_CATS: Category[] = ['口语', '短语', '同义替换', '拼写', '单词']
const DEFAULT_TIMEOUT_SECONDS = 30 * 60
const VERY_LONG_TIMEOUT_SECONDS = 9999 * 60
const TIMEOUT_OPTIONS = [
  { value: 10 * 60, label: '10 分钟' },
  { value: DEFAULT_TIMEOUT_SECONDS, label: '30 分钟' },
  { value: 60 * 60, label: '60 分钟' },
  { value: VERY_LONG_TIMEOUT_SECONDS, label: '无限（9999 分钟）' },
]

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function statusLabel(status?: string) {
  if (status === 'completed') return '已完成'
  if (status === 'cancelled') return '已取消'
  if (status === 'failed') return '失败'
  if (status === 'running') return '生成中'
  return '等待中'
}

export default function ReviewReading() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    notes,
    favorites,
    currentReadingReviewBatch,
    readingReviewBatches,
    readingReviewLoading,
    createReadingReviewBatch,
    continueReadingReviewBatch,
    loadReadingReviewBatch,
    loadReadingReviewBatches,
    cancelReadingReviewBatch,
  } = useAppStore()
  const initialArticleTargetParam = searchParams.get('generateAll') === '1'
    ? 'all'
    : searchParams.get('articleTarget')
  const initialArticleTarget: ArticleTarget =
    initialArticleTargetParam === '10' || initialArticleTargetParam === 'all'
      ? initialArticleTargetParam
      : initialArticleTargetParam && Number(initialArticleTargetParam) > 0 && !['5', '10'].includes(initialArticleTargetParam)
        ? 'custom'
        : '5'
  const initialCustomTarget = initialArticleTarget === 'custom'
    ? Math.max(1, Number(initialArticleTargetParam) || 3)
    : 3
  const continueBatchId = searchParams.get('continueBatch')
  const isContinuingBatch = Boolean(continueBatchId)
  const timeoutParam = searchParams.get('timeoutSeconds')
  const initialTimeout = timeoutParam !== null && TIMEOUT_OPTIONS.some((item) => item.value === Number(timeoutParam))
    ? Number(timeoutParam)
    : DEFAULT_TIMEOUT_SECONDS
  const [articleTarget, setArticleTarget] = useState<ArticleTarget>(initialArticleTarget)
  const [customTarget, setCustomTarget] = useState(initialCustomTarget)
  const [timeoutSeconds, setTimeoutSeconds] = useState(initialTimeout)
  const [generateMode, setGenerateMode] = useState<GenerateMode>(isContinuingBatch ? 'continue' : 'new')
  const [source, setSource] = useState<SourceType>(searchParams.get('source') === 'favorites' ? 'favorites' : 'notes')
  const [range, setRange] = useState<RangeType>(() => {
    const raw = searchParams.get('range')
    return raw === 'wrong' || raw === 'exclude_mastered' || raw === 'new_only' ? raw : 'all'
  })
  const [subCats, setSubCats] = useState<Set<Category | '全部'>>(() => {
    const cats = (searchParams.get('categories') ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean) as Category[]
    return cats.length > 0 ? new Set(cats) : new Set(['全部'])
  })
  const [nowTick, setNowTick] = useState(Date.now())
  const [sessionErrorLog, setSessionErrorLog] = useState<string[]>([])
  const [trackedBatchId, setTrackedBatchId] = useState<string | null>(null)
  const [lastFailedCount, setLastFailedCount] = useState(0)

  const categories = subCats.has('全部') ? [] : Array.from(subCats).filter((cat) => cat !== '全部') as string[]

  const notePool = useMemo(() => {
    let pool = source === 'favorites'
      ? notes.filter((note) => favorites.includes(note.id))
      : notes.filter((note) => note.subcategory === '杂笔记')
    if (categories.length > 0) pool = pool.filter((note) => categories.includes(note.category))
    if (range === 'wrong') pool = pool.filter((note) => (note.wrongCount ?? 0) > 0)
    if (range === 'exclude_mastered') pool = pool.filter((note) => note.reviewStatus !== 'mastered')
    if (range === 'new_only') pool = pool.filter((note) => note.reviewStatus === 'new')
    return pool
  }, [categories, favorites, notes, range, source])

  const batchRunning = currentReadingReviewBatch?.status === 'pending' || currentReadingReviewBatch?.status === 'running'
  const latestBatch = currentReadingReviewBatch ?? readingReviewBatches[0] ?? null
  const canContinueBatch = Boolean(latestBatch && Math.max(0, latestBatch.totalNotes - latestBatch.usedNotes) > 0)
  const isContinueSelected = isContinuingBatch || generateMode === 'continue'
  const targetCount = articleTarget === 'custom' ? Math.max(1, Math.floor(customTarget)) : Number(articleTarget)
  const recentBatches = [
    ...(currentReadingReviewBatch ? [currentReadingReviewBatch] : []),
    ...readingReviewBatches.filter((item) => item.id !== currentReadingReviewBatch?.id),
  ].slice(0, 8)
  const historyArticles = recentBatches.flatMap((batch) => batch.articles.map((article) => ({ batch, article })))
  const hasHistoryItems = historyArticles.length > 0

  useEffect(() => {
    void loadReadingReviewBatches()
  }, [loadReadingReviewBatches])

  useEffect(() => {
    if (continueBatchId) void loadReadingReviewBatch(continueBatchId)
  }, [continueBatchId, loadReadingReviewBatch])

  useEffect(() => {
    if (!currentReadingReviewBatch) return
    if (trackedBatchId !== currentReadingReviewBatch.id) {
      setTrackedBatchId(currentReadingReviewBatch.id)
      setLastFailedCount(currentReadingReviewBatch.failedArticles)
      if (currentReadingReviewBatch.errorMessage) {
        setSessionErrorLog([currentReadingReviewBatch.errorMessage])
      }
      return
    }
    if (currentReadingReviewBatch.failedArticles > lastFailedCount) {
      const nextMessage = currentReadingReviewBatch.errorMessage
      if (nextMessage) {
        setSessionErrorLog((prev) => (prev.includes(nextMessage) ? prev : [...prev, nextMessage]))
      }
      setLastFailedCount(currentReadingReviewBatch.failedArticles)
    } else if (
      currentReadingReviewBatch.errorMessage
      && !sessionErrorLog.includes(currentReadingReviewBatch.errorMessage)
    ) {
      setSessionErrorLog((prev) => [...prev, currentReadingReviewBatch.errorMessage!])
    }
  }, [
    currentReadingReviewBatch,
    lastFailedCount,
    sessionErrorLog,
    trackedBatchId,
  ])

  useEffect(() => {
    if (!batchRunning || !currentReadingReviewBatch) return
    const timer = window.setInterval(() => {
      setNowTick(Date.now())
      void loadReadingReviewBatch(currentReadingReviewBatch.id)
    }, 1200)
    return () => window.clearInterval(timer)
  }, [batchRunning, currentReadingReviewBatch?.id, currentReadingReviewBatch, loadReadingReviewBatch])

  const createBatch = async () => {
    if (batchRunning || readingReviewLoading) return
    setSessionErrorLog([])
    setTrackedBatchId(null)
    setLastFailedCount(0)
    const continuingId = continueBatchId ?? (generateMode === 'continue' ? latestBatch?.id : null)
    const isContinueRequest = Boolean(continuingId)
    if (!isContinueRequest && notePool.length === 0) return
    const payload = {
      ...(articleTarget === 'all' ? { generateAll: true } : { articleTarget: targetCount }),
      timeoutSeconds,
    }
    const batch = continuingId
      ? await continueReadingReviewBatch(continuingId, payload)
      : await createReadingReviewBatch({
        source,
        range,
        ...(categories.length > 0 ? { categories } : {}),
        ...payload,
      })
    if (!batch) alert('AI 阅读生成任务创建失败，请检查模型配置或稍后重试')
  }

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

  const progressPercent = currentReadingReviewBatch
    ? Math.min(100, Math.max(
      currentReadingReviewBatch.totalNotes > 0
        ? (currentReadingReviewBatch.usedNotes / currentReadingReviewBatch.totalNotes) * 100
        : 0,
      currentReadingReviewBatch.targetArticles
        ? (currentReadingReviewBatch.generatedArticles / currentReadingReviewBatch.targetArticles) * 100
        : 0,
    ))
    : 0

  return (
    <Layout title="AI 阅读复习">
      <div className="min-h-full bg-[#111113] px-8 py-8">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          <button
            type="button"
            onClick={() => navigate('/review')}
            className="flex w-fit items-center gap-2 text-sm text-text-dim hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={16} />
            返回筛选
          </button>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex flex-col gap-6">
          <section className="rounded-3xl border border-border bg-surface-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.8px] text-primary">
                  <BookOpen size={14} />
                  AI Reading Review
                </div>
                <h1 className="mt-3 text-2xl font-bold text-text-primary">
                  {isContinuingBatch ? '继续生成雅思阅读文章' : '生成雅思阅读文章'}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-dim">
                  {isContinueSelected && latestBatch
                    ? `上次任务还剩约 ${Math.max(0, latestBatch.totalNotes - latestBatch.usedNotes)} 条未使用笔记。继续生成会排除已用笔记。`
                    : `当前笔记池 ${notePool.length} 条。系统会动态分配笔记，每条笔记在本次生成中最多使用一次，文章内保留可点击的原笔记映射。`}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-[#18181b] px-3.5 py-2.5 text-xs text-text-dim">
                {isContinueSelected
                  ? '继续上次生成'
                  : `${source === 'favorites' ? '收藏夹' : '杂笔记'} · ${range === 'all' ? '全部' : range === 'wrong' ? '错题' : range === 'exclude_mastered' ? '剔除已掌握' : '新添加'}`}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <SectionLabel step={1} label="生成方式" />
              <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'new' as const, icon: BookOpen, label: '重新生成', desc: '使用新的笔记池生成' },
                {
                  key: 'continue' as const,
                  icon: RotateCcw,
                  label: '继续上次',
                  desc: canContinueBatch
                    ? `继续使用剩余 ${Math.max(0, (latestBatch?.totalNotes ?? 0) - (latestBatch?.usedNotes ?? 0))} 条笔记`
                    : '暂无可继续的剩余笔记',
                },
              ]).map(({ key, icon: Icon, label, desc }) => {
                const active = generateMode === key
                const disabled = key === 'continue' && !canContinueBatch
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    onClick={() => setGenerateMode(key)}
                    className="relative flex items-start gap-3 p-4 rounded-xl border text-left transition-colors duration-200 overflow-hidden disabled:cursor-not-allowed disabled:opacity-45"
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
                      <div className="text-sm font-semibold text-text-primary">{label}</div>
                      <div className="mt-0.5 text-xs text-text-dim">{desc}</div>
                    </div>
                  </button>
                )
              })}
              </div>
            </div>

            {generateMode === 'new' && (
              <>
              <div className="flex flex-col gap-3">
                <SectionLabel step={2} label="选择来源" />
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: 'notes' as const, icon: NotebookPen, label: '杂笔记', count: notes.filter((note) => note.subcategory === '杂笔记').length },
                    { key: 'favorites' as const, icon: Heart, label: '收藏夹', count: favorites.length },
                  ]).map(({ key, icon: Icon, label, count }) => {
                    const active = source === key
                    const accent = key === 'favorites' ? '#f87171' : '#818cf8'
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSource(key)}
                        className="relative flex flex-col p-4 rounded-2xl border text-left overflow-hidden transition-colors duration-300"
                        style={{
                          background: active ? (key === 'favorites' ? 'linear-gradient(135deg, #2e1a1a 0%, #3b1e1e 100%)' : 'linear-gradient(135deg, #1a1a3e 0%, #1e1b4b 100%)') : '#1c1c20',
                          borderColor: active ? (key === 'favorites' ? '#ef4444' : '#4f46e5') : '#27272a',
                          boxShadow: active ? `0 0 24px ${key === 'favorites' ? 'rgba(239,68,68,0.25)' : 'rgba(79,70,229,0.25)'}, inset 0 1px 0 rgba(255,255,255,0.06)` : '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                      >
                        {active && (
                          <div className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 blur-2xl transition-opacity duration-500"
                            style={{ background: accent }} />
                        )}
                        <div className="flex items-center justify-between mb-3 relative z-10">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: active ? `${accent}22` : '#27272a', border: `1px solid ${active ? accent + '44' : '#3f3f46'}` }}>
                            <Icon size={15} style={{ color: active ? accent : '#71717a' }} fill={key === 'favorites' && active ? accent : 'none'} />
                          </div>
                          {active && (
                            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: accent }}>
                              <CheckCheck size={10} className="text-white" strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <div className="relative z-10 mb-1">
                          <span className="text-2xl font-bold" style={{ color: active ? accent : '#52525b' }}>{count}</span>
                          <span className="text-sm ml-1.5" style={{ color: active ? accent + 'aa' : '#3f3f46' }}>条</span>
                        </div>
                        <div className="relative z-10">
                          <div className="text-[15px] font-semibold" style={{ color: active ? '#fafafa' : '#71717a' }}>{label}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

                {source === 'notes' && (
                  <div className="flex flex-col gap-3">
                    <SectionLabel step={3} label="筛选子分类" />
                    <div className="flex flex-wrap gap-2">
                      {(['全部', ...SUB_CATS] as (Category | '全部')[]).map((cat) => {
                        const active = subCats.has(cat)
                        const color = cat === '全部' ? '#818cf8' : (CATEGORY_BAR[cat as Category] ?? '#818cf8')
                        const cnt = cat === '全部'
                          ? notes.filter((note) => note.subcategory === '杂笔记').length
                          : notes.filter((note) => note.category === cat).length
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => toggleSub(cat)}
                            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all duration-200"
                            style={active ? {
                              background: color + '18',
                              borderColor: color + '66',
                              color,
                            } : {
                              background: 'transparent',
                              borderColor: '#27272a',
                              color: '#52525b',
                            }}
                          >
                            {cat !== '全部' && (
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: active ? color : '#3f3f46' }} />
                            )}
                            {cat}
                            <span className="text-[11px] opacity-60">{cnt}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

              <div className="flex flex-col gap-3">
                <SectionLabel step={source === 'notes' ? 4 : 3} label="笔记范围" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {([
                    { key: 'all' as const, icon: CheckCheck, label: '全部笔记', desc: '从当前范围生成' },
                    { key: 'wrong' as const, icon: XCircle, label: '仅错题', desc: '优先薄弱内容' },
                    { key: 'exclude_mastered' as const, icon: GraduationCap, label: '剔除已掌握', desc: '跳过已掌握' },
                    { key: 'new_only' as const, icon: Sparkles, label: '仅新添加', desc: '新内容入文' },
                  ]).map(({ key, icon: Icon, label, desc }) => {
                    const active = range === key
                    return (
                      <button
                        key={key}
                        type="button"
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
                      </button>
                    )
                  })}
                </div>
              </div>
              </>
            )}

            <div className="flex flex-col gap-3">
              <SectionLabel step={generateMode === 'new' ? (source === 'notes' ? 5 : 4) : 2} label="生成设置" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-text-dim">生成文章数量</span>
                <select
                  value={articleTarget}
                  onChange={(e) => setArticleTarget(e.target.value as ArticleTarget)}
                  className="h-10 bg-[#232328] border border-border rounded-sm px-3 text-sm text-text-muted outline-none"
                >
                  <option value="5">5 篇</option>
                  <option value="10">10 篇</option>
                  <option value="all">生成全部</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              {articleTarget === 'custom' && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-text-dim">自定义篇数</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={customTarget}
                    onChange={(e) => setCustomTarget(Number(e.target.value))}
                    className="h-10 bg-[#232328] border border-border rounded-sm px-3 text-sm text-text-muted outline-none"
                  />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-text-dim">任务超时时间</span>
                <select
                  value={timeoutSeconds}
                  onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                  className="h-10 bg-[#232328] border border-border rounded-sm px-3 text-sm text-text-muted outline-none"
                >
                  {TIMEOUT_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="text-xs text-text-dim">
                每篇目标 900-1500 词，建议笔记池不少于 50 条。
              </div>
              <motion.button
                whileHover={(isContinueSelected || notePool.length > 0) && !batchRunning ? { scale: 1.02 } : {}}
                whileTap={(isContinueSelected || notePool.length > 0) && !batchRunning ? { scale: 0.97 } : {}}
                disabled={(!isContinueSelected && notePool.length === 0) || (isContinueSelected && !canContinueBatch && !continueBatchId) || batchRunning || readingReviewLoading}
                onClick={() => { void createBatch() }}
                className="flex h-10 items-center gap-2 rounded-xl bg-primary-btn px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <BookOpen size={14} />
                {batchRunning ? '生成中...' : readingReviewLoading ? '创建中...' : isContinueSelected ? '继续生成' : '开始生成'}
              </motion.button>
            </div>
          </section>

          {currentReadingReviewBatch && (
            <section className="rounded-2xl border border-border bg-surface-card p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-text-primary">{statusLabel(currentReadingReviewBatch.status)}</div>
                  <div className="mt-1 text-xs text-text-dim">
                    已用时 {formatElapsed(
                      currentReadingReviewBatch.startedAt
                        ? (currentReadingReviewBatch.endedAt ? new Date(currentReadingReviewBatch.endedAt).getTime() : nowTick) - new Date(currentReadingReviewBatch.startedAt).getTime()
                        : 0,
                    )} · 已生成 {currentReadingReviewBatch.generatedArticles}
                    {currentReadingReviewBatch.targetArticles ? `/${currentReadingReviewBatch.targetArticles}` : ''}
                    篇 · 已使用 {currentReadingReviewBatch.usedNotes}/{currentReadingReviewBatch.totalNotes} 条笔记
                    {currentReadingReviewBatch.modelId ? ` · 模型 ${currentReadingReviewBatch.modelProvider ? `${currentReadingReviewBatch.modelProvider} · ` : ''}${currentReadingReviewBatch.modelId}` : ''}
                    {currentReadingReviewBatch.timeoutSeconds === 0 || currentReadingReviewBatch.timeoutSeconds >= VERY_LONG_TIMEOUT_SECONDS ? ' · 无限超时' : ''}
                  </div>
                </div>
                {batchRunning && (
                  <button
                    type="button"
                    onClick={() => { void cancelReadingReviewBatch(currentReadingReviewBatch.id) }}
                    className="flex h-9 items-center gap-1.5 rounded-sm border border-[#f87171]/30 px-3 text-xs text-[#fca5a5] hover:bg-[#450a0a]/40"
                  >
                    <StopCircle size={12} />
                    取消生成
                  </button>
                )}
              </div>
              <div className="mt-4 h-2 rounded-full bg-[#27272a] overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              {sessionErrorLog.length > 0 && (
                <div className="mt-4 rounded-xl border border-[#f87171]/25 bg-[#450a0a]/25 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#fca5a5]">
                    <XCircle size={14} />
                    失败日志
                    <span className="text-[11px] font-normal text-[#fca5a5]/70">（仅本次会话，刷新后清除）</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {sessionErrorLog.map((message, index) => (
                      <pre
                        key={`${index}-${message}`}
                        className="max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[#7f1d1d]/50 bg-[#18181b] px-3 py-2 text-[11px] leading-relaxed text-[#fecaca]"
                      >
                        {message}
                      </pre>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
            </div>

          <section className="rounded-2xl border border-border bg-surface-card p-5 lg:sticky lg:top-8 lg:self-start">
            <div className="mb-4 flex items-center gap-2">
              <FileText size={16} className="text-primary" />
              <h2 className="text-lg font-semibold text-text-primary">生成历史</h2>
            </div>
            {!hasHistoryItems ? (
              <div className="rounded-xl border border-border bg-[#18181b] p-5 text-sm text-text-dim">
                暂无生成文章
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {historyArticles.map(({ article }) => (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => navigate(`/review/reading/articles/${article.id}`)}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-[#18181b] px-4 py-3 text-left hover:border-primary/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-text-primary">{article.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-dim">
                        <span>{article.wordCount} 词</span>
                        <span>使用 {article._count?.notes ?? 0} 条笔记</span>
                        <span className="inline-flex items-center gap-1"><Clock size={11} />{Math.round(article.generationMs / 1000)} 秒</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-text-subtle" />
                  </button>
                ))}
              </div>
            )}
          </section>
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

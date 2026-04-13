import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { Search, FileText, CirclePlus, Plus, LayoutGrid, NotebookPen, Heart, Trash2, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { NoteCard } from '../components/ui/NoteCard'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { CATEGORY_BAR, CATEGORY_COLORS, type Category } from '../data/mockData'
import { useAppStore } from '../store/useAppStore'

const SUB_CATS: (Category | '全部')[] = ['全部', '口语', '短语', '句子', '同义替换', '拼写', '单词']

type WritingType = '大作文' | '小作文'
const WRITING_SUB_CATS: ('全部' | WritingType)[] = ['全部', '大作文', '小作文']
const WRITING_TYPE_COLORS: Record<WritingType, { color: string; bg: string; border: string; dot: string }> = {
  '大作文': { color: '#818cf8', bg: '#1e1b4b', border: '#3730a3', dot: '#818cf8' },
  '小作文': { color: '#34d399', bg: '#022c22', border: '#065f46', dot: '#34d399' },
}

function kbFiltersFromSearchParams(searchParams: URLSearchParams): {
  groupFilter: '全部' | '杂笔记' | '写作' | '收藏夹' | '已掌握'
  subFilter: Category | '全部'
  statusFilter: '全部' | 'mastered' | 'unmastered'
} {
  const group = searchParams.get('group')
  const cat = searchParams.get('cat')
  const status = searchParams.get('status')
  const statusFilter: '全部' | 'mastered' | 'unmastered' =
    status === 'mastered' || status === 'unmastered' ? status : '全部'
  if (group === '写作') return { groupFilter: '写作', subFilter: '全部', statusFilter: '全部' }
  if (group === '收藏夹') return { groupFilter: '收藏夹', subFilter: '全部', statusFilter: '全部' }
  if (group === '已掌握') return { groupFilter: '已掌握', subFilter: '全部', statusFilter: 'mastered' }
  if (group === '杂笔记') {
    const sub: Category | '全部' = cat ? (cat as Category) : '全部'
    return { groupFilter: '杂笔记', subFilter: sub, statusFilter }
  }
  return { groupFilter: '全部', subFilter: '全部', statusFilter: '全部' }
}


type KnowledgeBaseMainProps = {
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  searchParams: URLSearchParams
  setSearchParams: (params: Record<string, string>, opts?: { replace?: boolean }) => void
}

function KnowledgeBaseMain({ search, setSearch, searchParams, setSearchParams }: KnowledgeBaseMainProps) {
  const {
    notes,
    openQuickNote,
    favorites,
    lastAddedNoteId,
    clearLastAddedNoteId,
    writingNotes,
    writingNotesLoading,
    deleteNote,
  } = useAppStore()
  const navigate = useNavigate()
  const noteRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null)
  const [batchDeleteMode, setBatchDeleteMode] = useState(false)
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([])
  const [batchDeleting, setBatchDeleting] = useState(false)

  useEffect(() => {
    const main = document.querySelector('main')
    const savedScroll = sessionStorage.getItem('scroll-y:/kb')
    if (savedScroll && main) {
      requestAnimationFrame(() => {
        main.scrollTop = parseInt(savedScroll)
        sessionStorage.removeItem('scroll-y:/kb')
      })
    }
  }, [])

  function saveScrollAndNavigate(path: string) {
    const main = document.querySelector('main')
    if (main) sessionStorage.setItem('scroll-y:/kb', String(main.scrollTop))
    navigate(path)
  }
  const [groupFilter, setGroupFilter] = useState(
    () => kbFiltersFromSearchParams(searchParams).groupFilter
  )
  const [subFilter, setSubFilter] = useState(
    () => kbFiltersFromSearchParams(searchParams).subFilter
  )
  const [statusFilter, setStatusFilter] = useState<'全部' | 'mastered' | 'unmastered'>(
    () => kbFiltersFromSearchParams(searchParams).statusFilter
  )
  const [writingSubFilter, setWritingSubFilter] = useState<'全部' | WritingType>('全部')

  useEffect(() => {
    const { groupFilter: gf, subFilter: sf, statusFilter: st } = kbFiltersFromSearchParams(searchParams)
    setGroupFilter(gf)
    setSubFilter(sf)
    setStatusFilter(st)
  }, [searchParams])

  const filteredNotes = notes.filter((n) => {
    if (groupFilter === '写作' || groupFilter === '收藏夹') return false
    if (groupFilter === '已掌握' && n.reviewStatus !== 'mastered') return false
    if (groupFilter === '杂笔记') {
      if (subFilter !== '全部' && n.category !== subFilter) return false
      if (statusFilter === 'mastered' && n.reviewStatus !== 'mastered') return false
      if (statusFilter === 'unmastered' && n.reviewStatus === 'mastered') return false
    }
    const matchSearch = !search ||
      n.content.toLowerCase().includes(search.toLowerCase()) ||
      n.translation.includes(search)
    return matchSearch
  })

  const favNotes = notes.filter((n) => {
    if (!favorites.includes(n.id)) return false
    const matchSearch = !search ||
      n.content.toLowerCase().includes(search.toLowerCase()) ||
      n.translation.includes(search)
    return matchSearch
  })

  const filteredWritingNotes = writingNotes.filter((w) => {
    if (writingSubFilter !== '全部' && w.writingType !== writingSubFilter) return false
    const matchSearch = !search || w.name.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })

  const showWriting = groupFilter === '全部' || groupFilter === '写作'
  const showNotes = groupFilter === '全部' || groupFilter === '杂笔记' || groupFilter === '已掌握'
  const showFavorites = groupFilter === '收藏夹'

  const allItems = showNotes ? filteredNotes : []
  const canBatchDelete = showNotes || showFavorites

  function toggleBatchDeleteMode() {
    setBatchDeleteMode((prev) => !prev)
    setSelectedNoteIds([])
  }

  function toggleSelectedNote(noteId: string) {
    setSelectedNoteIds((prev) => {
      if (prev.includes(noteId)) return prev.filter((id) => id !== noteId)
      return [...prev, noteId]
    })
  }

  async function handleConfirmBatchDelete() {
    if (selectedNoteIds.length === 0 || batchDeleting) return
    const ok = window.confirm(`确认删除选中的 ${selectedNoteIds.length} 条笔记吗？此操作不可撤销。`)
    if (!ok) return

    setBatchDeleting(true)
    const targets = [...selectedNoteIds]
    const results = await Promise.all(targets.map((id) => deleteNote(id)))
    const failedCount = results.filter((v) => !v).length
    setBatchDeleting(false)

    if (failedCount > 0) {
      window.alert(`删除完成：成功 ${targets.length - failedCount} 条，失败 ${failedCount} 条。`)
      return
    }

    setSelectedNoteIds([])
    setBatchDeleteMode(false)
  }

  useEffect(() => {
    if (!batchDeleteMode) return
    const visibleIds = new Set<string>([
      ...allItems.map((n) => n.id),
      ...(showFavorites ? favNotes.map((n) => n.id) : []),
    ])
    setSelectedNoteIds((prev) => prev.filter((id) => visibleIds.has(id)))
  }, [allItems, batchDeleteMode, favNotes, showFavorites])

  useEffect(() => {
    if (!lastAddedNoteId) return
    const hit = showNotes && allItems.some((n) => n.id === lastAddedNoteId)
    if (!hit) return
    const target = noteRefs.current[lastAddedNoteId]
    if (!target) return

    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedNoteId(lastAddedNoteId)
    clearLastAddedNoteId()

    const timer = window.setTimeout(() => setHighlightedNoteId(null), 1200)
    return () => window.clearTimeout(timer)
  }, [allItems, clearLastAddedNoteId, lastAddedNoteId, showNotes])

  return (
      <div className="p-8 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-text-primary">知识库</h1>
            <p className="text-sm text-text-dim mt-1">管理和浏览所有笔记</p>
          </div>
          {canBatchDelete && (
            <Button
              type="button"
              variant={batchDeleteMode ? 'danger' : 'outline'}
              size="lg"
              icon={<Trash2 size={14} />}
              className="h-9 min-h-9 rounded-sm text-[13px] px-4"
              onClick={toggleBatchDeleteMode}
            >
              {batchDeleteMode ? '取消批量' : '批量删除'}
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            size="lg"
            icon={<Plus size={14} />}
            className="h-9 min-h-9 rounded-sm text-[13px] px-4"
            onClick={openQuickNote}
          >
            添加笔记
          </Button>
        </div>

        {/* Group Tabs — with icons and note counts */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { g: '全部' as const, icon: LayoutGrid, count: notes.length + writingNotes.length, activeClass: 'bg-[#1e1b4b] border-[#4338ca] text-[#c7d2fe]', activeIcon: 'text-primary', activeBadge: 'bg-primary/20 text-primary' },
            { g: '杂笔记' as const, icon: NotebookPen, count: notes.length, activeClass: 'bg-[#1e1b4b] border-[#4338ca] text-[#c7d2fe]', activeIcon: 'text-primary', activeBadge: 'bg-primary/20 text-primary' },
            { g: '写作' as const, icon: FileText, count: writingNotes.length, activeClass: 'bg-[#1e1b4b] border-[#4338ca] text-[#c7d2fe]', activeIcon: 'text-primary', activeBadge: 'bg-primary/20 text-primary' },
            { g: '收藏夹' as const, icon: Heart, count: favorites.length, activeClass: 'bg-[#2e1a1a] border-[#ef4444] text-[#fca5a5]', activeIcon: 'text-[#ef4444]', activeBadge: 'bg-[#ef4444]/20 text-[#ef4444]' },
            { g: '已掌握' as const, icon: LayoutGrid, count: notes.filter((n) => n.reviewStatus === 'mastered').length, activeClass: 'bg-[#0e2a1f] border-[#34d399] text-[#86efac]', activeIcon: 'text-[#34d399]', activeBadge: 'bg-[#34d399]/20 text-[#34d399]' },
          ]).map(({ g, icon: Icon, count, activeClass, activeIcon, activeBadge }) => (
            <motion.button
              key={g}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setGroupFilter(g)
                setSubFilter('全部')
                setWritingSubFilter('全部')
                setStatusFilter(g === '已掌握' ? 'mastered' : '全部')
                const p: Record<string, string> = {}
                if (g !== '全部') p.group = g
                if (g === '已掌握') p.status = 'mastered'
                setSearchParams(p, { replace: true })
              }}
              className={`flex items-center gap-1.5 h-9 px-4 rounded-md text-[13px] font-medium border transition-all ${
                groupFilter === g
                  ? activeClass
                  : 'border-border text-text-dim hover:border-border-strong hover:text-text-muted hover:bg-[#27272a]/40'
              }`}
            >
              <Icon size={13} className={groupFilter === g ? activeIcon : 'text-text-subtle'} />
              {g}
              <span className={`text-[10px] font-normal px-1.5 py-0.5 rounded-full ml-0.5 ${
                groupFilter === g ? activeBadge : 'bg-border text-text-subtle'
              }`}>
                {count}
              </span>
            </motion.button>
          ))}
        </div>

        {/* 写作子分类 pills */}
        {groupFilter === '写作' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {WRITING_SUB_CATS.map((cat) => {
              const colors = cat !== '全部' ? WRITING_TYPE_COLORS[cat] : undefined
              const count = cat === '全部'
                ? writingNotes.length
                : writingNotes.filter((w) => w.writingType === cat).length
              const isActive = writingSubFilter === cat
              return (
                <motion.button
                  key={cat}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setWritingSubFilter(cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive && cat !== '全部'
                      ? ''
                      : isActive
                        ? 'bg-primary-btn text-white'
                        : 'border border-border text-text-dim hover:text-text-muted hover:border-border-strong'
                  }`}
                  style={isActive && cat !== '全部' ? { color: colors?.color, background: colors?.bg, border: `1px solid ${colors?.border}` } : {}}
                >
                  {colors && (
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colors.dot }} />
                  )}
                  {cat}
                  <span className="text-[10px] opacity-50 ml-0.5">{count}</span>
                </motion.button>
              )
            })}
          </div>
        )}

        {/* 杂笔记子分类 pills */}
        {groupFilter === '杂笔记' && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {SUB_CATS.map((cat) => {
                const color = cat !== '全部' ? CATEGORY_COLORS[cat]?.color : undefined
                const bg = cat !== '全部' ? CATEGORY_COLORS[cat]?.bg : undefined
                const border = cat !== '全部' ? CATEGORY_COLORS[cat]?.border : undefined
                const dotColor = cat !== '全部' ? CATEGORY_BAR[cat] : undefined
                const catCount = cat === '全部'
                  ? notes.length
                  : notes.filter((n) => n.category === cat).length
                const isActive = subFilter === cat
                return (
                  <motion.button
                    key={cat}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSubFilter(cat)
                      const p: Record<string, string> = { group: '杂笔记' }
                      if (cat !== '全部') p.cat = String(cat)
                      if (statusFilter !== '全部') p.status = statusFilter
                      setSearchParams(p, { replace: true })
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isActive && cat !== '全部'
                        ? ''
                        : isActive
                          ? 'bg-primary-btn text-white'
                          : 'border border-border text-text-dim hover:text-text-muted hover:border-border-strong'
                    }`}
                    style={isActive && cat !== '全部' ? { color, background: bg, border: `1px solid ${border}` } : {}}
                  >
                    {dotColor && (
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: dotColor }}
                      />
                    )}
                    {cat}
                    <span className={`text-[10px] opacity-50 ml-0.5`}>{catCount}</span>
                  </motion.button>
                )
              })}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {([
                { key: '全部', label: '全部' },
                { key: 'mastered', label: '已掌握' },
                { key: 'unmastered', label: '未掌握' },
              ] as const).map((item) => {
                const isActive = statusFilter === item.key
                const count = item.key === '全部'
                  ? notes.filter((n) => subFilter === '全部' || n.category === subFilter).length
                  : item.key === 'mastered'
                    ? notes.filter((n) => (subFilter === '全部' || n.category === subFilter) && n.reviewStatus === 'mastered').length
                    : notes.filter((n) => (subFilter === '全部' || n.category === subFilter) && n.reviewStatus !== 'mastered').length
                return (
                  <motion.button
                    key={item.key}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setStatusFilter(item.key)
                      const p: Record<string, string> = { group: '杂笔记' }
                      if (subFilter !== '全部') p.cat = String(subFilter)
                      if (item.key !== '全部') p.status = item.key
                      setSearchParams(p, { replace: true })
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isActive
                        ? item.key === 'mastered'
                          ? 'bg-[#0e2a1f] border border-[#34d399] text-[#86efac]'
                          : item.key === 'unmastered'
                            ? 'bg-[#2e1212] border border-[#f87171] text-[#fca5a5]'
                            : 'bg-primary-btn text-white'
                        : 'border border-border text-text-dim hover:text-text-muted hover:border-border-strong'
                    }`}
                  >
                    {item.label}
                    <span className="text-[10px] opacity-50 ml-0.5">{count}</span>
                  </motion.button>
                )
              })}
            </div>
          </div>
        )}

        {/* Search row — deeper bg, taller */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 h-11 min-h-11 bg-[#0d0d10] border border-border rounded-md px-3.5 focus-within:border-primary/40 transition-colors">
            <Search size={14} className="text-text-dim shrink-0" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`搜索${groupFilter === '写作' ? (writingSubFilter !== '全部' ? writingSubFilter : '写作') : subFilter !== '全部' ? subFilter : ''}笔记...`}
              size="md"
              className="flex-1 border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 h-9 min-h-9 px-0 rounded-none placeholder:text-text-subtle"
              aria-label="搜索笔记"
            />
          </div>
        </div>
        {batchDeleteMode && canBatchDelete && (
          <div className="flex items-center justify-between rounded-md border border-[#7f1d1d]/60 bg-[#2a1111] px-4 py-2.5">
            <span className="text-sm text-[#fecaca]">已选择 {selectedNoteIds.length} 条笔记</span>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={selectedNoteIds.length === 0 || batchDeleting}
              onClick={() => { void handleConfirmBatchDelete() }}
            >
              {batchDeleting ? '删除中...' : `确认删除 ${selectedNoteIds.length} 条笔记`}
            </Button>
          </div>
        )}

        {/* Content */}
        {showWriting && (
          <div className="flex flex-col gap-3">
            {groupFilter === '全部' && (
              <h3 className="text-sm font-semibold text-text-muted">写作文件</h3>
            )}
            {writingNotesLoading && (
              <div className="text-sm text-text-dim py-4">加载中…</div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
              {filteredWritingNotes.map((w, i) => (
                <motion.div
                  key={w.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: i * 0.04 }}
                  onClick={() => saveScrollAndNavigate(`/kb/w/${w.id}`)}
                  className="relative bg-surface-card border border-border rounded-xl overflow-hidden cursor-pointer hover:-translate-y-0.5 transition-transform group"
                >
                  <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: '#94a3b8' }} />
                  <div className="px-5 py-8 flex flex-col gap-2 items-center text-center">
                    <span
                      className="w-fit inline-flex items-center gap-1 px-1.5 py-0 text-[10px] leading-4 font-medium rounded whitespace-nowrap"
                      style={{ color: '#94a3b8', background: '#1e293b', border: '1px solid #334155' }}
                    >
                      <FileText size={9} />写作
                    </span>
                    <div className="text-[22px] font-bold text-text-primary group-hover:text-white transition-colors w-full truncate leading-tight">
                      {w.name}
                    </div>
                    <div className="text-[15px] text-text-muted w-full truncate">{w.path}</div>
                  </div>
                </motion.div>
              ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {showNotes && (
          <div className="flex flex-col gap-3">
            {groupFilter === '全部' && (
              <h3 className="text-sm font-semibold text-text-muted">杂笔记</h3>
            )}
            {allItems.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                {allItems.map((note, i) => (
                  <motion.div
                    key={note.id}
                    ref={(el) => { noteRefs.current[note.id] = el }}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className={`relative ${highlightedNoteId === note.id ? 'note-added-highlight' : ''} ${batchDeleteMode && selectedNoteIds.includes(note.id) ? 'ring-2 ring-[#ef4444] ring-offset-0 rounded-xl' : ''}`}
                  >
                    <div className={batchDeleteMode ? 'pointer-events-none' : ''}>
                      <NoteCard note={note} />
                    </div>
                    {batchDeleteMode && (
                      <button
                        type="button"
                        aria-label={`选择笔记 ${note.content}`}
                        aria-pressed={selectedNoteIds.includes(note.id)}
                        onClick={() => toggleSelectedNote(note.id)}
                        className={`absolute inset-0 z-20 rounded-xl border transition-colors ${
                          selectedNoteIds.includes(note.id)
                            ? 'border-[#ef4444] bg-[#ef4444]/10'
                            : 'border-transparent hover:border-[#ef4444]/70 hover:bg-[#ef4444]/5'
                        }`}
                      >
                        <span className={`absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                          selectedNoteIds.includes(note.id)
                            ? 'border-[#ef4444] bg-[#ef4444] text-white'
                            : 'border-border bg-surface-card text-transparent'
                        }`}>
                          <Check size={14} />
                        </span>
                      </button>
                    )}
                  </motion.div>
                ))}
                </AnimatePresence>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <EmptyState
                  title={search ? '未找到相关笔记' : `暂无${subFilter !== '全部' ? subFilter : ''}笔记`}
                  description="点击下方按钮快速记录新笔记"
                  action={
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-surface-card border border-border flex items-center justify-center">
                        <CirclePlus size={28} className="text-border-strong" />
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        icon={<Plus size={14} />}
                        className="rounded-md"
                        onClick={openQuickNote}
                      >
                        添加笔记
                      </Button>
                    </>
                  }
                />
              </motion.div>
            )}
          </div>
        )}

        {showFavorites && (
          <div className="flex flex-col gap-3">
            {favNotes.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                {favNotes.map((note, i) => (
                  <motion.div
                    key={note.id}
                    className={`relative ${batchDeleteMode && selectedNoteIds.includes(note.id) ? 'ring-2 ring-[#ef4444] ring-offset-0 rounded-xl' : ''}`}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                  >
                    <div className={batchDeleteMode ? 'pointer-events-none' : ''}>
                      <NoteCard note={note} />
                    </div>
                    {batchDeleteMode && (
                      <button
                        type="button"
                        aria-label={`选择笔记 ${note.content}`}
                        aria-pressed={selectedNoteIds.includes(note.id)}
                        onClick={() => toggleSelectedNote(note.id)}
                        className={`absolute inset-0 z-20 rounded-xl border transition-colors ${
                          selectedNoteIds.includes(note.id)
                            ? 'border-[#ef4444] bg-[#ef4444]/10'
                            : 'border-transparent hover:border-[#ef4444]/70 hover:bg-[#ef4444]/5'
                        }`}
                      >
                        <span className={`absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                          selectedNoteIds.includes(note.id)
                            ? 'border-[#ef4444] bg-[#ef4444] text-white'
                            : 'border-border bg-surface-card text-transparent'
                        }`}>
                          <Check size={14} />
                        </span>
                      </button>
                    )}
                  </motion.div>
                ))}
                </AnimatePresence>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <EmptyState
                  title={search ? '未找到收藏的笔记' : '收藏夹为空'}
                  description="在卡片或笔记详情页点击心形按钮将笔记加入收藏"
                  action={
                    <div className="w-16 h-16 rounded-2xl bg-[#2e1a1a] border border-[#ef4444]/30 flex items-center justify-center">
                      <Heart size={28} className="text-[#ef4444]/60" />
                    </div>
                  }
                />
              </motion.div>
            )}
          </div>
        )}
      </div>
  )
}

export default function KnowledgeBase() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [pageLoading] = useState(false)

  if (pageLoading) {
    return (
      <Layout title="知识库">
        <LoadingState />
      </Layout>
    )
  }

  return (
    <Layout title="知识库">
      <KnowledgeBaseMain
        search={search}
        setSearch={setSearch}
        searchParams={searchParams}
        setSearchParams={(p, opts) => setSearchParams(p, opts)}
      />
    </Layout>
  )
}

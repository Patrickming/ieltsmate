import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useDeferredValue,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { Search, FileText, CirclePlus, Plus, LayoutGrid, NotebookPen, Heart, Trash2, Check, Copy } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { NoteCard } from '../components/ui/NoteCard'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { CATEGORY_BAR, CATEGORY_COLORS, type Category, type Note } from '../data/mockData'
import { useAppStore } from '../store/useAppStore'
import { noteMatchesPrimarySearch, normalizeSearchQuery } from '../lib/searchModalResults'
import { getVirtualGridRange } from '../lib/virtualization'
import {
  countDuplicateParticipantNotes,
  englishContentCounts,
  isNoteEnglishDuplicate,
  sortDuplicateNotesByEnglishCluster,
} from '../lib/noteEnglishDedup'

const SUB_CATS: (Category | '全部')[] = ['全部', '口语', '短语', '句子', '同义替换', '拼写', '单词']
const NOTE_GRID_COLUMNS = 3
const NOTE_CARD_HEIGHT = 210
const NOTE_GRID_GAP = 16
const NOTE_ROW_HEIGHT = NOTE_CARD_HEIGHT + NOTE_GRID_GAP
const NOTE_GRID_OVERSCAN_ROWS = 2
const NOTE_GRID_VIRTUALIZE_THRESHOLD = NOTE_GRID_COLUMNS * 12

type WritingType = '大作文' | '小作文'
const WRITING_SUB_CATS: ('全部' | WritingType)[] = ['全部', '大作文', '小作文']
const WRITING_TYPE_COLORS: Record<WritingType, { color: string; bg: string; border: string; dot: string }> = {
  '大作文': { color: '#818cf8', bg: '#1e1b4b', border: '#3730a3', dot: '#818cf8' },
  '小作文': { color: '#34d399', bg: '#022c22', border: '#065f46', dot: '#34d399' },
}

function kbFiltersFromSearchParams(searchParams: URLSearchParams): {
  groupFilter: '全部' | '杂笔记' | '写作' | '收藏夹' | '已掌握' | '重复笔记'
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
  if (group === '重复笔记') return { groupFilter: '重复笔记', subFilter: '全部', statusFilter: '全部' }
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

type VirtualizedNoteGridProps = {
  notes: Note[]
  batchDeleteMode: boolean
  selectedNoteIds: string[]
  noteRefs: MutableRefObject<Record<string, HTMLDivElement | null>>
  onToggleSelected: (noteId: string) => void
  mainScrollTop: number
  mainViewportHeight: number
}

function useMainScrollMetrics() {
  const [metrics, setMetrics] = useState({ scrollTop: 0, viewportHeight: 0 })

  useEffect(() => {
    const main = document.querySelector('main')
    if (!(main instanceof HTMLElement)) return

    const update = () => {
      setMetrics({
        scrollTop: main.scrollTop,
        viewportHeight: main.clientHeight,
      })
    }

    update()
    main.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => update())
      : null
    observer?.observe(main)

    return () => {
      main.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [])

  return metrics
}

function renderNoteGridItem({
  note,
  wrapper,
  batchDeleteMode,
  selectedNoteIds,
  noteRefs,
  onToggleSelected,
}: {
  note: Note
  wrapper: (children: ReactNode) => ReactNode
  batchDeleteMode: boolean
  selectedNoteIds: string[]
  noteRefs: MutableRefObject<Record<string, HTMLDivElement | null>>
  onToggleSelected: (noteId: string) => void
}) {
  const isSelected = selectedNoteIds.includes(note.id)

  return wrapper(
    <>
      <div
        ref={(el) => { noteRefs.current[note.id] = el }}
        className={`relative ${batchDeleteMode && isSelected ? 'ring-2 ring-[#ef4444] ring-offset-0 rounded-xl' : ''}`}
      >
        <div className={batchDeleteMode ? 'pointer-events-none' : ''}>
          <NoteCard note={note} />
        </div>
        {batchDeleteMode && (
          <button
            type="button"
            aria-label={`选择笔记 ${note.content}`}
            aria-pressed={isSelected}
            onClick={() => onToggleSelected(note.id)}
            className={`absolute inset-0 z-20 rounded-xl border transition-colors ${
              isSelected
                ? 'border-[#ef4444] bg-[#ef4444]/10'
                : 'border-transparent hover:border-[#ef4444]/70 hover:bg-[#ef4444]/5'
            }`}
          >
            <span className={`absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-full border ${
              isSelected
                ? 'border-[#ef4444] bg-[#ef4444] text-white'
                : 'border-border bg-surface-card text-transparent'
            }`}>
              <Check size={14} />
            </span>
          </button>
        )}
      </div>
    </>,
  )
}

function VirtualizedNoteGrid({
  notes,
  batchDeleteMode,
  selectedNoteIds,
  noteRefs,
  onToggleSelected,
  mainScrollTop,
  mainViewportHeight,
}: VirtualizedNoteGridProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerTop, setContainerTop] = useState(0)

  useEffect(() => {
    const update = () => {
      const el = containerRef.current
      if (!el) return
      setContainerTop(el.offsetTop)
    }

    update()
    window.addEventListener('resize', update)
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => update())
      : null
    if (containerRef.current) observer?.observe(containerRef.current)

    return () => {
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [notes.length, batchDeleteMode])

  const shouldVirtualize = notes.length >= NOTE_GRID_VIRTUALIZE_THRESHOLD && mainViewportHeight > 0
  const totalRows = Math.ceil(notes.length / NOTE_GRID_COLUMNS)
  const totalHeight = totalRows * NOTE_ROW_HEIGHT

  const virtualRange = useMemo(() => {
    if (!shouldVirtualize) return null

    const viewportTop = Math.max(0, mainScrollTop - containerTop)
    const viewportBottom = Math.min(totalHeight, Math.max(0, mainScrollTop + mainViewportHeight - containerTop))
    const viewportHeight = Math.max(NOTE_ROW_HEIGHT, viewportBottom - viewportTop)

    return getVirtualGridRange({
      itemCount: notes.length,
      columnCount: NOTE_GRID_COLUMNS,
      rowHeight: NOTE_ROW_HEIGHT,
      viewportHeight,
      scrollTop: viewportTop,
      overscanRows: NOTE_GRID_OVERSCAN_ROWS,
    })
  }, [containerTop, mainScrollTop, mainViewportHeight, notes.length, shouldVirtualize, totalHeight])

  const visibleNotes = shouldVirtualize && virtualRange
    ? notes.slice(virtualRange.startIndex, virtualRange.endIndex)
    : notes

  const showMotion = !shouldVirtualize && notes.length <= 18

  return (
    <div
      ref={containerRef}
      className={shouldVirtualize ? 'relative' : undefined}
      style={shouldVirtualize ? { height: totalHeight } : undefined}
    >
      <div
        className="grid grid-cols-3 gap-4"
        style={shouldVirtualize && virtualRange ? { position: 'absolute', top: virtualRange.offsetTop, left: 0, right: 0 } : undefined}
      >
        {visibleNotes.map((note, i) => {
          const actualIndex = shouldVirtualize && virtualRange ? virtualRange.startIndex + i : i
          if (showMotion) {
            return (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.18, delay: Math.min(actualIndex, 8) * 0.02 }}
              >
                {renderNoteGridItem({
                  note,
                  batchDeleteMode,
                  selectedNoteIds,
                  noteRefs,
                  onToggleSelected,
                  wrapper: (children) => children,
                })}
              </motion.div>
            )
          }

          return (
            <div key={note.id}>
              {renderNoteGridItem({
                note,
                batchDeleteMode,
                selectedNoteIds,
                noteRefs,
                onToggleSelected,
                wrapper: (children) => children,
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KnowledgeBaseMain({ search, setSearch, searchParams, setSearchParams }: KnowledgeBaseMainProps) {
  const notes = useAppStore((s) => s.notes)
  const openQuickNote = useAppStore((s) => s.openQuickNote)
  const favorites = useAppStore((s) => s.favorites)
  const lastAddedNoteId = useAppStore((s) => s.lastAddedNoteId)
  const clearLastAddedNoteId = useAppStore((s) => s.clearLastAddedNoteId)
  const writingNotes = useAppStore((s) => s.writingNotes)
  const writingNotesLoading = useAppStore((s) => s.writingNotesLoading)
  const deleteNote = useAppStore((s) => s.deleteNote)
  const navigate = useNavigate()
  const noteRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const { scrollTop: mainScrollTop, viewportHeight: mainViewportHeight } = useMainScrollMetrics()
  const [batchDeleteMode, setBatchDeleteMode] = useState(false)
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([])
  const [batchDeleting, setBatchDeleting] = useState(false)
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    const main = document.querySelector('main')
    const savedScroll = sessionStorage.getItem('scroll-y:/kb')
    if (savedScroll && main instanceof HTMLElement) {
      requestAnimationFrame(() => {
        main.scrollTop = parseInt(savedScroll)
        sessionStorage.removeItem('scroll-y:/kb')
      })
    }
  }, [])

  function saveScrollAndNavigate(path: string) {
    const main = document.querySelector('main')
    if (main instanceof HTMLElement) sessionStorage.setItem('scroll-y:/kb', String(main.scrollTop))
    navigate(path)
  }
  const [writingSubFilter, setWritingSubFilter] = useState<'全部' | WritingType>('全部')
  const { groupFilter, subFilter, statusFilter } = useMemo(
    () => kbFiltersFromSearchParams(searchParams),
    [searchParams],
  )

  const favoriteIds = useMemo(() => new Set(favorites), [favorites])
  const normalizedWritingSearch = useMemo(() => normalizeSearchQuery(deferredSearch), [deferredSearch])
  const masteredNotesCount = useMemo(
    () => notes.reduce((count, note) => count + (note.reviewStatus === 'mastered' ? 1 : 0), 0),
    [notes],
  )
  const englishDupCounts = useMemo(() => englishContentCounts(notes), [notes])
  const duplicateNotesTabCount = useMemo(() => countDuplicateParticipantNotes(notes), [notes])
  const noteCategoryCounts = useMemo(() => {
    const counts = new Map<Category, number>()
    for (const note of notes) {
      counts.set(note.category, (counts.get(note.category) ?? 0) + 1)
    }
    return counts
  }, [notes])
  const statusCountsForSubFilter = useMemo(() => {
    const scoped = notes.filter((note) => subFilter === '全部' || note.category === subFilter)
    return {
      all: scoped.length,
      mastered: scoped.filter((note) => note.reviewStatus === 'mastered').length,
      unmastered: scoped.filter((note) => note.reviewStatus !== 'mastered').length,
    }
  }, [notes, subFilter])
  const writingTypeCounts = useMemo(() => {
    const counts: Record<'全部' | WritingType, number> = {
      全部: writingNotes.length,
      大作文: 0,
      小作文: 0,
    }
    for (const note of writingNotes) {
      counts[note.writingType] += 1
    }
    return counts
  }, [writingNotes])

  const filteredNotes = useMemo(() => notes.filter((n) => {
    if (groupFilter === '写作' || groupFilter === '收藏夹') return false
    if (groupFilter === '重复笔记' && !isNoteEnglishDuplicate(n, englishDupCounts)) return false
    if (groupFilter === '已掌握' && n.reviewStatus !== 'mastered') return false
    if (groupFilter === '杂笔记') {
      if (subFilter !== '全部' && n.category !== subFilter) return false
      if (statusFilter === 'mastered' && n.reviewStatus !== 'mastered') return false
      if (statusFilter === 'unmastered' && n.reviewStatus === 'mastered') return false
    }
    return noteMatchesPrimarySearch(n, deferredSearch)
  }), [deferredSearch, englishDupCounts, groupFilter, notes, statusFilter, subFilter])

  const favNotes = useMemo(() => notes.filter((n) => {
    if (!favoriteIds.has(n.id)) return false
    return noteMatchesPrimarySearch(n, deferredSearch)
  }), [deferredSearch, favoriteIds, notes])

  const filteredWritingNotes = useMemo(() => writingNotes.filter((w) => {
    if (writingSubFilter !== '全部' && w.writingType !== writingSubFilter) return false
    return !normalizedWritingSearch || w.name.toLowerCase().includes(normalizedWritingSearch)
  }), [normalizedWritingSearch, writingNotes, writingSubFilter])

  const showWriting = groupFilter === '全部' || groupFilter === '写作'
  const showNotes = groupFilter === '全部' || groupFilter === '杂笔记' || groupFilter === '已掌握' || groupFilter === '重复笔记'
  const showFavorites = groupFilter === '收藏夹'

  const allItems = useMemo(() => {
    if (!showNotes) return []
    if (groupFilter === '重复笔记') return sortDuplicateNotesByEnglishCluster(filteredNotes)
    return filteredNotes
  }, [filteredNotes, groupFilter, showNotes])
  const canBatchDelete = showNotes || showFavorites
  const visibleDeletableIds = useMemo(() => new Set<string>([
    ...allItems.map((note) => note.id),
    ...(showFavorites ? favNotes.map((note) => note.id) : []),
  ]), [allItems, favNotes, showFavorites])
  const selectedVisibleNoteIds = useMemo(
    () => selectedNoteIds.filter((id) => visibleDeletableIds.has(id)),
    [selectedNoteIds, visibleDeletableIds],
  )

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
    if (selectedVisibleNoteIds.length === 0 || batchDeleting) return
    const ok = window.confirm(`确认删除选中的 ${selectedVisibleNoteIds.length} 条笔记吗？此操作不可撤销。`)
    if (!ok) return

    setBatchDeleting(true)
    const targets = [...selectedVisibleNoteIds]
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
    if (!lastAddedNoteId) return
    const hit = showNotes && allItems.some((n) => n.id === lastAddedNoteId)
    if (!hit) return
    const target = noteRefs.current[lastAddedNoteId]
    if (!target) return

    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.add('note-added-highlight')
    clearLastAddedNoteId()

    const timer = window.setTimeout(() => target.classList.remove('note-added-highlight'), 1200)
    return () => {
      window.clearTimeout(timer)
      target.classList.remove('note-added-highlight')
    }
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
            { g: '已掌握' as const, icon: LayoutGrid, count: masteredNotesCount, activeClass: 'bg-[#0e2a1f] border-[#34d399] text-[#86efac]', activeIcon: 'text-[#34d399]', activeBadge: 'bg-[#34d399]/20 text-[#34d399]' },
            { g: '重复笔记' as const, icon: Copy, count: duplicateNotesTabCount, activeClass: 'bg-[#2a220e] border-[#f59e0b] text-[#fcd34d]', activeIcon: 'text-[#f59e0b]', activeBadge: 'bg-[#f59e0b]/20 text-[#f59e0b]' },
          ]).map(({ g, icon: Icon, count, activeClass, activeIcon, activeBadge }) => (
            <motion.button
              key={g}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setWritingSubFilter('全部')
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
              const count = writingTypeCounts[cat]
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
                  : noteCategoryCounts.get(cat) ?? 0
                const isActive = subFilter === cat
                return (
                  <motion.button
                    key={cat}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
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
                  ? statusCountsForSubFilter.all
                  : item.key === 'mastered'
                    ? statusCountsForSubFilter.mastered
                    : statusCountsForSubFilter.unmastered
                return (
                  <motion.button
                    key={item.key}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
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
            <span className="text-sm text-[#fecaca]">已选择 {selectedVisibleNoteIds.length} 条笔记</span>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={selectedVisibleNoteIds.length === 0 || batchDeleting}
              onClick={() => { void handleConfirmBatchDelete() }}
            >
              {batchDeleting ? '删除中...' : `确认删除 ${selectedVisibleNoteIds.length} 条笔记`}
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
              <VirtualizedNoteGrid
                notes={allItems}
                batchDeleteMode={batchDeleteMode}
                selectedNoteIds={selectedVisibleNoteIds}
                noteRefs={noteRefs}
                onToggleSelected={toggleSelectedNote}
                mainScrollTop={mainScrollTop}
                mainViewportHeight={mainViewportHeight}
              />
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <EmptyState
                  title={
                    search
                      ? '未找到相关笔记'
                      : groupFilter === '重复笔记'
                        ? '暂无英文重复的笔记'
                        : `暂无${subFilter !== '全部' ? subFilter : ''}笔记`
                  }
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
              <VirtualizedNoteGrid
                notes={favNotes}
                batchDeleteMode={batchDeleteMode}
                selectedNoteIds={selectedVisibleNoteIds}
                noteRefs={noteRefs}
                onToggleSelected={toggleSelectedNote}
                mainScrollTop={mainScrollTop}
                mainViewportHeight={mainViewportHeight}
              />
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

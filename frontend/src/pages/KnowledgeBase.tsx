import { useState, type Dispatch, type SetStateAction } from 'react'
import { Search, FileText, CirclePlus, Plus, LayoutGrid, NotebookPen } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { CATEGORY_BAR, CATEGORY_COLORS, type Category } from '../data/mockData'
import { useAppStore } from '../store/useAppStore'

const SUB_CATS: (Category | '全部')[] = ['全部', '口语', '短语', '句子', '同义替换', '拼写', '单词']

// Mock writing notes
const WRITING_NOTES = [
  { id: 'w1', name: '雅思写作Task 2模板.md', path: '/notes/writing/task2-template.md', updatedAt: '2天前' },
  { id: 'w2', name: '大作文高分句型整理.md', path: '/notes/writing/high-score-phrases.md', updatedAt: '5天前' },
]

function kbFiltersFromSearchParams(searchParams: URLSearchParams): {
  groupFilter: '全部' | '杂笔记' | '写作'
  subFilter: Category | '全部'
} {
  const group = searchParams.get('group')
  const cat = searchParams.get('cat')
  if (group === '写作') return { groupFilter: '写作', subFilter: '全部' }
  if (group === '杂笔记') {
    const sub: Category | '全部' = cat ? (cat as Category) : '全部'
    return { groupFilter: '杂笔记', subFilter: sub }
  }
  return { groupFilter: '全部', subFilter: '全部' }
}

function searchParamsFilterKey(searchParams: URLSearchParams) {
  return `${searchParams.get('group') ?? ''}|${searchParams.get('cat') ?? ''}`
}

type KnowledgeBaseMainProps = {
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  searchParams: URLSearchParams
}

function KnowledgeBaseMain({ search, setSearch, searchParams }: KnowledgeBaseMainProps) {
  const { notes, openQuickNote } = useAppStore()
  const navigate = useNavigate()
  const [groupFilter, setGroupFilter] = useState(
    () => kbFiltersFromSearchParams(searchParams).groupFilter
  )
  const [subFilter, setSubFilter] = useState(
    () => kbFiltersFromSearchParams(searchParams).subFilter
  )

  const filteredNotes = notes.filter((n) => {
    if (groupFilter === '写作') return false
    if (groupFilter === '杂笔记') {
      if (subFilter !== '全部' && n.category !== subFilter) return false
    }
    const matchSearch = !search ||
      n.content.toLowerCase().includes(search.toLowerCase()) ||
      n.translation.includes(search)
    return matchSearch
  })

  const showWriting = groupFilter === '全部' || (groupFilter as string) === '写作'
  const showNotes = groupFilter === '全部' || (groupFilter as string) === '杂笔记'

  const allItems = [
    ...(showNotes ? filteredNotes : []),
  ]

  return (
      <div className="p-8 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-text-primary">知识库</h1>
            <p className="text-sm text-text-dim mt-1">管理和浏览所有笔记</p>
          </div>
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
        <div className="flex items-center gap-1.5">
          {([
            { g: '全部' as const, icon: LayoutGrid, count: notes.length + WRITING_NOTES.length },
            { g: '杂笔记' as const, icon: NotebookPen, count: notes.length },
            { g: '写作' as const, icon: FileText, count: WRITING_NOTES.length },
          ]).map(({ g, icon: Icon, count }) => (
            <motion.button
              key={g}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => { setGroupFilter(g); setSubFilter('全部') }}
              className={`flex items-center gap-1.5 h-9 px-4 rounded-md text-[13px] font-medium border transition-all ${
                groupFilter === g
                  ? 'bg-[#1e1b4b] border-[#4338ca] text-[#c7d2fe]'
                  : 'border-border text-text-dim hover:border-border-strong hover:text-text-muted hover:bg-[#27272a]/40'
              }`}
            >
              <Icon size={13} className={groupFilter === g ? 'text-primary' : 'text-text-subtle'} />
              {g}
              <span className={`text-[10px] font-normal px-1.5 py-0.5 rounded-full ml-0.5 ${
                groupFilter === g ? 'bg-primary/20 text-primary' : 'bg-border text-text-subtle'
              }`}>
                {count}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Sub-type pills — with color dots and note counts */}
        {(groupFilter === '杂笔记' || groupFilter === '全部') && (
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
                  onClick={() => setSubFilter(cat)}
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
        )}

        {/* Search row — deeper bg, taller */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 h-11 min-h-11 bg-[#0d0d10] border border-border rounded-md px-3.5 focus-within:border-primary/40 transition-colors">
            <Search size={14} className="text-text-dim shrink-0" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`搜索${subFilter !== '全部' ? subFilter : ''}笔记...`}
              size="md"
              className="flex-1 border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 h-9 min-h-9 px-0 rounded-none placeholder:text-text-subtle"
              aria-label="搜索笔记"
            />
          </div>
        </div>

        {/* Content */}
        {showWriting && (
          <div className="flex flex-col gap-3">
            {groupFilter !== '杂笔记' && (
              <h3 className="text-sm font-semibold text-text-muted">写作文件</h3>
            )}
            <div className="grid grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
              {WRITING_NOTES.map((w, i) => (
                <motion.div
                  key={w.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: i * 0.04 }}
                  onClick={() => navigate(`/kb/w/${w.id.replace(/^w/, '')}`)}
                  className="relative bg-surface-card border border-border rounded-lg overflow-hidden cursor-pointer hover:-translate-y-0.5 transition-transform group"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: '#94a3b8' }} />
                  <div className="pl-5 pr-4 py-3.5 flex flex-col gap-2 items-start">
                    <span
                      className="self-start w-fit inline-flex items-center gap-1 px-1.5 py-0 text-[10px] leading-4 font-medium rounded whitespace-nowrap"
                      style={{ color: '#94a3b8', background: '#1e293b', border: '1px solid #334155' }}
                    >
                      <FileText size={9} />写作
                    </span>
                    <div className="flex items-start gap-2">
                      <FileText size={14} className="text-[#94a3b8] mt-0.5 shrink-0" />
                      <div className="text-[13px] font-medium text-text-primary group-hover:text-white transition-colors leading-snug">
                        {w.name}
                      </div>
                    </div>
                    <div className="text-[11px] text-text-subtle truncate">{w.path}</div>
                    <div className="flex items-center">
                      <span className="text-[11px] text-text-subtle flex-1">{w.updatedAt}</span>
                      <span className="text-[11px] text-[#94a3b8]">文件</span>
                    </div>
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
                {allItems.map((note, i) => {
                  const barColor = CATEGORY_BAR[note.category] ?? '#71717a'
                  const catColors = CATEGORY_COLORS[note.category]
                  return (
                    <motion.div
                      key={note.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                      onClick={() => navigate(`/kb/${note.id}`)}
                      className="relative bg-surface-card border border-border rounded-lg overflow-hidden cursor-pointer hover:-translate-y-0.5 transition-transform group"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: barColor }} />
                      <div className="pl-5 pr-4 py-3.5 flex flex-col gap-2 items-start">
                        <Badge category={note.category} />
                        <div className="text-[14px] font-semibold text-text-primary group-hover:text-white transition-colors">
                          {note.content}
                        </div>
                        <div className="text-[12px] text-text-muted leading-snug">{note.translation}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-text-subtle flex-1">{note.createdAt}</span>
                          {note.dueToday && (
                            <span className="text-[11px]" style={{ color: catColors?.color ?? '#818cf8' }}>待复习</span>
                          )}
                          {note.reviewStatus === 'mastered' && (
                            <span className="text-[11px] text-cat-phrase">已掌握</span>
                          )}
                          {note.reviewStatus === 'learning' && (
                            <span className="text-[11px] text-primary">学习中</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
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
      </div>
  )
}

export default function KnowledgeBase() {
  const [searchParams] = useSearchParams()
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
        key={searchParamsFilterKey(searchParams)}
        search={search}
        setSearch={setSearch}
        searchParams={searchParams}
      />
    </Layout>
  )
}

import { useState, useEffect } from 'react'
import { Search, Tag, ChevronDown, FileText, CirclePlus, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Badge } from '../components/ui/Badge'
import { CATEGORY_BAR, CATEGORY_COLORS, type Category } from '../data/mockData'
import { useAppStore } from '../store/useAppStore'

const SUB_CATS: (Category | '全部')[] = ['全部', '口语', '短语', '句子', '同义替换', '拼写', '单词']

// Mock writing notes
const WRITING_NOTES = [
  { id: 'w1', name: '雅思写作Task 2模板.md', path: '/notes/writing/task2-template.md', updatedAt: '2天前' },
  { id: 'w2', name: '大作文高分句型整理.md', path: '/notes/writing/high-score-phrases.md', updatedAt: '5天前' },
]

export default function KnowledgeBase() {
  const { notes, openQuickNote } = useAppStore()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<'全部' | '杂笔记' | '写作'>('全部')
  const [subFilter, setSubFilter] = useState<Category | '全部'>('全部')
  const [showTagDrop, setShowTagDrop] = useState(false)

  // Sync URL params from sidebar clicks
  useEffect(() => {
    const group = searchParams.get('group')
    const cat = searchParams.get('cat')
    if (group === '写作') {
      setGroupFilter('写作')
      setSubFilter('全部')
    } else if (group === '杂笔记') {
      setGroupFilter('杂笔记')
      if (cat) setSubFilter(cat as Category)
      else setSubFilter('全部')
    }
  }, [searchParams])

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
    <Layout title="知识库">
      <div className="p-8 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-text-primary">知识库</h1>
            <p className="text-sm text-text-dim mt-1">管理和浏览所有笔记</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={openQuickNote}
            className="flex items-center gap-1.5 h-9 px-4 bg-primary-btn hover:bg-[#4338ca] rounded-sm text-white text-[13px] font-medium transition-colors"
          >
            <Plus size={14} />
            添加笔记
          </motion.button>
        </div>

        {/* Group Tabs */}
        <div className="flex items-center gap-2">
          {(['全部', '杂笔记', '写作'] as const).map((g) => (
            <button
              key={g}
              onClick={() => { setGroupFilter(g); setSubFilter('全部') }}
              className={`h-8 px-4 rounded-sm text-[13px] font-medium border transition-all ${
                groupFilter === g
                  ? 'bg-[#312e81] border-[#4338ca] text-[#c7d2fe]'
                  : 'border-border text-text-dim hover:border-border-strong hover:text-text-muted'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Sub-type pills — only when 杂笔记 or 全部 */}
        {(groupFilter === '杂笔记' || groupFilter === '全部') && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {SUB_CATS.map((cat) => {
              const color = cat !== '全部' ? CATEGORY_COLORS[cat]?.color : undefined
              const bg = cat !== '全部' ? CATEGORY_COLORS[cat]?.bg : undefined
              const border = cat !== '全部' ? CATEGORY_COLORS[cat]?.border : undefined
              const isActive = subFilter === cat
              return (
                <motion.button
                  key={cat}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSubFilter(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    isActive && cat !== '全部'
                      ? ''
                      : isActive
                        ? 'bg-primary-btn text-white'
                        : 'border border-border text-text-dim hover:text-text-muted'
                  }`}
                  style={isActive && cat !== '全部' ? { color, background: bg, border: `1px solid ${border}` } : {}}
                >
                  {cat}
                </motion.button>
              )
            })}
          </div>
        )}

        {/* Search row */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 h-9 bg-surface-sidebar border border-border rounded-sm px-3">
            <Search size={14} className="text-text-dim shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`搜索${subFilter !== '全部' ? subFilter : ''}笔记...`}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-subtle outline-none"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowTagDrop(!showTagDrop)}
              className="flex items-center gap-2 h-9 px-3 border border-border rounded-sm text-text-dim hover:text-text-muted hover:bg-[#27272a] transition-colors text-sm"
            >
              <Tag size={13} />
              筛选标签
              <ChevronDown size={12} />
            </button>
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
                  onClick={() => navigate(`/kb/${w.id}`)}
                  className="relative bg-surface-card border border-border rounded-lg overflow-hidden cursor-pointer hover:-translate-y-0.5 transition-transform group"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: '#94a3b8' }} />
                  <div className="pl-5 pr-4 py-3.5 flex flex-col gap-2">
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0 text-[10px] leading-4 font-medium rounded whitespace-nowrap"
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
                      <div className="pl-5 pr-4 py-3.5 flex flex-col gap-2">
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
              <div className="flex flex-col items-center gap-3 py-16 text-text-dim">
                <CirclePlus size={32} className="text-border-strong" />
                <span className="text-sm">
                  {search ? '未找到相关笔记' : `添加更多${subFilter !== '全部' ? subFilter : ''}笔记以填充知识库`}
                </span>
                <button
                  onClick={openQuickNote}
                  className="text-xs text-primary hover:text-[#a5b4fc] transition-colors"
                >
                  + 添加笔记
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

import { useState } from 'react'
import { Search, Filter } from 'lucide-react'
import { motion } from 'framer-motion'
import { Layout } from '../components/layout/Layout'
import { NoteCard } from '../components/ui/NoteCard'
import { Badge } from '../components/ui/Badge'
import { useAppStore } from '../store/useAppStore'
import { type Category } from '../data/mockData'

const FILTERS: (Category | '全部')[] = ['全部', '口语', '短语', '句子', '同义替换', '拼写', '单词', '写作']

export default function KnowledgeBase() {
  const { notes } = useAppStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Category | '全部'>('全部')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const filtered = notes.filter((n) => {
    const matchCat = filter === '全部' || n.category === filter
    const matchSearch = !search ||
      n.content.toLowerCase().includes(search.toLowerCase()) ||
      n.translation.includes(search)
    return matchCat && matchSearch
  })

  return (
    <Layout title="知识库">
      <div className="p-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-text-primary">知识库</h1>
            <p className="text-sm text-text-dim mt-1">共 {notes.length} 条笔记</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('grid')}
              className={`h-8 px-3 text-xs rounded-sm border transition-colors ${view === 'grid' ? 'border-primary bg-[#1e1b4b] text-primary' : 'border-border text-text-dim hover:text-text-muted'}`}
            >
              网格
            </button>
            <button
              onClick={() => setView('list')}
              className={`h-8 px-3 text-xs rounded-sm border transition-colors ${view === 'list' ? 'border-primary bg-[#1e1b4b] text-primary' : 'border-border text-text-dim hover:text-text-muted'}`}
            >
              列表
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 h-9 bg-[#1c1c20] border border-border rounded-sm px-3">
            <Search size={14} className="text-text-dim shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索笔记内容或释义..."
              className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-subtle outline-none"
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Filter size={14} className="text-text-dim" />
            {FILTERS.map((f) => (
              <motion.button
                key={f}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-primary-btn text-white'
                    : 'border border-border text-text-dim hover:text-text-muted'
                }`}
              >
                {f}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Content */}
        {view === 'grid' ? (
          <div className="columns-3 gap-4">
            {filtered.map((note, i) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="break-inside-avoid mb-4"
              >
                <NoteCard note={note} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {filtered.map((note, i) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center gap-4 py-3 hover:bg-[#27272a]/30 px-2 rounded transition-colors cursor-pointer"
              >
                <Badge category={note.category} />
                <div className="flex-1 min-w-0">
                  <span className="text-[14px] font-medium text-text-primary mr-2">{note.content}</span>
                  <span className="text-[13px] text-text-muted">{note.translation}</span>
                </div>
                <span className="text-[11px] text-text-subtle shrink-0">{note.createdAt}</span>
              </motion.div>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-20 text-text-dim text-sm">未找到相关笔记</div>
        )}
      </div>
    </Layout>
  )
}

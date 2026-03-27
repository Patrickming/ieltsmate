import { CirclePlay, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { StatCard } from '../components/ui/StatCard'
import { NoteCard } from '../components/ui/NoteCard'
import { useAppStore } from '../store/useAppStore'
import { mockStats, type Category } from '../data/mockData'

const FILTERS: (Category | '全部')[] = ['全部', '口语', '短语', '句子', '同义替换', '拼写', '单词', '写作']

export default function Dashboard() {
  const navigate = useNavigate()
  const { notes, activeFilter, setFilter, openQuickNote, startReview } = useAppStore()

  const filtered = activeFilter === '全部'
    ? notes
    : notes.filter((n) => n.category === activeFilter)

  const handleStartReview = () => {
    const dueCards = notes.filter((n) => n.dueToday)
    if (dueCards.length > 0) {
      startReview(dueCards)
      navigate('/review/cards')
    }
  }

  return (
    <Layout title="首页">
      <div className="p-8 flex flex-col gap-6">
        {/* Section header */}
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-text-primary">仪表盘</h1>
            <p className="text-sm text-text-dim mt-1">今日学习与知识库概览</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleStartReview}
              className="flex items-center gap-1.5 h-9 px-4 bg-primary-btn hover:bg-[#4338ca] rounded-sm text-white text-[13px] font-medium transition-colors"
            >
              <CirclePlay size={14} />
              开始今日复习
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={openQuickNote}
              className="flex items-center gap-1.5 h-9 px-4 border border-border rounded-sm text-text-muted hover:text-text-secondary hover:bg-[#27272a] text-[13px] transition-colors"
            >
              <Plus size={14} />
              添加新笔记
            </motion.button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard value={mockStats.dueToday} label="今日待复习" sublabel="含到期+新卡" accentColor="#818cf8" />
          <StatCard value={mockStats.mastered} label="已掌握" sublabel="占全部 65%" accentColor="#34d399" />
          <StatCard value={mockStats.streak} label="连续学习天数" sublabel="按自然日累计" accentColor="#fbbf24" />
          <StatCard value={mockStats.total} label="总笔记" sublabel="知识库条数" accentColor="#fb7185" />
        </div>

        {/* Recent section */}
        <div className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-text-secondary">最近添加</h2>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTERS.map((f) => (
              <motion.button
                key={f}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeFilter === f
                    ? 'bg-primary-btn text-white'
                    : 'border border-border text-text-dim hover:text-text-muted hover:border-border-strong'
                }`}
              >
                {f}
              </motion.button>
            ))}
          </div>

          {/* Cards grid - 3 columns */}
          <div className="columns-3 gap-4 space-y-4">
            {filtered.map((note, i) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="break-inside-avoid mb-4"
              >
                <NoteCard note={note} />
              </motion.div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-text-dim text-sm">
              该分类暂无笔记
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

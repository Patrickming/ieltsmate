import { motion } from 'framer-motion'
import { CATEGORY_COLORS, CATEGORY_BAR } from '../../data/mockData'
import type { Note } from '../../data/mockData'
import { Badge } from './Badge'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'

interface NoteCardProps {
  note: Note
}

export function NoteCard({ note }: NoteCardProps) {
  const navigate = useNavigate()
  const setSelectedNote = useAppStore((s) => s.setSelectedNote)
  const barColor = CATEGORY_BAR[note.category] ?? '#71717a'

  const handleClick = () => {
    setSelectedNote(note)
    navigate(`/kb/${note.id}`)
  }

  return (
    <motion.div
      onClick={handleClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className="relative bg-surface-card border border-border rounded-lg overflow-hidden cursor-pointer group"
    >
      {/* Left color bar — extends on hover */}
      <motion.div
        className="absolute left-0 top-0 w-[3px] rounded-r-full"
        style={{ background: barColor }}
        initial={{ height: '70%', top: '15%' }}
        whileHover={{ height: '100%', top: '0%' }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      />
      <div className="pl-5 pr-4 py-3.5 flex flex-col gap-2 items-start">
        <Badge category={note.category} />
        <div className="text-[15px] font-semibold text-text-primary group-hover:text-white transition-colors">
          {note.content}
        </div>
        <div className="text-[13px] text-text-muted leading-snug">{note.translation}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-text-subtle flex-1">{note.createdAt}</span>
          {note.dueToday && (
            <span className="text-[11px]" style={{ color: CATEGORY_COLORS[note.category]?.color ?? '#818cf8' }}>
              待复习
            </span>
          )}
          {note.reviewStatus === 'mastered' && (
            <span className="text-[11px] text-cat-phrase">已掌握</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

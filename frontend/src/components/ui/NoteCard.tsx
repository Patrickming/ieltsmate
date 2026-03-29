import { motion } from 'framer-motion'
import { CATEGORY_BAR } from '../../data/mockData'
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
    const main = document.querySelector('main')
    if (main) sessionStorage.setItem(`scroll-y:${window.location.pathname}`, String(main.scrollTop))
    setSelectedNote(note)
    navigate(`/kb/${note.id}`)
  }

  return (
    <motion.div
      onClick={handleClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className="relative bg-surface-card border border-border rounded-xl overflow-hidden cursor-pointer group"
    >
      {/* Top color accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: barColor }} />
      <div className="px-5 py-8 flex flex-col gap-2 items-center text-center">
        <Badge category={note.category} />
        <div className="text-[22px] font-bold text-text-primary group-hover:text-white transition-colors w-full truncate leading-tight">
          {note.content}
        </div>
        <div className="text-[15px] text-text-muted w-full truncate">{note.translation}</div>
      </div>
    </motion.div>
  )
}

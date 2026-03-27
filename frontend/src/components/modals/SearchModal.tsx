import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import { Badge } from '../ui/Badge'

export function SearchModal() {
  const { showSearch, closeSearch, notes, setSelectedNote } = useAppStore()
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const results = query.trim()
    ? notes.filter(
        (n) =>
          n.content.toLowerCase().includes(query.toLowerCase()) ||
          n.translation.includes(query)
      ).slice(0, 8)
    : notes.slice(0, 6)

  useEffect(() => {
    if (showSearch) {
      setQuery('')
      setHighlighted(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [showSearch])

  useEffect(() => {
    setHighlighted(0)
  }, [query])

  const handleSelect = (idx: number) => {
    const note = results[idx]
    if (!note) return
    setSelectedNote(note)
    navigate(`/kb/${note.id}`)
    closeSearch()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!showSearch) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlighted((h) => Math.min(h + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlighted((h) => Math.max(h - 1, 0))
      } else if (e.key === 'Enter') {
        handleSelect(highlighted)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showSearch, highlighted, results])

  return (
    <AnimatePresence>
      {showSearch && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={closeSearch}
          />
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-1/2 top-[20%] -translate-x-1/2 z-50 w-[560px] bg-[#1c1c20] border border-[#2a2a35] rounded-xl shadow-modal overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-2.5 h-13 px-4 border-b border-border">
              <Search size={16} className="text-primary shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索笔记..."
                className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-dim outline-none py-3.5"
                onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-text-dim hover:text-text-muted text-xs">
                  清空
                </button>
              )}
            </div>

            {/* Results */}
            <div className="p-1.5">
              {results.map((note, i) => (
                <motion.button
                  key={note.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handleSelect(i)}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`w-full flex items-center gap-3 h-15 px-3 rounded-md transition-colors ${
                    i === highlighted ? 'bg-[#1e1e2e]' : 'hover:bg-[#27272a]/50'
                  }`}
                >
                  <Badge category={note.category} />
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-[14px] font-medium text-text-primary truncate">{note.content}</div>
                    <div className="text-xs text-text-dim truncate">{note.translation}</div>
                  </div>
                </motion.button>
              ))}

              {results.length === 0 && (
                <div className="text-center py-6 text-text-dim text-sm">未找到相关笔记</div>
              )}
            </div>

            {/* Footer hint */}
            <div className="h-9 border-t border-border flex items-center px-4 justify-between">
              <span className="text-[11px] text-text-dim">↑↓ 导航&nbsp; ⏎ 打开&nbsp; esc 关闭</span>
              <span className="text-[11px] text-text-subtle">{results.length} 条结果</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

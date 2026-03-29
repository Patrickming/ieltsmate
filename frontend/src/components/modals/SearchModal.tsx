import { useState, useEffect, useRef, useCallback } from 'react'
import { Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import { adjustSearchHighlight } from '../../utils/searchHighlight'
import { Badge } from '../ui/Badge'
import { ModalShell } from '../ui/ModalShell'

function SearchModalPanel() {
  const { closeSearch, notes, setSelectedNote } = useAppStore()
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [])

  const results = query.trim()
    ? notes.filter(
        (n) =>
          n.content.toLowerCase().includes(query.toLowerCase()) ||
          n.translation.includes(query)
      ).slice(0, 8)
    : notes.slice(0, 6)

  const handleSelect = useCallback(
    (idx: number) => {
      const note = results[idx]
      if (!note) return
      setSelectedNote(note)
      navigate(`/kb/${note.id}`)
      closeSearch()
    },
    [results, setSelectedNote, navigate, closeSearch]
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlighted((h) => adjustSearchHighlight(h, 1, results.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlighted((h) => adjustSearchHighlight(h, -1, results.length))
      } else if (e.key === 'Enter') {
        handleSelect(highlighted)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [highlighted, results.length, handleSelect])

  const updateQuery = (next: string) => {
    setQuery(next)
    setHighlighted(0)
  }

  return (
    <div className="w-[560px] bg-[#1c1c20] border border-[#2a2a35] rounded-xl shadow-modal overflow-hidden">
      {/* Search input */}
      <div className="flex items-center gap-2.5 h-13 px-4 border-b border-border">
        <Search size={16} className="text-primary shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          placeholder="搜索笔记..."
          className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-dim outline-none py-3.5"
          onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
        />
        {query && (
          <button
            type="button"
            onClick={() => updateQuery('')}
            className="text-text-dim hover:text-text-muted text-xs"
          >
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
            type="button"
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
    </div>
  )
}

export function SearchModal() {
  const { showSearch, closeSearch } = useAppStore()
  return (
    <ModalShell open={showSearch} onClose={closeSearch}>
      <SearchModalPanel />
    </ModalShell>
  )
}

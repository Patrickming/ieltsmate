import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import { Badge } from '../ui/Badge'
import { CATEGORIES, type Category } from '../../data/mockData'

// Simulated AI detection
function detectCategory(text: string): Category {
  if (/[A-Z][a-z]+/.test(text) && !text.includes('—') && !text.includes('=')) return '单词'
  if (text.includes('=') || text.includes('→')) return '同义替换'
  if (text.includes('—') || text.split(' ').length > 3) return '短语'
  return '口语'
}

export function QuickNoteModal() {
  const { showQuickNote, closeQuickNote } = useAppStore()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'ai' | 'manual'>('ai')
  const [manualCat, setManualCat] = useState<Category>('短语')
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Focus trap
  const handleTabKey = useCallback((e: KeyboardEvent) => {
    if (!showQuickNote || !modalRef.current) return
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
  }, [showQuickNote])

  useEffect(() => {
    window.addEventListener('keydown', handleTabKey)
    return () => window.removeEventListener('keydown', handleTabKey)
  }, [handleTabKey])

  const aiCategory = detectCategory(text)
  const finalCategory = mode === 'ai' ? aiCategory : manualCat

  useEffect(() => {
    if (showQuickNote) {
      setText('')
      setSaved(false)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [showQuickNote])

  const handleSave = () => {
    if (!text.trim()) return
    setSaved(true)
    setTimeout(() => {
      closeQuickNote()
      setSaved(false)
    }, 800)
  }

  return (
    <AnimatePresence>
      {showQuickNote && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={closeQuickNote}
          />
          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ position: 'fixed', left: '50%', top: '50%', translateX: '-50%', translateY: '-50%', zIndex: 50, width: 520 }}
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label="快速记录"
            className="bg-[#1c1c20] border border-[#2a2a35] rounded-xl shadow-modal"
          >
            <div className="p-6 flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-text-primary">📝 快速记录</span>
                <button onClick={closeQuickNote} className="text-text-dim hover:text-text-muted transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Input */}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="get out of — 避免"
                rows={3}
                className="w-full bg-[#141420] border border-[#3a3a4a] rounded-md px-3.5 py-2.5 text-[15px] text-text-primary placeholder-text-subtle outline-none resize-none focus:border-primary/60 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
                  if (e.key === 'Escape') closeQuickNote()
                }}
              />

              {/* Category mode */}
              <div className="border border-border rounded-md p-3.5 flex flex-col gap-2.5">
                <span className="text-xs font-semibold text-text-dim">分类设置</span>
                <div className="flex items-center gap-4">
                  {(['ai', 'manual'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className="flex items-center gap-1.5"
                    >
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        mode === m ? 'border-primary bg-[#1e1e2e]' : 'border-border bg-[#232328]'
                      }`}>
                        {mode === m && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </div>
                      <span className={`text-[13px] ${mode === m ? 'text-text-primary' : 'text-text-dim'}`}>
                        {m === 'ai' ? 'AI 自动识别' : '手动选择'}
                      </span>
                    </button>
                  ))}
                </div>

                {mode === 'manual' && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {CATEGORIES.map(({ name }) => (
                      <button
                        key={name}
                        onClick={() => setManualCat(name)}
                        className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                          manualCat === name ? 'bg-primary-btn text-white' : 'border border-border text-text-dim hover:text-text-muted'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* AI preview */}
              {text.trim() && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-[#141428] border border-[#3a3a5a] rounded-md px-3.5 py-3"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles size={11} className="text-primary" />
                    <span className="text-[11px] font-semibold text-primary">AI 识别预览</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge category={finalCategory} />
                      <span className="text-[13px] text-text-secondary">{text.split('—')[0]?.trim() || text}</span>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 text-xs bg-[#1e1e2e] border border-primary rounded-sm text-[#a5b4fc] hover:bg-primary/20 transition-colors">
                        确认
                      </button>
                      <button className="px-3 py-1 text-xs border border-border rounded-sm text-text-dim hover:bg-[#27272a] transition-colors">
                        修改
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5">
                <button
                  onClick={closeQuickNote}
                  className="h-9 px-5 border border-border rounded-md text-[13px] text-text-dim hover:bg-[#27272a] transition-colors"
                >
                  取消
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSave}
                  disabled={!text.trim()}
                  className={`h-9 px-5 rounded-md text-[13px] font-medium transition-all ${
                    saved
                      ? 'bg-[#064e3b] text-[#34d399]'
                      : 'bg-primary-btn hover:bg-[#4338ca] text-white disabled:opacity-50'
                  }`}
                >
                  {saved ? '✓ 已保存' : '保存笔记'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

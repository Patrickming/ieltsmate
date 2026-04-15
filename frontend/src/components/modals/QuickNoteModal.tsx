import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Sparkles, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import { apiUrl } from '../../lib/apiBase'
import { Badge } from '../ui/Badge'
import { CATEGORIES, type Category } from '../../data/mockData'

const VALID_CATEGORIES: Category[] = ['口语', '短语', '句子', '同义替换', '拼写', '单词', '写作']

// Keyword-based fallback (used when AI is not configured or fails)
function detectCategoryFallback(text: string): Category {
  if (/[A-Z][a-z]+/.test(text) && !text.includes('—') && !text.includes('=')) return '单词'
  if (text.includes('=') || text.includes('→')) return '同义替换'
  if (text.includes('—') || text.split(' ').length > 3) return '短语'
  return '口语'
}

const CLASSIFY_SYSTEM_PROMPT = `你是英语学习笔记的分类助手。用户输入一条雅思备考笔记（通常是"英文 — 中文"格式），请从以下分类中选择最合适的一个，只返回该分类的中文名称，不加任何解释：
口语、短语、句子、同义替换、拼写、单词、写作

分类说明：
- 单词：单个词汇（如 abandon、ubiquitous）
- 短语：词组或习语（如 get out of、fall in love with）
- 句子：完整句子或句型模板（如 It is worth noting that...）
- 同义替换：同义/近义替换关系（如 big = large）
- 口语：口语表达、感叹语、日常惯用语
- 拼写：容易拼错的单词（通常只含英文）
- 写作：写作框架、段落模板、议论文结构`

async function classifyWithAI(text: string): Promise<Category | null> {
  try {
    const res = await fetch(apiUrl('/ai/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: CLASSIFY_SYSTEM_PROMPT },
          { role: 'user', content: `请分类：${text.slice(0, 300)}` },
        ],
        slot: 'classify',
      }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: { content?: string } }
    const content = json.data?.content?.trim() ?? ''
    return VALID_CATEGORIES.find((c) => content.includes(c)) ?? null
  } catch {
    return null
  }
}

function QuickNoteModalSurface({ onClose }: { onClose: () => void }) {
  const { addQuickNote } = useAppStore()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'ai' | 'manual'>('ai')
  const [manualCat, setManualCat] = useState<Category>('短语')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveHint, setSaveHint] = useState('')
  // AI classification state
  const [aiCategory, setAiCategory] = useState<Category>('短语')
  const [aiDetecting, setAiDetecting] = useState(false)
  const classifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => textareaRef.current?.focus(), 100)
    return () => window.clearTimeout(t)
  }, [])

  // Focus trap
  const handleTabKey = useCallback((e: KeyboardEvent) => {
    if (!modalRef.current) return
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
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleTabKey)
    return () => window.removeEventListener('keydown', handleTabKey)
  }, [handleTabKey])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  // Trigger AI classification when text changes (only in AI mode)
  useEffect(() => {
    if (mode !== 'ai' || !text.trim()) return
    if (classifyTimerRef.current) clearTimeout(classifyTimerRef.current)
    classifyTimerRef.current = setTimeout(async () => {
      setAiDetecting(true)
      const result = await classifyWithAI(text.trim())
      // Use AI result, fall back to keyword heuristic
      setAiCategory(result ?? detectCategoryFallback(text.trim()))
      setAiDetecting(false)
    }, 800)
    return () => {
      if (classifyTimerRef.current) clearTimeout(classifyTimerRef.current)
    }
  }, [text, mode])

  const finalCategory = mode === 'ai' ? aiCategory : manualCat

  const handleSave = async () => {
    if (!text.trim() || saving) return
    const raw = text.trim()
    const delimiter = raw.includes('—') ? '—' : raw.includes(' - ') ? ' - ' : null
    const [left, right] = delimiter ? raw.split(delimiter, 2) : [raw, '']
    const content = left.trim() || raw
    const translation = right.trim() || '（待补充）'

    setSaving(true)
    const result = await addQuickNote({
      content,
      translation,
      category: finalCategory,
    })
    setSaving(false)
    setSaveHint(
      result.source === 'remote'
        ? '已保存到后端，并更新到当前列表'
        : '后端不可用，已本地保存（联调兜底）'
    )
    setSaved(true)
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => {
      onClose()
      setSaved(false)
      setSaveHint('')
      closeTimerRef.current = null
    }, 800)
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
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
                <button onClick={onClose} className="text-text-dim hover:text-text-muted transition-colors">
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
                  if (e.key === 'Escape') onClose()
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

              {/* AI preview — only shown in AI mode */}
              {mode === 'ai' && text.trim() && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-[#141428] border border-[#3a3a5a] rounded-md px-3.5 py-3"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    {aiDetecting
                      ? <Loader2 size={11} className="text-primary animate-spin" />
                      : <Sparkles size={11} className="text-primary" />
                    }
                    <span className="text-[11px] font-semibold text-primary">
                      {aiDetecting ? 'AI 识别中...' : 'AI 识别预览'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {aiDetecting ? (
                        <div className="h-5 w-12 bg-[#27272a] rounded animate-pulse" />
                      ) : (
                        <Badge category={aiCategory} showEmoji />
                      )}
                      <span className="text-[13px] text-text-secondary truncate max-w-[220px]">
                        {text.split('—')[0]?.trim() || text}
                      </span>
                    </div>
                    {!aiDetecting && (
                      <button
                        onClick={() => { setManualCat(aiCategory); setMode('manual') }}
                        className="px-3 py-1 text-xs border border-border rounded-sm text-text-dim hover:bg-[#27272a] transition-colors shrink-0"
                      >
                        修改
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5">
                {saveHint && (
                  <span className="mr-auto text-[12px] text-text-dim">{saveHint}</span>
                )}
                <button
                  onClick={onClose}
                  className="h-9 px-5 border border-border rounded-md text-[13px] text-text-dim hover:bg-[#27272a] transition-colors"
                >
                  取消
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSave}
                  disabled={!text.trim() || saving}
                  className={`h-9 px-5 rounded-md text-[13px] font-medium transition-all ${
                    saved
                      ? 'bg-[#064e3b] text-[#34d399]'
                      : 'bg-primary-btn hover:bg-[#4338ca] text-white disabled:opacity-50'
                  }`}
                >
                  {saved ? '✓ 已保存' : saving ? '保存中...' : '保存笔记'}
                </motion.button>
              </div>
            </div>
      </motion.div>
    </>
  )
}

export function QuickNoteModal() {
  const { showQuickNote, closeQuickNote } = useAppStore()
  return (
    <AnimatePresence>
      {showQuickNote && (
        <QuickNoteModalSurface key="quick-note-open" onClose={closeQuickNote} />
      )}
    </AnimatePresence>
  )
}

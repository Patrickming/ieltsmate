import { useMemo, useState, useRef, useCallback } from 'react'
import {
  X, Upload, FileText, Sparkles, CheckCircle2, AlertTriangle,
  ChevronDown, RotateCcw, Loader2, TableProperties, Trash2, Pencil,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import { apiUrl } from '../../lib/apiBase'
import type { Category } from '../../data/mockData'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedNote {
  content: string
  translation: string
  category: string
  phonetic?: string
  synonyms?: string[]
  antonyms?: string[]
  example?: string
  memoryTip?: string
}

interface FlaggedItem {
  noteIndex: number
  issue: string
  suggestion: Partial<ParsedNote>
}

interface PreviewResult {
  notes: ParsedNote[]
  flagged: FlaggedItem[]
  stats: {
    total: number
    rulesParsed: number
    aiAssisted: number
    flaggedCount: number
  }
}

type Step = 'select' | 'review' | 'done'
type EditableColumn = 'content' | 'translation' | 'category'

const IMPORT_BUILTIN_CATEGORIES: Array<Category | '未分类'> = [
  '未分类',
  '口语',
  '短语',
  '句子',
  '同义替换',
  '拼写',
  '单词',
  '写作',
]

export function deriveImportCategoryOptions(rows: Array<Pick<ParsedNote, 'category'>>): string[] {
  const customCategories = rows
    .map((r) => r.category?.trim())
    .filter((cat): cat is string => Boolean(cat))

  return Array.from(new Set([...IMPORT_BUILTIN_CATEGORIES, ...customCategories]))
}

export function applyBatchCategoryToRows(
  rows: ParsedNote[],
  targetIndexes: number[],
  category: string,
): ParsedNote[] {
  if (!category.trim()) return rows
  const target = new Set(targetIndexes)
  return rows.map((row, idx) => (target.has(idx) ? { ...row, category } : row))
}

// ── Notes Table Modal ─────────────────────────────────────────────────────────

interface NotesTableProps {
  notes: ParsedNote[]
  onClose: () => void
  onSave: (updated: ParsedNote[]) => void
}

function NotesTableModal({ notes: initialNotes, onClose, onSave }: NotesTableProps) {
  const [rows, setRows] = useState<ParsedNote[]>(() => initialNotes.map((n) => ({ ...n })))
  const [editingCell, setEditingCell] = useState<{ row: number; col: EditableColumn } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [search, setSearch] = useState('')
  const categoryOptions = useMemo(() => deriveImportCategoryOptions(rows), [rows])
  const [batchCategory, setBatchCategory] = useState<string>('未分类')

  const filtered = search
    ? rows.map((r, i) => ({ r, i })).filter(({ r }) =>
        r.content.toLowerCase().includes(search.toLowerCase()) ||
        r.translation.toLowerCase().includes(search.toLowerCase()) ||
        r.category.toLowerCase().includes(search.toLowerCase()),
      )
    : rows.map((r, i) => ({ r, i }))

  const startEdit = (rowIdx: number, col: EditableColumn) => {
    setEditingCell({ row: rowIdx, col })
    setEditValue(rows[rowIdx][col] ?? '')
  }

  const commitEdit = () => {
    if (!editingCell) return
    setRows((prev) =>
      prev.map((r, i) =>
        i === editingCell.row ? { ...r, [editingCell.col]: editValue } : r,
      ),
    )
    setEditingCell(null)
  }

  const deleteRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  const applyBatchCategory = () => {
    const targetIndexes = filtered.map(({ i }) => i)
    if (targetIndexes.length === 0 || !batchCategory.trim()) return
    setRows((prev) => applyBatchCategoryToRows(prev, targetIndexes, batchCategory.trim()))
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col bg-[#0c0c0e]"
    >
      {/* Header */}
      <div className="h-14 border-b border-[#27272a] flex items-center gap-3 px-5 shrink-0">
        <div className="w-8 h-8 bg-[#1e1b4b] rounded-lg flex items-center justify-center">
          <TableProperties size={15} className="text-primary" />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-text-primary">全部笔记</div>
          <div className="text-[11px] text-text-dim">{rows.length} 条 · 点击单元格可编辑</div>
        </div>
        {/* Search */}
        <input
          type="text"
          placeholder="搜索…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 px-3 bg-[#18181b] border border-[#27272a] rounded-md text-xs text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-primary/50 w-44"
        />
        <select
          value={batchCategory}
          onChange={(e) => setBatchCategory(e.target.value)}
          className="h-8 px-2 bg-[#18181b] border border-[#27272a] rounded-md text-xs text-text-primary focus:outline-none focus:border-primary/50"
        >
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <button
          onClick={applyBatchCategory}
          disabled={filtered.length === 0}
          className="h-8 px-3 rounded-md text-[12px] font-medium border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:hover:bg-transparent transition-all"
        >
          批量改分类
        </button>
        <button
          onClick={() => { onSave(rows); onClose() }}
          className="h-8 px-4 rounded-md text-[13px] font-medium bg-primary-btn hover:bg-[#4338ca] text-white transition-all"
        >
          保存更改
        </button>
        <button
          onClick={onClose}
          className="w-7 h-7 bg-[#27272a] rounded-sm flex items-center justify-center text-text-muted hover:bg-[#3f3f46] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-[#111113] z-10">
            <tr className="border-b border-[#27272a]">
              <th className="w-10 py-2.5 px-3 text-right text-[11px] font-semibold text-text-subtle">#</th>
              <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-text-subtle">词条</th>
              <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-text-subtle">释义</th>
              <th className="w-28 py-2.5 px-3 text-left text-[11px] font-semibold text-text-subtle">分类</th>
              <th className="w-10 py-2.5 px-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ r, i }) => (
              <tr
                key={i}
                className="border-b border-[#1c1c20] hover:bg-[#18181b] group"
              >
                <td className="py-2 px-3 text-right text-[11px] text-text-subtle select-none">{i + 1}</td>

                {(['content', 'translation', 'category'] as const).map((col) => (
                  <td key={col} className="py-2 px-3 relative">
                    {editingCell?.row === i && editingCell.col === col ? (
                      col === 'category' ? (
                        <select
                          autoFocus
                          value={editValue || '未分类'}
                          onChange={(e) => {
                            const nextValue = e.target.value
                            setEditValue(nextValue)
                            setRows((prev) =>
                              prev.map((row, rowIdx) =>
                                rowIdx === i ? { ...row, category: nextValue } : row,
                              ),
                            )
                            setEditingCell(null)
                          }}
                          onBlur={() => setEditingCell(null)}
                          className="w-full bg-[#1e1b4b] border border-primary/50 rounded px-2 py-1 text-sm text-text-primary focus:outline-none"
                        >
                          {categoryOptions.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null) }}
                          className="w-full bg-[#1e1b4b] border border-primary/50 rounded px-2 py-1 text-sm text-text-primary focus:outline-none"
                        />
                      )
                    ) : (
                      <div
                        onClick={() => startEdit(i, col)}
                        className={`flex items-center gap-1.5 cursor-pointer rounded px-1 py-0.5 group/cell hover:bg-[#27272a] min-h-[24px] ${
                          col === 'content' ? 'text-text-primary font-medium' :
                          col === 'translation' ? 'text-text-dim' : 'text-text-subtle text-xs'
                        }`}
                      >
                        <span className="flex-1 break-all">{r[col] || <span className="text-text-subtle italic">空</span>}</span>
                        <Pencil size={10} className="shrink-0 opacity-0 group-hover/cell:opacity-50 text-text-subtle transition-opacity" />
                      </div>
                    )}
                  </td>
                ))}

                <td className="py-2 px-3">
                  <button
                    onClick={() => deleteRow(i)}
                    className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-[#2e0f0f] hover:text-[#fb7185] text-text-subtle transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-text-subtle">
            {search ? '没有匹配的笔记' : '暂无笔记'}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="h-10 border-t border-[#27272a] flex items-center px-5 gap-4 shrink-0">
        <span className="text-[11px] text-text-subtle">共 {rows.length} 条</span>
        {search && <span className="text-[11px] text-text-subtle">· 筛选显示 {filtered.length} 条</span>}
        <span className="text-[11px] text-text-subtle ml-auto">Enter 确认 / Esc 取消 编辑</span>
      </div>
    </motion.div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
      className="inline-block"
    >
      <Loader2 size={15} />
    </motion.div>
  )
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ step }: { step: Step }) {
  const steps: Step[] = ['select', 'review', 'done']
  const idx = steps.indexOf(step)
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s, i) => (
        <div
          key={s}
          className={`rounded-full transition-all duration-300 ${
            i < idx
              ? 'w-2 h-2 bg-[#34d399]'
              : i === idx
              ? 'w-5 h-2 bg-primary'
              : 'w-2 h-2 bg-[#3a3a46]'
          }`}
        />
      ))}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function ImportModal() {
  const { showImport, closeImport, providers, loadNotes } = useAppStore()

  const [step, setStep] = useState<Step>('select')
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedModel, setSelectedModel] = useState('')
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [notes, setNotes] = useState<ParsedNote[]>([])
  const [forceAiFill, setForceAiFill] = useState(false)
  const [dismissedFlags, setDismissedFlags] = useState<Set<number>>(new Set())
  const [doneCount, setDoneCount] = useState(0)
  const [tableOpen, setTableOpen] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  // Flatten all model IDs from all providers
  const allModels = providers.flatMap((p) =>
    p.models.map((m) => ({ providerId: p.id, providerName: p.displayName, modelId: m.id, color: p.color })),
  )
  const selectedModelLabel = selectedModel || '使用默认模型'

  // ── Reset ──────────────────────────────────────────────────────────────────

  const resetAndClose = useCallback(() => {
    setStep('select')
    setFile(null)
    setSelectedModel('')
    setLoading(false)
    setError(null)
    setPreview(null)
    setNotes([])
    setForceAiFill(false)
    setDismissedFlags(new Set())
    setDoneCount(0)
    setTableOpen(false)
    closeImport()
  }, [closeImport])

  const goBackToSelect = () => {
    setStep('select')
    setFile(null)
    setError(null)
    setPreview(null)
    setNotes([])
    setForceAiFill(false)
    setDismissedFlags(new Set())
  }

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFileChange = (f: File | null) => {
    if (!f) return
    setFile(f)
    setError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFileChange(f)
  }

  // ── Step 1 → Step 2: Preview ───────────────────────────────────────────────

  const handlePreview = async () => {
    if (!file) return
    if (!file.name.endsWith('.md')) {
      setError('仅支持 .md 文件')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const params = new URLSearchParams()
      if (selectedModel) params.set('modelId', selectedModel)
      if (forceAiFill) params.set('forceAi', '1')
      const qs = params.toString()
      const url = qs ? apiUrl(`/import/notes/preview?${qs}`) : apiUrl('/import/notes/preview')
      const res = await fetch(url, { method: 'POST', body: form })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message ?? `服务器错误 ${res.status}`)
      }
      const json = (await res.json()) as { data?: PreviewResult }
      const data = json.data ?? (json as unknown as PreviewResult)
      setPreview(data)
      setNotes([...data.notes])
      setDismissedFlags(new Set())
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2 → Step 3: Save ─────────────────────────────────────────────────

  const handleSave = async () => {
    if (!notes.length) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(apiUrl('/import/notes/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message ?? `服务器错误 ${res.status}`)
      }
      const json = (await res.json()) as { data?: { created: number } }
      const created = json.data?.created ?? notes.length
      setDoneCount(created)
      setStep('done')
      void loadNotes()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // ── Flagged item actions ───────────────────────────────────────────────────

  const acceptSuggestion = (flag: FlaggedItem) => {
    setNotes((prev) =>
      prev.map((n, i) => (i === flag.noteIndex ? { ...n, ...flag.suggestion } : n)),
    )
    setDismissedFlags((prev) => new Set([...prev, flag.noteIndex]))
  }

  const dismissFlag = (idx: number) => {
    setDismissedFlags((prev) => new Set([...prev, idx]))
  }

  const activeFlags = preview?.flagged.filter((f) => !dismissedFlags.has(f.noteIndex)) ?? []

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {/* Full-screen notes table */}
      {showImport && tableOpen && (
        <NotesTableModal
          key="notes-table"
          notes={notes}
          onClose={() => setTableOpen(false)}
          onSave={(updated) => { setNotes(updated); setTableOpen(false) }}
        />
      )}

      {showImport && !tableOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={step === 'select' && !loading ? resetAndClose : undefined}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ position: 'fixed', left: '50%', top: '50%', translateX: '-50%', translateY: '-50%', zIndex: 50 }}
            className="w-[min(520px,95vw)] bg-[#111113] border border-[#2a2a35] rounded-2xl shadow-modal flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="h-14 border-b border-[#27272a] flex items-center gap-3 px-5 shrink-0">
              <div className="w-8 h-8 bg-[#1e1b4b] rounded-lg flex items-center justify-center">
                <Upload size={15} className="text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-text-primary">导入笔记</div>
                <div className="text-[11px] text-text-dim">
                  {step === 'select' ? 'Step 1 · 选择文件' : step === 'review' ? 'Step 2 · 预览审核' : 'Step 3 · 完成'}
                </div>
              </div>
              <StepDots step={step} />
              <button
                onClick={resetAndClose}
                className="ml-2 w-7 h-7 bg-[#27272a] rounded-sm flex items-center justify-center text-text-muted hover:bg-[#3f3f46] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <AnimatePresence mode="wait">
              {step === 'select' && (
                <motion.div
                  key="select"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 flex flex-col gap-4"
                >
                  {/* File picker */}
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-text-dim">选择 Markdown 文件</span>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".md"
                      className="hidden"
                      onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                    />
                    <div
                      onClick={() => fileRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      className={`relative flex flex-col items-center justify-center gap-2.5 h-28 border-2 border-dashed rounded-xl cursor-pointer transition-all select-none ${
                        isDragging
                          ? 'border-primary bg-primary/5'
                          : file
                          ? 'border-primary/50 bg-[#1e1b4b]/30'
                          : 'border-[#3a3a46] hover:border-[#52525b] bg-[#18181b]'
                      }`}
                    >
                      {file ? (
                        <>
                          <FileText size={22} className="text-primary" />
                          <div className="text-center">
                            <div className="text-sm font-medium text-text-primary leading-tight">{file.name}</div>
                            <div className="text-xs text-text-dim mt-0.5">{(file.size / 1024).toFixed(1)} KB</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <Upload size={22} className="text-text-dim" />
                          <div className="text-center">
                            <div className="text-sm text-text-muted">拖拽文件或点击选择</div>
                            <div className="text-xs text-text-subtle mt-0.5">仅支持 .md 文件，最大 5 MB</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Model selector */}
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-text-dim">AI 解析模型（可选）</span>
                    <div className="relative">
                      <button
                        onClick={() => setModelDropdownOpen((v) => !v)}
                        className="w-full h-9 flex items-center gap-2 px-3 bg-[#18181b] border border-[#27272a] rounded-lg text-sm text-text-muted hover:border-[#3f3f46] transition-colors"
                      >
                        <Sparkles size={13} className="text-primary shrink-0" />
                        <span className="flex-1 text-left truncate">{selectedModelLabel}</span>
                        <ChevronDown size={13} className={`transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {modelDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="absolute top-full left-0 right-0 mt-1 bg-[#1c1c20] border border-[#2a2a35] rounded-lg shadow-modal z-20 overflow-hidden"
                          >
                            <div className="max-h-44 overflow-y-auto py-1">
                              <button
                                onClick={() => { setSelectedModel(''); setModelDropdownOpen(false) }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#27272a] transition-colors text-left ${!selectedModel ? 'text-primary' : 'text-text-muted'}`}
                              >
                                <Sparkles size={12} className="text-primary shrink-0" />
                                使用默认模型
                              </button>
                              {allModels.map((m) => (
                                <button
                                  key={`${m.providerId}-${m.modelId}`}
                                  onClick={() => { setSelectedModel(m.modelId); setModelDropdownOpen(false) }}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#27272a] transition-colors text-left ${selectedModel === m.modelId ? 'text-primary' : 'text-text-muted'}`}
                                >
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ background: m.color }}
                                  />
                                  <span className="font-mono text-xs truncate flex-1">{m.modelId}</span>
                                  <span className="text-[10px] text-text-subtle shrink-0">{m.providerName}</span>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* AI notice */}
                  <div className="flex items-start gap-2.5 bg-[#141428] border border-[#3a3a5a] rounded-lg px-3.5 py-3">
                    <Sparkles size={13} className="text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-text-muted leading-relaxed">
                      AI 将自动识别并补全词条释义，支持乱序、混合格式的笔记文件，并对异常条目进行质量审核。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForceAiFill((v) => !v)}
                    className={`h-8 w-full rounded-md border text-xs transition-colors ${
                      forceAiFill
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-[#2f2f36] bg-[#16161a] text-text-dim hover:bg-[#1b1b20]'
                    }`}
                  >
                    {forceAiFill ? '已开启：强制 AI 补全释义' : '开启强制 AI 补全释义'}
                  </button>

                  {/* Error */}
                  {error && (
                    <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#2e0f0f] border border-[#fb7185]/30 rounded-lg text-xs text-[#fb7185]">
                      <AlertTriangle size={13} className="shrink-0" />
                      {error}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-end gap-2.5 pt-1">
                    <button
                      onClick={resetAndClose}
                      className="h-9 px-5 border border-[#27272a] rounded-md text-[13px] text-text-dim hover:bg-[#27272a] transition-colors"
                    >
                      取消
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { void handlePreview() }}
                      disabled={!file || loading}
                      className="h-9 px-5 rounded-md text-[13px] font-medium bg-primary-btn hover:bg-[#4338ca] text-white disabled:opacity-40 transition-all flex items-center gap-2"
                    >
                      {loading ? <><Spinner />AI 解析中…</> : '开始解析'}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {step === 'review' && preview && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col"
                >
                  {/* Stats bar */}
                  <div className="px-5 pt-5 pb-4 flex flex-col gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-text-primary">{preview.stats.total}</span>
                      <span className="text-sm text-text-dim">条笔记已解析</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <StatChip label="规则解析" value={preview.stats.rulesParsed} color="#34d399" />
                      <StatChip label="AI 补全" value={preview.stats.aiAssisted} color="#818cf8" />
                      <StatChip label="待审核" value={preview.stats.flaggedCount} color="#fbbf24" />
                    </div>
                  </div>

                  {/* Flagged items */}
                  {activeFlags.length > 0 && (
                    <div className="px-5 pb-3 flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#fbbf24]">
                        <AlertTriangle size={12} />
                        {activeFlags.length} 条需要审核
                      </div>
                      <div className="flex flex-col gap-2">
                        {activeFlags.map((flag) => (
                          <div
                            key={flag.noteIndex}
                            className="bg-[#18140a] border border-[#fbbf24]/20 rounded-lg px-3.5 py-3 flex flex-col gap-2"
                          >
                            <div className="flex items-start gap-2">
                              <AlertTriangle size={12} className="text-[#fbbf24] mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-text-primary truncate">
                                  #{flag.noteIndex + 1} · {notes[flag.noteIndex]?.content}
                                </div>
                                <div className="text-[11px] text-[#fbbf24]/80 mt-0.5 leading-relaxed">{flag.issue}</div>
                              </div>
                            </div>
                            {Object.keys(flag.suggestion).length > 0 && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-text-subtle">建议修正：</span>
                                {Object.entries(flag.suggestion).map(([k, v]) => (
                                  <span key={k} className="text-[10px] font-mono text-text-muted bg-[#27272a] px-1.5 py-0.5 rounded">
                                    {k}: {String(v)}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => acceptSuggestion(flag)}
                                className="h-7 px-3 rounded-md bg-[#1e1b4b] border border-primary/30 text-xs text-primary hover:bg-primary/20 transition-colors"
                              >
                                接受建议
                              </button>
                              <button
                                onClick={() => dismissFlag(flag.noteIndex)}
                                className="h-7 px-3 rounded-md text-xs text-text-dim hover:text-text-muted hover:bg-[#27272a] transition-colors"
                              >
                                忽略
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes list preview */}
                  <div className="px-5 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-text-dim">预览（前 10 条）</div>
                      <button
                        onClick={() => setTableOpen(true)}
                        className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs text-primary border border-primary/30 hover:bg-primary/10 transition-colors"
                      >
                        <TableProperties size={11} />
                        查看全部并编辑
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                      {notes.slice(0, 10).map((n, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2.5 px-3 py-2.5 bg-[#18181b] border border-[#27272a] rounded-lg"
                        >
                          <span className="text-[10px] text-text-subtle mt-0.5 w-5 shrink-0 text-right">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-text-primary font-medium truncate">{n.content}</div>
                            <div className="text-xs text-text-dim mt-0.5 truncate">{n.translation}</div>
                          </div>
                          <span className="text-[10px] text-text-subtle shrink-0 mt-0.5">{n.category}</span>
                        </div>
                      ))}
                      {notes.length > 10 && (
                        <button
                          onClick={() => setTableOpen(true)}
                          className="text-xs text-primary/70 hover:text-primary text-center py-2 w-full transition-colors"
                        >
                          还有 {notes.length - 10} 条，点击查看全部 →
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="mx-5 mb-3 flex items-center gap-2 px-3.5 py-2.5 bg-[#2e0f0f] border border-[#fb7185]/30 rounded-lg text-xs text-[#fb7185]">
                      <AlertTriangle size={13} className="shrink-0" />
                      {error}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="border-t border-[#27272a] px-5 py-4 flex items-center justify-between">
                    <button
                      onClick={goBackToSelect}
                      disabled={loading}
                      className="flex items-center gap-1.5 h-9 px-4 border border-[#27272a] rounded-md text-[13px] text-text-dim hover:bg-[#27272a] transition-colors disabled:opacity-40"
                    >
                      <RotateCcw size={13} />
                      重新选择
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { void handleSave() }}
                      disabled={loading || notes.length === 0}
                      className="h-9 px-5 rounded-md text-[13px] font-medium bg-primary-btn hover:bg-[#4338ca] text-white disabled:opacity-40 transition-all flex items-center gap-2"
                    >
                      {loading ? <><Spinner />保存中…</> : `确认导入 ${notes.length} 条`}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {step === 'done' && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="p-8 flex flex-col items-center gap-5"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -15 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.05 }}
                    className="w-16 h-16 bg-[#0d2b1f] border border-[#34d399]/40 rounded-2xl flex items-center justify-center"
                  >
                    <CheckCircle2 size={30} className="text-[#34d399]" />
                  </motion.div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-text-primary">导入成功！</div>
                    <div className="text-sm text-text-dim mt-1.5">
                      已成功创建 <span className="text-[#34d399] font-semibold">{doneCount}</span> 条笔记
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={resetAndClose}
                    className="h-9 px-8 rounded-md text-[13px] font-medium bg-[#064e3b] border border-[#34d399]/30 text-[#34d399] hover:bg-[#065f46] transition-colors"
                  >
                    关闭
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs"
      style={{ background: color + '15', borderColor: color + '40', color }}
    >
      <span className="font-semibold">{value}</span>
      <span className="opacity-80">{label}</span>
    </div>
  )
}

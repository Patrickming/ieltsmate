import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Volume2, Sparkles, Plus, ChevronLeft, ChevronRight, Trash2, Pencil } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { useAppStore } from '../store/useAppStore'

export default function KnowledgeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { notes } = useAppStore()
  const [newNote, setNewNote] = useState('')
  const [userNotes, setUserNotes] = useState<string[]>([])
  const [addingNote, setAddingNote] = useState(false)
  const [pageLoading] = useState(false)

  const noteIdx = notes.findIndex((n) => n.id === id)
  const note = notes[noteIdx]
  const prevNote = noteIdx > 0 ? notes[noteIdx - 1] : null
  const nextNote = noteIdx < notes.length - 1 ? notes[noteIdx + 1] : null

  if (pageLoading) {
    return (
      <Layout title="笔记详情">
        <LoadingState />
      </Layout>
    )
  }

  if (!note) {
    return (
      <Layout title="笔记详情">
        <div className="p-8">
          <EmptyState
            title="笔记未找到"
            description="该内容可能已被删除，或链接无效。"
            action={
              <Button type="button" variant="primary" size="md" onClick={() => navigate('/kb')}>
                返回知识库
              </Button>
            }
          />
        </div>
      </Layout>
    )
  }

  const accuracy = note.reviewCount
    ? Math.round(((note.correctCount ?? 0) / note.reviewCount) * 100)
    : 0

  const allNotes = [...(note.userNotes ?? []), ...userNotes]

  const handleSaveNote = () => {
    if (!newNote.trim()) return
    setUserNotes((prev) => [...prev, newNote.trim()])
    setNewNote('')
    setAddingNote(false)
  }

  return (
    <Layout title="笔记详情">
      <div className="p-8 flex flex-col gap-5">
        {/* Back */}
        <Button
          type="button"
          variant="ghost"
          size="md"
          icon={<ArrowLeft size={14} />}
          className="h-auto min-h-0 w-fit px-0 py-1 text-sm text-text-dim hover:text-text-muted justify-start"
          onClick={() => navigate('/kb')}
        >
          返回知识库
        </Button>

        {/* Main knowledge card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-card border border-border rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <Badge category={note.category} size="md" />
            <span className="text-xs text-text-subtle">创建于 {note.createdAt}</span>
          </div>
          <h1 className="text-[36px] font-bold text-text-primary leading-tight mb-2">{note.content}</h1>
          <p className="text-lg text-text-muted">{note.translation}</p>
        </motion.div>

        {/* Two column layout */}
        <div className="flex gap-5 items-start">
          {/* Left column — AI extensions + 我的备注 */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">

            {/* AI Extensions card */}
            <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                <span className="text-sm font-semibold text-text-secondary">AI 延伸内容</span>
                <div className="flex items-center gap-1.5 text-primary">
                  <Sparkles size={12} />
                  <span className="text-[11px] font-medium">AI 生成</span>
                </div>
              </div>

              <div className="p-5 flex flex-col gap-5">
                {/* Synonyms — read-only, already stored */}
                {note.synonyms && note.synonyms.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-text-muted mb-2.5">🔄 同义短语</div>
                    <div className="flex flex-wrap gap-2">
                      {note.synonyms.map((syn) => (
                        <div
                          key={syn}
                          className="flex items-center gap-2 px-3 py-2 rounded-md border"
                          style={{ background: '#1a1a28', borderColor: '#27272a' }}
                        >
                          <span className="text-[15px] text-text-primary">{syn}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Antonyms — read-only, already stored */}
                {note.antonyms && note.antonyms.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-text-muted mb-2.5">🔀 反义短语</div>
                    <div className="flex flex-wrap gap-2">
                      {note.antonyms.map((ant) => (
                        <div
                          key={ant}
                          className="flex items-center gap-2 px-3 py-2 rounded-md border"
                          style={{ background: '#1a1a28', borderColor: '#27272a' }}
                        >
                          <span className="text-[15px] text-text-primary">{ant}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Phonetic */}
                {note.phonetic && (
                  <div>
                    <div className="text-sm font-semibold text-text-muted mb-2.5">🔊 音标</div>
                    <div className="flex items-center gap-2.5 bg-[#141420] border border-[#27272a] rounded-md px-3.5 py-3 w-fit">
                      <Volume2 size={16} className="text-primary" />
                      <span className="text-[15px] text-[#a5b4fc]">{note.phonetic}</span>
                    </div>
                  </div>
                )}

                {/* Example */}
                {note.example && (
                  <div>
                    <div className="text-sm font-semibold text-text-muted mb-2.5">💬 例句</div>
                    <div className="bg-[#141420] border border-[#27272a] rounded-md px-4 py-3.5">
                      <p className="text-[15px] text-text-secondary italic">"{note.example}"</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 我的备注 — below AI extensions */}
            <div className="bg-surface-card border border-border rounded-xl p-4">
              <div className="text-sm font-semibold text-text-secondary mb-3">我的备注</div>
              {allNotes.map((n, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 mb-2 pl-3 border-l-2 border-primary/40"
                >
                  <p className="text-[13px] text-text-muted flex-1 leading-relaxed">{n}</p>
                </div>
              ))}
              <AnimatePresence>
                {addingNote && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <textarea
                      autoFocus
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="添加备注..."
                      rows={2}
                      className="w-full bg-[#141420] border border-[#3a3a4a] rounded-md px-3 py-2 text-sm text-text-primary placeholder-text-subtle outline-none resize-none mb-2 mt-2"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveNote() }
                        if (e.key === 'Escape') setAddingNote(false)
                      }}
                    />
                    <div className="flex gap-2">
                      <Button type="button" variant="primary" size="sm" onClick={handleSaveNote}>
                        保存
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setAddingNote(false)}>
                        取消
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {!addingNote && (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  icon={<Plus size={11} />}
                  className="mt-2 w-full border-primary/40 text-primary hover:bg-[#1e1b4b] rounded-sm justify-center"
                  onClick={() => setAddingNote(true)}
                >
                  添加备注
                </Button>
              )}
            </div>
          </div>

          {/* Right column — review stats + actions only */}
          <div className="w-72 flex flex-col gap-4 shrink-0">
            {/* Review stats */}
            <div className="bg-surface-card border border-border rounded-xl p-4">
              <div className="text-sm font-semibold text-text-secondary mb-3">复习统计</div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="flex flex-col items-center gap-1 bg-[#1e1e28] rounded-md py-2.5">
                  <span className="text-xl font-bold text-primary">{note.reviewCount ?? 0}</span>
                  <span className="text-[11px] text-text-dim">复习次数</span>
                </div>
                <div className="flex flex-col items-center gap-1 bg-[#1e2e1e] rounded-md py-2.5">
                  <span className="text-xl font-bold text-cat-phrase">{note.correctCount ?? 0}</span>
                  <span className="text-[11px] text-text-dim">正确 {accuracy}%</span>
                </div>
                <div className="flex flex-col items-center gap-1 bg-[#2e1e1e] rounded-md py-2.5">
                  <span className="text-xl font-bold text-cat-sentence">{note.wrongCount ?? 0}</span>
                  <span className="text-[11px] text-text-dim">错误 {100 - accuracy}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-[#27272a] rounded-full overflow-hidden mb-2">
                <motion.div
                  className="h-full rounded-full bg-cat-phrase"
                  initial={{ width: 0 }}
                  animate={{ width: `${accuracy}%` }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                />
              </div>
              {note.lastReview && (
                <p className="text-xs text-text-subtle">上次复习: {note.lastReview}</p>
              )}
            </div>

            {/* Actions */}
            <div className="bg-surface-card border border-border rounded-xl p-4">
              <div className="text-sm font-semibold text-text-secondary mb-3">操作</div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  icon={<Pencil size={13} />}
                  className="flex-1 h-9 min-h-9 rounded-sm text-text-muted hover:text-text-secondary"
                >
                  编辑
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  icon={<Trash2 size={13} />}
                  className="flex-1 h-9 min-h-9 rounded-sm"
                >
                  删除
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Prev / Next */}
        {(prevNote || nextNote) && (
          <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
            {prevNote ? (
              <button
                type="button"
                onClick={() => navigate(`/kb/${prevNote.id}`)}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-border-strong hover:bg-[#27272a]/40"
              >
                <ChevronLeft size={14} className="shrink-0 text-text-dim" />
                <span className="text-text-dim">上一个</span>
                <span className="max-w-[180px] truncate text-text-muted">{prevNote.content}</span>
                <Badge category={prevNote.category} />
              </button>
            ) : <span />}
            {nextNote ? (
              <button
                type="button"
                onClick={() => navigate(`/kb/${nextNote.id}`)}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-border-strong hover:bg-[#27272a]/40"
              >
                <span className="text-text-dim">下一个</span>
                <span className="max-w-[180px] truncate text-text-muted">{nextNote.content}</span>
                <Badge category={nextNote.category} />
                <ChevronRight size={14} className="shrink-0 text-text-dim" />
              </button>
            ) : <span />}
          </div>
        )}
      </div>
    </Layout>
  )
}

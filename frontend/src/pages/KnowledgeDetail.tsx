import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Volume2, Sparkles, Plus, ChevronLeft, ChevronRight, Trash2, Pencil, Check, X } from 'lucide-react'
import { FavoriteButton } from '../components/ui/FavoriteButton'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { useAppStore } from '../store/useAppStore'
import { apiUrl } from '../lib/apiBase'
import { CATEGORIES, type Category } from '../data/mockData'
import type { Pos4 } from '../types/wordFamily'

interface UserNote {
  id: string
  content: string
}

export default function KnowledgeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { notes, deleteNote, updateNote } = useAppStore()
  const [newNote, setNewNote] = useState('')
  const [userNotes, setUserNotes] = useState<UserNote[]>([])
  const [addingNote, setAddingNote] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [pageLoading] = useState(false)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [editTranslation, setEditTranslation] = useState('')
  const [editCategory, setEditCategory] = useState<Category>('短语')
  const [saving, setSaving] = useState(false)

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Extension editing state
  const [editingExt, setEditingExt] = useState(false)
  const [extSaving, setExtSaving] = useState(false)
  const [editSyns, setEditSyns] = useState<string[]>([])
  const [editAnts, setEditAnts] = useState<string[]>([])
  const [newSyn, setNewSyn] = useState('')
  const [newAnt, setNewAnt] = useState('')
  const [editingSynIdx, setEditingSynIdx] = useState<number | null>(null)
  const [editingSynVal, setEditingSynVal] = useState('')
  const [editingAntIdx, setEditingAntIdx] = useState<number | null>(null)
  const [editingAntVal, setEditingAntVal] = useState('')

  const noteIdx = notes.findIndex((n) => n.id === id)
  const note = notes[noteIdx]
  const prevNote = noteIdx > 0 ? notes[noteIdx - 1] : null
  const nextNote = noteIdx < notes.length - 1 ? notes[noteIdx + 1] : null

  // Load user notes from backend when note id changes
  useEffect(() => {
    if (!id) return
    fetch(apiUrl(`/notes/${id}/user-notes`))
      .then((r) => r.ok ? r.json() : null)
      .then((json: { data?: { items?: UserNote[] } } | null) => {
        if (json?.data?.items) setUserNotes(json.data.items)
      })
      .catch(() => { /* 静默失败 */ })
  }, [id])

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
              <Button type="button" variant="primary" size="md" onClick={() => navigate(-1)}>
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
  const posLabel: Record<Pos4, string> = {
    noun: '名词',
    verb: '动词',
    adjective: '形容词',
    adverb: '副词',
  }

  const handleSaveNote = async () => {
    if (!newNote.trim() || !id || savingNote) return
    setSavingNote(true)
    try {
      const res = await fetch(apiUrl(`/notes/${id}/user-notes`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote.trim() }),
      })
      if (res.ok) {
        const json = (await res.json()) as { data?: UserNote }
        if (json.data?.id) {
          setUserNotes((prev) => [...prev, json.data!])
        }
        setNewNote('')
        setAddingNote(false)
      }
    } catch { /* 静默失败 */ }
    setSavingNote(false)
  }

  const handleDeleteUserNote = async (userNoteId: string) => {
    if (!id) return
    setUserNotes((prev) => prev.filter((n) => n.id !== userNoteId))
    try {
      await fetch(apiUrl(`/notes/${id}/user-notes/${userNoteId}`), { method: 'DELETE' })
    } catch { /* 静默失败 */ }
  }

  const handleStartEdit = () => {
    if (!note) return
    setEditContent(note.content)
    setEditTranslation(note.translation)
    setEditCategory(note.category)
    setEditing(true)
  }

  const handleCancelEdit = () => {
    setEditing(false)
  }

  const handleSaveEdit = async () => {
    if (!note || saving) return
    setSaving(true)
    const ok = await updateNote(note.id, {
      content: editContent.trim(),
      translation: editTranslation.trim(),
      category: editCategory,
    })
    setSaving(false)
    if (ok) setEditing(false)
  }

  // Extension (synonyms/antonyms) editing
  const handleStartEditExt = () => {
    if (!note) return
    setEditSyns([...(note.synonyms ?? [])])
    setEditAnts([...(note.antonyms ?? [])])
    setNewSyn('')
    setNewAnt('')
    setEditingSynIdx(null)
    setEditingSynVal('')
    setEditingAntIdx(null)
    setEditingAntVal('')
    setEditingExt(true)
  }

  const handleCancelEditExt = () => {
    setEditingExt(false)
    setNewSyn('')
    setNewAnt('')
    setEditingSynIdx(null)
    setEditingSynVal('')
    setEditingAntIdx(null)
    setEditingAntVal('')
  }

  const handleSaveEditExt = async () => {
    if (!note || extSaving) return
    setExtSaving(true)
    const ok = await updateNote(note.id, { synonyms: editSyns, antonyms: editAnts })
    setExtSaving(false)
    if (ok) setEditingExt(false)
  }

  const handleAddSyn = () => {
    const v = newSyn.trim()
    if (!v || editSyns.includes(v)) { setNewSyn(''); return }
    setEditSyns(p => [...p, v])
    setNewSyn('')
  }

  const handleAddAnt = () => {
    const v = newAnt.trim()
    if (!v || editAnts.includes(v)) { setNewAnt(''); return }
    setEditAnts(p => [...p, v])
    setNewAnt('')
  }

  const startEditSynItem = (idx: number) => {
    setEditingSynIdx(idx)
    setEditingSynVal(editSyns[idx] ?? '')
  }

  const commitEditSynItem = () => {
    if (editingSynIdx === null) return
    const val = editingSynVal.trim()
    setEditSyns((prev) => prev.map((item, idx) => (idx === editingSynIdx ? val || item : item)))
    setEditingSynIdx(null)
    setEditingSynVal('')
  }

  const startEditAntItem = (idx: number) => {
    setEditingAntIdx(idx)
    setEditingAntVal(editAnts[idx] ?? '')
  }

  const commitEditAntItem = () => {
    if (editingAntIdx === null) return
    const val = editingAntVal.trim()
    setEditAnts((prev) => prev.map((item, idx) => (idx === editingAntIdx ? val || item : item)))
    setEditingAntIdx(null)
    setEditingAntVal('')
  }

  const handleDelete = async () => {
    if (!note || deleting) return
    setDeleting(true)
    const ok = await deleteNote(note.id)
    setDeleting(false)
    if (ok) navigate('/kb')
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
          onClick={() => navigate(-1)}
        >
          返回知识库
        </Button>

        {/* Main knowledge card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-card border border-border rounded-xl p-6"
        >
          {editing ? (
            <div className="flex flex-col gap-3">
              {/* Category selector */}
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.filter((c) => c.name !== '写作').map(({ name }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setEditCategory(name)}
                    className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                      editCategory === name
                        ? 'bg-primary-btn text-white'
                        : 'border border-border text-text-dim hover:text-text-muted'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <input
                autoFocus
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="英文内容"
                className="w-full bg-[#141420] border border-[#3a3a4a] rounded-md px-3.5 py-2.5 text-2xl font-bold text-text-primary outline-none focus:border-primary/60 transition-colors"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit() }}
              />
              <input
                value={editTranslation}
                onChange={(e) => setEditTranslation(e.target.value)}
                placeholder="中文释义"
                className="w-full bg-[#141420] border border-[#3a3a4a] rounded-md px-3.5 py-2.5 text-lg text-text-muted outline-none focus:border-primary/60 transition-colors"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit() }}
              />
              <div className="flex gap-2 mt-1">
                <Button type="button" variant="primary" size="sm" icon={<Check size={13} />} onClick={handleSaveEdit} disabled={saving || !editContent.trim()}>
                  {saving ? '保存中...' : '保存'}
                </Button>
                <Button type="button" variant="outline" size="sm" icon={<X size={13} />} onClick={handleCancelEdit}>
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <Badge category={note.category} size="md" showEmoji />
                <span className="text-xs text-text-subtle">创建于 {note.createdAt}</span>
              </div>
              <h1 className="text-[36px] font-bold text-text-primary leading-tight mb-2">{note.content}</h1>
              <p className="text-lg text-text-muted">{note.translation}</p>
            </>
          )}
        </motion.div>

        {/* Two column layout */}
        <div className="flex gap-5 items-start">
          {/* Left column — AI extensions + 我的备注 */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">

            {/* AI Extensions card */}
            <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                <span className="text-sm font-semibold text-text-secondary">AI 延伸内容</span>
                <div className="flex items-center gap-2">
                  {!editingExt ? (
                    <button
                      onClick={handleStartEditExt}
                      className="flex items-center gap-1 text-[11px] text-text-subtle hover:text-text-muted transition-colors px-2 py-1 rounded-md hover:bg-[#27272a]"
                    >
                      <Pencil size={11} />
                      <span>编辑</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleSaveEditExt}
                        disabled={extSaving}
                        className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1 rounded-md hover:bg-emerald-950/30 disabled:opacity-50"
                      >
                        <Check size={11} />
                        <span>{extSaving ? '保存中...' : '保存'}</span>
                      </button>
                      <button
                        onClick={handleCancelEditExt}
                        className="flex items-center gap-1 text-[11px] text-text-subtle hover:text-text-muted transition-colors px-2 py-1 rounded-md hover:bg-[#27272a]"
                      >
                        <X size={11} />
                        <span>取消</span>
                      </button>
                    </div>
                  )}
                  {!editingExt && (
                    <div className="flex items-center gap-1.5 text-primary">
                      <Sparkles size={12} />
                      <span className="text-[11px] font-medium">AI 生成</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 flex flex-col gap-5">
                {/* Synonyms */}
                {!editingExt ? (
                  note.synonyms && note.synonyms.length > 0 && (
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
                  )
                ) : (
                  <div>
                    <div className="text-sm font-semibold text-text-muted mb-2.5">🔄 同义短语</div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {editSyns.map((syn, idx) => (
                        <div
                          key={`${syn}-${idx}`}
                          className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-md border"
                          style={{ background: '#1a1a28', borderColor: '#3f3f46' }}
                        >
                          {editingSynIdx === idx ? (
                            <input
                              autoFocus
                              value={editingSynVal}
                              onChange={(e) => setEditingSynVal(e.target.value)}
                              onBlur={commitEditSynItem}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEditSynItem()
                                if (e.key === 'Escape') { setEditingSynIdx(null); setEditingSynVal('') }
                              }}
                              className="min-w-[140px] bg-[#141420] border border-[#4b5563] rounded px-2 py-0.5 text-[13px] text-text-primary outline-none"
                            />
                          ) : (
                            <span
                              onDoubleClick={() => startEditSynItem(idx)}
                              className="text-[14px] text-text-primary cursor-text"
                              title="双击编辑"
                            >
                              {syn}
                            </span>
                          )}
                          <button
                            onClick={() => startEditSynItem(idx)}
                            className="text-text-subtle hover:text-primary transition-colors ml-0.5"
                            title="编辑"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => setEditSyns(p => p.filter((_, i) => i !== idx))}
                            className="text-text-subtle hover:text-red-400 transition-colors ml-0.5"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-1">
                      <input
                        value={newSyn}
                        onChange={e => setNewSyn(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddSyn() }}
                        placeholder="添加同义词..."
                        className="flex-1 bg-[#141420] border border-[#3a3a4a] rounded-md px-3 py-1.5 text-[13px] text-text-primary outline-none focus:border-primary/60 transition-colors"
                      />
                      <button
                        onClick={handleAddSyn}
                        className="px-3 py-1.5 rounded-md text-[12px] font-medium text-primary border border-primary/30 hover:bg-primary/10 transition-colors"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Antonyms */}
                {!editingExt ? (
                  note.antonyms && note.antonyms.length > 0 && (
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
                  )
                ) : (
                  <div>
                    <div className="text-sm font-semibold text-text-muted mb-2.5">🔀 反义短语</div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {editAnts.map((ant, idx) => (
                        <div
                          key={`${ant}-${idx}`}
                          className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-md border"
                          style={{ background: '#1a1a28', borderColor: '#3f3f46' }}
                        >
                          {editingAntIdx === idx ? (
                            <input
                              autoFocus
                              value={editingAntVal}
                              onChange={(e) => setEditingAntVal(e.target.value)}
                              onBlur={commitEditAntItem}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEditAntItem()
                                if (e.key === 'Escape') { setEditingAntIdx(null); setEditingAntVal('') }
                              }}
                              className="min-w-[140px] bg-[#141420] border border-[#4b5563] rounded px-2 py-0.5 text-[13px] text-text-primary outline-none"
                            />
                          ) : (
                            <span
                              onDoubleClick={() => startEditAntItem(idx)}
                              className="text-[14px] text-text-primary cursor-text"
                              title="双击编辑"
                            >
                              {ant}
                            </span>
                          )}
                          <button
                            onClick={() => startEditAntItem(idx)}
                            className="text-text-subtle hover:text-primary transition-colors ml-0.5"
                            title="编辑"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => setEditAnts(p => p.filter((_, i) => i !== idx))}
                            className="text-text-subtle hover:text-red-400 transition-colors ml-0.5"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-1">
                      <input
                        value={newAnt}
                        onChange={e => setNewAnt(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddAnt() }}
                        placeholder="添加反义词..."
                        className="flex-1 bg-[#141420] border border-[#3a3a4a] rounded-md px-3 py-1.5 text-[13px] text-text-primary outline-none focus:border-primary/60 transition-colors"
                      />
                      <button
                        onClick={handleAddAnt}
                        className="px-3 py-1.5 rounded-md text-[12px] font-medium text-primary border border-primary/30 hover:bg-primary/10 transition-colors"
                      >
                        <Plus size={13} />
                      </button>
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

                {/* Word family */}
                {note.wordFamily && (
                  <div>
                    <div className="text-sm font-semibold text-text-muted mb-2.5">🧩 词性&词根派生</div>
                    <div className="bg-[#141420] border border-[#27272a] rounded-xl px-4 py-3.5 flex flex-col gap-3">
                      <div>
                        <div className="text-[11px] font-bold text-text-subtle mb-1">原始词</div>
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-[16px] font-semibold text-text-primary">{note.wordFamily.base.word}</span>
                          <span className="text-[11px] text-primary">原始词</span>
                          <span className="text-[11px] text-text-subtle">{posLabel[note.wordFamily.base.pos as Pos4] ?? note.wordFamily.base.pos}</span>
                          {note.wordFamily.base.phonetic && (
                            <span className="text-[12px] text-[#a5b4fc] font-mono">{note.wordFamily.base.phonetic}</span>
                          )}
                        </div>
                        <p className="text-[13px] text-text-secondary mt-1">{note.wordFamily.base.meaning}</p>
                      </div>
                      {(['noun', 'verb', 'adjective', 'adverb'] as Pos4[]).map((pk) => (
                        <div key={pk}>
                          <div className="text-[11px] font-bold text-text-subtle mb-1">{posLabel[pk]}</div>
                          {(note.wordFamily?.derivedByPos?.[pk]?.length ?? 0) === 0 ? (
                            <p className="text-[13px] text-text-dim">无</p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {note.wordFamily!.derivedByPos[pk].map((item, idx) => (
                                <div key={`${pk}-${item.word}-${idx}`} className="pl-3 border-l-2 border-primary/35">
                                  <div className="flex flex-wrap items-baseline gap-2">
                                    <span className="text-[14px] font-semibold text-text-primary">{item.word}</span>
                                    {item.phonetic && <span className="text-[12px] text-[#a5b4fc] font-mono">{item.phonetic}</span>}
                                  </div>
                                  <p className="text-[13px] text-text-secondary mt-0.5">{item.meaning}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {(note.wordFamily?.rootDerived?.length ?? 0) > 0 && (
                        <div>
                          <div className="text-[11px] font-bold text-text-subtle mb-1">词根派生</div>
                          <div className="flex flex-col gap-2">
                            {note.wordFamily!.rootDerived.map((item, idx) => (
                              <div key={`root-${item.word}-${idx}`} className="pl-3 border-l-2 border-primary/35">
                                <div className="flex flex-wrap items-baseline gap-2">
                                  <span className="text-[14px] font-semibold text-text-primary">{item.word}</span>
                                  <span className="text-[11px] text-text-subtle font-mono">{item.pos}</span>
                                  {item.phonetic && <span className="text-[12px] text-[#a5b4fc] font-mono">{item.phonetic}</span>}
                                </div>
                                <p className="text-[13px] text-text-secondary mt-0.5">{item.meaning}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Parts of speech */}
                {note.partsOfSpeech && note.partsOfSpeech.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-text-muted mb-2.5">🧠 词性</div>
                    <div className="flex flex-col gap-2">
                      {note.partsOfSpeech.map((item, idx) => (
                        <div key={`${item.pos}-${item.meaning}-${idx}`} className="bg-[#141420] border border-[#27272a] rounded-lg px-3.5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-primary">{item.label}</span>
                            <span className="text-[11px] text-text-subtle">{item.pos}</span>
                            {item.phonetic && <span className="text-[12px] text-[#a5b4fc] font-mono">{item.phonetic}</span>}
                          </div>
                          <p className="text-[13px] text-text-secondary mt-1">{item.meaning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confusables */}
                {note.confusables && note.confusables.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-text-muted mb-2.5">🔀 易混淆</div>
                    <div className="flex flex-col gap-2">
                      {note.confusables.map((group, gi) => (
                        <div key={`conf-${gi}`} className="bg-[#141420] border border-[#27272a] rounded-lg px-3.5 py-3">
                          <div className="text-[11px] text-text-subtle mb-1.5">
                            {group.kind === 'meaning' ? '义近易混' : '形近 / 拼写易混'}
                          </div>
                          {group.kind === 'meaning' && (
                            <p className="text-[12px] text-text-dim mb-2">区别：{group.difference}</p>
                          )}
                          <div className="flex flex-col gap-1.5">
                            {group.words.map((w, wi) => (
                              <div key={`${w.word}-${wi}`} className="pl-3 border-l-2 border-primary/35">
                                <div className="flex flex-wrap items-baseline gap-2">
                                  <span className="text-[14px] font-semibold text-text-primary">{w.word}</span>
                                  {w.phonetic && <span className="text-[12px] text-[#a5b4fc] font-mono">{w.phonetic}</span>}
                                </div>
                                <p className="text-[13px] text-text-secondary mt-0.5">{w.meaning}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
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
              {userNotes.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-2 mb-2 pl-3 border-l-2 border-primary/40 group"
                >
                  <p className="text-[13px] text-text-muted flex-1 leading-relaxed">{n.content}</p>
                  <button
                    type="button"
                    onClick={() => void handleDeleteUserNote(n.id)}
                    className="opacity-0 group-hover:opacity-100 shrink-0 text-text-subtle hover:text-[#fb7185] transition-all"
                    title="删除备注"
                  >
                    <X size={13} />
                  </button>
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
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSaveNote() }
                        if (e.key === 'Escape') setAddingNote(false)
                      }}
                    />
                    <div className="flex gap-2">
                      <Button type="button" variant="primary" size="sm" onClick={() => void handleSaveNote()} disabled={savingNote}>
                        {savingNote ? '保存中...' : '保存'}
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
              {confirmDelete ? (
                <div className="mb-3">
                  <p className="text-xs text-text-muted mb-2.5">确认删除这条笔记？此操作不可恢复。</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="danger"
                      size="md"
                      className="flex-1 h-9 min-h-9 rounded-sm"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? '删除中...' : '确认删除'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      className="flex-1 h-9 min-h-9 rounded-sm"
                      onClick={() => setConfirmDelete(false)}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mb-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    icon={<Pencil size={13} />}
                    className={`flex-1 h-9 min-h-9 rounded-sm ${editing ? 'border-primary text-primary' : 'text-text-muted hover:text-text-secondary'}`}
                    onClick={editing ? handleCancelEdit : handleStartEdit}
                  >
                    {editing ? '取消编辑' : '编辑'}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="md"
                    icon={<Trash2 size={13} />}
                    className="flex-1 h-9 min-h-9 rounded-sm"
                    onClick={() => setConfirmDelete(true)}
                  >
                    删除
                  </Button>
                </div>
              )}
              <FavoriteButton noteId={note.id} variant="full" />
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
                <Badge category={prevNote.category} showEmoji />
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
                <Badge category={nextNote.category} showEmoji />
                <ChevronRight size={14} className="shrink-0 text-text-dim" />
              </button>
            ) : <span />}
          </div>
        )}
      </div>
    </Layout>
  )
}

import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Volume2, Edit2, Trash2, Plus, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Badge } from '../components/ui/Badge'
import { CATEGORY_BAR } from '../data/mockData'
import { useAppStore } from '../store/useAppStore'

export default function KnowledgeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { notes } = useAppStore()
  const [savedSynonyms, setSavedSynonyms] = useState<string[]>([])

  const note = notes.find((n) => n.id === id)
  if (!note) {
    return (
      <Layout title="笔记详情">
        <div className="p-8 text-text-dim">笔记未找到</div>
      </Layout>
    )
  }

  const barColor = CATEGORY_BAR[note.category] ?? '#71717a'

  return (
    <Layout title="笔记详情">
      <div className="p-8 max-w-3xl">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-text-dim hover:text-text-muted text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          返回
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-card border border-border rounded-xl p-6 flex flex-col gap-5"
        >
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: barColor }} />
            <div className="flex-1">
              <Badge category={note.category} size="md" />
              <h1 className="text-2xl font-bold text-text-primary mt-2">{note.content}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button className="h-8 w-8 flex items-center justify-center rounded-sm border border-border text-text-dim hover:text-text-muted hover:bg-[#27272a] transition-colors">
                <Edit2 size={14} />
              </button>
              <button className="h-8 w-8 flex items-center justify-center rounded-sm border border-[#7f1d1d] text-[#fb7185] hover:bg-[#450a0a] transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Phonetic */}
          {note.phonetic && (
            <div className="flex items-center gap-2.5 bg-[#141420] border border-[#27272a] rounded-md px-3.5 py-2.5">
              <Volume2 size={16} className="text-primary shrink-0" />
              <span className="text-sm text-[#a5b4fc]">{note.phonetic}</span>
            </div>
          )}

          {/* Meaning */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-text-dim uppercase tracking-wide">中文意思</span>
            <p className="text-base text-text-primary">{note.translation}</p>
          </div>

          {/* Example */}
          {note.example && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-text-dim uppercase tracking-wide">例句</span>
              <p className="text-sm text-text-muted italic">"{note.example}"</p>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Synonyms */}
          {note.synonyms && note.synonyms.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-text-muted">🔄 同义短语</span>
              <div className="flex flex-wrap gap-2">
                {note.synonyms.map((syn) => {
                  const saved = savedSynonyms.includes(syn)
                  return (
                    <div key={syn} className="flex flex-col gap-1.5 bg-[#1a1a28] border border-border rounded-md px-3.5 py-2.5">
                      <span className="text-sm text-text-primary">{syn}</span>
                      <button
                        onClick={() => setSavedSynonyms((prev) =>
                          saved ? prev.filter((s) => s !== syn) : [...prev, syn]
                        )}
                        className="flex items-center gap-1"
                        style={{ color: saved ? '#34d399' : '#818cf8' }}
                      >
                        {saved ? <Check size={10} /> : <Plus size={10} />}
                        <span className="text-[10px]">{saved ? '已存入' : '存入'}</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Antonyms */}
          {note.antonyms && note.antonyms.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-text-muted">🔀 反义短语</span>
              <div className="flex flex-wrap gap-2">
                {note.antonyms.map((ant) => (
                  <div key={ant} className="flex flex-col gap-1.5 bg-[#1a1a28] border border-border rounded-md px-3.5 py-2.5">
                    <span className="text-sm text-text-primary">{ant}</span>
                    <button className="flex items-center gap-1 text-primary">
                      <Plus size={10} />
                      <span className="text-[10px]">存入</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <span className="text-[11px] text-text-subtle flex-1">添加于 {note.createdAt}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${
              note.reviewStatus === 'mastered' ? 'bg-[#064e3b] text-[#34d399]' :
              note.reviewStatus === 'learning' ? 'bg-[#1e1b4b] text-primary' :
              'bg-[#27272a] text-text-dim'
            }`}>
              {note.reviewStatus === 'mastered' ? '已掌握' : note.reviewStatus === 'learning' ? '学习中' : '新词'}
            </span>
          </div>
        </motion.div>
      </div>
    </Layout>
  )
}

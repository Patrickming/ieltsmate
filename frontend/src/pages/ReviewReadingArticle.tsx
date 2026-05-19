import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Clock, FileText, Link2, Trash2 } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { useAppStore } from '../store/useAppStore'
import { findExpressionMatches } from '../utils/reviewReadingMatch'

function formatNoteUsage(note: {
  noteContent: string
  expression: string
  isVariant: boolean
}) {
  const original = note.noteContent.trim()
  const used = note.expression.trim()
  if (note.isVariant) {
    return {
      line: `原笔记：${original} · 文中使用：${used}（变体）`,
      originalLabel: `原笔记：${original}`,
      usedLabel: `文中使用：${used}（变体）`,
    }
  }
  if (original.toLowerCase() === used.toLowerCase()) {
    return {
      line: `笔记：${original}`,
      originalLabel: `笔记：${original}`,
      usedLabel: null,
    }
  }
  return {
    line: `原笔记：${original} · 文中使用：${used}`,
    originalLabel: `原笔记：${original}`,
    usedLabel: `文中使用：${used}`,
  }
}

function formatMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '未知'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} 秒`
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
}

export default function ReviewReadingArticle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    selectedReadingArticle,
    readingReviewLoading,
    loadReadingArticle,
    deleteReadingArticle,
  } = useAppStore()
  const [showTranslations, setShowTranslations] = useState(false)

  useEffect(() => {
    if (id) void loadReadingArticle(id)
  }, [id, loadReadingArticle])

  const article = selectedReadingArticle

  const renderHighlightedParagraph = (paragraph: string) => {
    if (!article) return paragraph
    const matches: Array<{ start: number; end: number; note: typeof article.notes[number] }> = []
    const occupied: Array<{ start: number; end: number }> = []
    const noteRefs = [...article.notes]
      .filter((note) => note.expression.trim().length > 0)
      .sort((a, b) => b.expression.length - a.expression.length)

    for (const note of noteRefs) {
      for (const match of findExpressionMatches(paragraph, note.expression)) {
        if (occupied.some((item) => match.start < item.end && match.end > item.start)) continue
        occupied.push({ start: match.start, end: match.end })
        matches.push({ start: match.start, end: match.end, note })
      }
    }

    if (matches.length === 0) return paragraph
    matches.sort((a, b) => a.start - b.start)

    const nodes: ReactNode[] = []
    let cursor = 0
    matches.forEach((match, index) => {
      if (match.start > cursor) {
        nodes.push(paragraph.slice(cursor, match.start))
      }
      const text = paragraph.slice(match.start, match.end)
      const usage = formatNoteUsage(match.note)
      nodes.push(
        <button
          key={`${match.note.id}-${index}`}
          type="button"
          onClick={() => match.note.noteId && navigate(`/kb/${match.note.noteId}`)}
          className="group relative inline rounded bg-amber-400/15 px-0.5 font-semibold text-amber-200 underline decoration-amber-300/70 decoration-2 underline-offset-4 transition-colors hover:bg-amber-400/25"
        >
          {text}
          <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-80 -translate-x-1/2 rounded-xl border border-border bg-[#18181b] p-3 text-left text-xs font-normal leading-relaxed text-text-secondary shadow-2xl group-hover:block">
            <span className="block font-semibold text-text-primary">{usage.line}</span>
            {match.note.noteTranslation && (
              <span className="mt-1 block text-text-dim">释义：{match.note.noteTranslation}</span>
            )}
            {match.note.explanation && <span className="mt-1 block text-text-subtle">{match.note.explanation}</span>}
          </span>
        </button>,
      )
      cursor = match.end
    })
    if (cursor < paragraph.length) {
      nodes.push(paragraph.slice(cursor))
    }
    return nodes
  }

  const handleDelete = async () => {
    if (!article) return
    if (!window.confirm('确定删除这篇 AI 阅读文章吗？')) return
    const ok = await deleteReadingArticle(article.id)
    if (ok) navigate('/review/reading')
  }

  return (
    <Layout title="AI 阅读复习">
      <div className="min-h-full bg-[#111113] px-8 py-8">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigate('/review/reading')}
              className="flex items-center gap-2 text-sm text-text-dim hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={16} />
              返回 AI 阅读
            </button>
            {article && (
              <button
                type="button"
                onClick={() => { void handleDelete() }}
                className="flex items-center gap-1.5 h-8 px-3 text-xs border border-[#f87171]/30 rounded-sm text-[#fca5a5] hover:bg-[#450a0a]/40 transition-colors"
              >
                <Trash2 size={12} />
                删除文章
              </button>
            )}
          </div>

          {readingReviewLoading && !article ? (
            <div className="rounded-2xl border border-border bg-surface-card p-8 text-text-dim">
              正在加载文章...
            </div>
          ) : !article ? (
            <div className="rounded-2xl border border-border bg-surface-card p-8 text-text-dim">
              未找到文章
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-border bg-surface-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.8px] text-primary">
                      <BookOpen size={14} />
                      IELTS Reading
                    </div>
                    <h1 className="mt-3 text-3xl font-bold text-text-primary">{article.title}</h1>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-text-dim">
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-[#18181b] px-3 py-1">
                      <FileText size={12} />
                      {article.wordCount} 词
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-[#18181b] px-3 py-1">
                      <Link2 size={12} />
                      {article.notes.length} 条笔记
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-[#18181b] px-3 py-1">
                      <Clock size={12} />
                      {formatMs(article.generationMs)}
                    </span>
                  </div>
                </div>
                {article.qualityWarnings.length > 0 && (
                  <div className="mt-4 rounded-xl border border-[#fbbf24]/20 bg-[#451a03]/30 px-4 py-3 text-xs text-[#fbbf24]">
                    {article.qualityWarnings.join(' · ')}
                  </div>
                )}
                <div className="mt-5 inline-flex rounded-xl border border-border bg-[#18181b] p-1">
                  <button
                    type="button"
                    onClick={() => setShowTranslations(false)}
                    className={`h-8 rounded-lg px-4 text-xs font-medium transition-colors ${!showTranslations ? 'bg-primary-btn text-white' : 'text-text-dim hover:text-text-primary'}`}
                  >
                    原文
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTranslations(true)}
                    className={`h-8 rounded-lg px-4 text-xs font-medium transition-colors ${showTranslations ? 'bg-primary-btn text-white' : 'text-text-dim hover:text-text-primary'}`}
                  >
                    译文
                  </button>
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
                <article className="rounded-2xl border border-border bg-surface-card p-7">
                  <div className="prose prose-invert max-w-none">
                    {article.article.split(/\n{2,}/).map((paragraph, index) => (
                      <div key={index} className="mb-6 last:mb-0">
                        <p className="text-[15px] leading-8 text-text-secondary">
                          {renderHighlightedParagraph(paragraph)}
                        </p>
                        {showTranslations && article.paragraphTranslations?.[index] && (
                          <p className="mt-3 rounded-xl border border-border bg-[#18181b] px-4 py-3 text-sm leading-7 text-text-muted">
                            {article.paragraphTranslations[index]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </article>

                <aside className="rounded-2xl border border-border bg-surface-card p-5 h-fit lg:sticky lg:top-6">
                  <div className="text-sm font-semibold text-text-primary mb-3">本篇使用的笔记</div>
                  <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1">
                    {article.notes.map((note) => {
                      const usage = formatNoteUsage(note)
                      return (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => note.noteId && navigate(`/kb/${note.noteId}`)}
                        className="rounded-xl border border-border bg-[#18181b] p-3 text-left hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold text-text-primary truncate">{note.expression}</span>
                          {note.isVariant && (
                            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                              变体
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] leading-relaxed text-text-dim">
                          {usage.line}
                        </div>
                        {note.noteTranslation && (
                          <div className="mt-1 text-[11px] text-text-subtle">
                            释义：{note.noteTranslation}
                          </div>
                        )}
                        {note.explanation && (
                          <div className="mt-1 text-[11px] text-text-subtle leading-relaxed">
                            {note.explanation}
                          </div>
                        )}
                      </button>
                      )
                    })}
                  </div>
                </aside>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}

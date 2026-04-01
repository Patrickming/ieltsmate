import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Calendar, RefreshCw, List } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Layout } from '../components/layout/Layout'
import { apiUrl } from '../lib/apiBase'
import { useAppStore, type TocItem } from '../store/useAppStore'

interface WritingNoteDetail {
  id: string
  name: string
  path: string
  writingType: '大作文' | '小作文'
  updatedAt: string
  content: string
}

function formatDate(isoStr: string): string {
  const now = new Date()
  const d = new Date(isoStr)
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays}天前`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 5) return `${diffWeeks}周前`
  return `${Math.floor(diffDays / 30)}个月前`
}

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
}

function parseToc(markdown: string): TocItem[] {
  return markdown
    .split('\n')
    .flatMap((line) => {
      const m = line.match(/^(#{1,5})\s+(.+)/)
      if (!m) return []
      return [{ level: m[1].length, text: m[2].trim(), id: slugify(m[2].trim()) }]
    })
}

function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(extractText).join('')
  if (children !== null && typeof children === 'object' && 'props' in (children as object)) {
    return extractText((children as React.ReactElement).props.children as React.ReactNode)
  }
  return String(children ?? '')
}

export default function WritingNoteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [note, setNote] = useState<WritingNoteDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const { setWritingToc, clearWritingToc, writingTocOpen, toggleWritingToc } = useAppStore()

  const fetchDetail = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    try {
      const res = await fetch(apiUrl(`/writing-notes/${encodeURIComponent(id)}`))
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      if (!res.ok) return
      const json = (await res.json()) as { data?: WritingNoteDetail }
      if (json.data) {
        setNote(json.data)
        setWritingToc(parseToc(json.data.content))
      }
    } catch {
      // 静默，保持上次值
    } finally {
      setLoading(false)
    }
  }, [id, setWritingToc])

  useEffect(() => {
    void fetchDetail()
  }, [fetchDetail, refreshKey])

  useEffect(() => {
    return () => { clearWritingToc() }
  }, [clearWritingToc])

  if (notFound) {
    return (
      <Layout title="写作笔记">
        <div className="p-8 flex flex-col items-center gap-4 text-text-dim">
          <FileText size={40} className="opacity-30" />
          <p>写作笔记未找到</p>
          <button onClick={() => navigate(-1)} className="text-primary text-sm hover:underline">
            返回知识库
          </button>
        </div>
      </Layout>
    )
  }

  if (loading) {
    return (
      <Layout title="写作笔记">
        <div className="p-8 flex flex-col gap-6">
          <div className="h-20 bg-surface-card border border-border rounded-xl animate-pulse" />
          <div className="h-96 bg-surface-card border border-border rounded-xl animate-pulse" />
        </div>
      </Layout>
    )
  }

  if (!note) return null

  return (
    <Layout title="写作笔记">
      <div className="px-8 py-8">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-text-dim hover:text-text-muted text-sm transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          返回知识库
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-card border border-border rounded-xl p-5 mb-6 flex items-start gap-4"
        >
          <div className="w-10 h-10 rounded-lg bg-[#1e293b] border border-[#334155] flex items-center justify-center shrink-0">
            <FileText size={18} className="text-[#94a3b8]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-text-primary truncate">{note.name}</h1>
            <p className="text-xs text-text-subtle mt-1 truncate">{note.path}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-subtle shrink-0">
            <Calendar size={12} />
            {formatDate(note.updatedAt)}
          </div>
        </motion.div>

        {/* Markdown content */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface-card border border-border rounded-xl p-8"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 id={slugify(extractText(children))} className="text-2xl font-bold text-text-primary mb-4 pb-3 border-b border-border scroll-mt-6">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 id={slugify(extractText(children))} className="text-lg font-semibold text-text-primary mt-8 mb-3 scroll-mt-6">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 id={slugify(extractText(children))} className="text-base font-semibold text-text-secondary mt-5 mb-2 scroll-mt-6">{children}</h3>
              ),
              h4: ({ children }) => (
                <h4 id={slugify(extractText(children))} className="text-[14px] font-semibold text-text-muted mt-4 mb-1.5 scroll-mt-6">{children}</h4>
              ),
              h5: ({ children }) => (
                <h5 id={slugify(extractText(children))} className="text-[13px] font-medium text-text-dim mt-3 mb-1 scroll-mt-6">{children}</h5>
              ),
              p: ({ children }) => (
                <p className="text-[15px] text-text-secondary leading-relaxed mb-3">{children}</p>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-primary/40 pl-4 py-1 my-3 bg-[#1e1e2e] rounded-r-md">
                  <div className="text-[14px] text-text-muted italic">{children}</div>
                </blockquote>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-')
                if (isBlock) {
                  return (
                    <div className="my-4 bg-[#0d0d10] border border-border rounded-lg overflow-hidden">
                      <div className="px-4 py-2 border-b border-border bg-[#141418] flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#28ca41]" />
                      </div>
                      <pre className="p-4 overflow-x-auto text-[13px] text-[#e2e8f0] font-mono leading-relaxed">
                        <code>{children}</code>
                      </pre>
                    </div>
                  )
                }
                return (
                  <code className="px-1.5 py-0.5 text-[13px] font-mono bg-[#1a1a28] text-primary rounded">
                    {children}
                  </code>
                )
              },
              img: ({ src, alt }) => (
                <img
                  src={src}
                  alt={alt ?? ''}
                  className="max-w-full rounded-lg border border-border my-4"
                />
              ),
              table: ({ children }) => (
                <div className="my-4 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">{children}</table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-[#1a1a28]">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wide border-b border-border">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-2.5 text-[14px] text-text-secondary border-b border-border/50">{children}</td>
              ),
              tr: ({ children }) => (
                <tr className="hover:bg-[#1e1e2e] transition-colors">{children}</tr>
              ),
              ul: ({ children }) => (
                <ul className="my-3 space-y-1.5 list-none pl-0">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="my-3 space-y-1.5 list-decimal list-inside">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="flex items-start gap-2 text-[15px] text-text-secondary">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span>{children}</span>
                </li>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-text-primary">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="italic text-text-muted">{children}</em>
              ),
              hr: () => (
                <hr className="my-6 border-border" />
              ),
              a: ({ href, children }) => (
                <a href={href} className="text-primary underline decoration-primary/40 hover:decoration-primary" target="_blank" rel="noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {note.content}
          </ReactMarkdown>
        </motion.div>

        {/* Footer nav */}
        <div className="flex items-center justify-between mt-6 text-sm text-text-dim">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 hover:text-text-muted transition-colors">
            <ArrowLeft size={13} />
            返回知识库
          </button>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-1.5 hover:text-text-muted transition-colors"
          >
            <RefreshCw size={13} />
            重新加载
          </button>
        </div>
      </div>

      {/* Floating TOC toggle button */}
      <AnimatePresence>
        {note && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.2 }}
            onClick={toggleWritingToc}
            title={writingTocOpen ? '关闭目录' : '打开目录'}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg transition-colors ${
              writingTocOpen
                ? 'bg-primary text-white shadow-primary/30'
                : 'bg-[#1c1c24] border border-border text-text-muted hover:bg-[#27272a] hover:text-text-secondary hover:border-border-strong'
            }`}
          >
            <List size={14} />
            目录
          </motion.button>
        )}
      </AnimatePresence>
    </Layout>
  )
}

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Send, Plus, AlignJustify, ChevronDown, Sparkles, Paperclip, HelpCircle, AlertCircle, Zap, ImageIcon, FileText, XCircle, Camera } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAppStore } from '../../store/useAppStore'
import { apiUrl } from '../../lib/apiBase'
import { Badge } from '../ui/Badge'
import type { Category } from '../../data/mockData'

interface NoteRef {
  id: string
  content: string
  translation: string
  category: string
}

interface Attachment {
  type: 'image' | 'text'
  name: string
  data: string        // base64 for images, raw text for text files
  mimeType: string
  previewUrl?: string // object URL for image preview
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: Attachment[]
  referencedNotes?: NoteRef[]
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: string
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content: '你好！我是 IELTSmate AI 助手。可以帮你解释词汇、分析语法、提供写作建议。有什么需要吗？',
}

const AI_PROMPT_TIP = '白话版 Prompt：你是一位 IELTS 英语学习助手，用中文回答，结合学习者的笔记知识库给出针对性建议，回答简洁实用。'

// Detect whether a model supports explicit thinking/reasoning mode
// Capability flags are now stored per-model via the AI model config modal.
// No keyword-based detection — user marks each model explicitly.

const MIN_HISTORY_WIDTH = 120
const MAX_HISTORY_WIDTH = 300
const DEFAULT_HISTORY_WIDTH = 200
const CHAT_WIDTH = 500       // main chat panel width
const STORAGE_KEY = 'ieltsmate-ai-conversations'

// Serialize conversations for storage: strip large image data to save space
const IMAGE_DATA_MAX_BYTES = 200 * 1024  // keep images ≤ 200KB base64 (~150KB original)

function serializeConversations(convs: Conversation[]): string {
  const stripped = convs.map((c) => ({
    ...c,
    messages: c.messages.map((m) => ({
      ...m,
      attachments: m.attachments?.map((a) => ({
        type: a.type,
        name: a.name,
        mimeType: a.mimeType,
        // Keep text files always; keep small images; drop large images to save space
        data: a.type === 'text'
          ? a.data
          : (a.data && a.data.length <= IMAGE_DATA_MAX_BYTES ? a.data : ''),
        previewUrl: undefined,  // Object URLs are invalid after reload
      })),
    })),
  }))
  return JSON.stringify(stripped)
}

function loadConversations(): Conversation[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Conversation[]
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

export function AIPanel() {
  const navigate = useNavigate()
  const { showAIPanel, closeAIPanel, providers, chatModel } = useAppStore()

  // All available models from configured providers
  const allModels = useMemo(
    () => providers.flatMap((p) => p.models.map((m) => ({ id: m.id, providerName: p.displayName }))),
    [providers],
  )

  const [conversations, setConversations] = useState<Conversation[]>(
    () => loadConversations() ?? [{ id: '1', title: '新对话', messages: [WELCOME], createdAt: '今天' }]
  )
  const [currentConvId, setCurrentConvId] = useState<string>(
    () => {
      const saved = loadConversations()
      return saved?.[0]?.id ?? '1'
    }
  )
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyWidth, setHistoryWidth] = useState(DEFAULT_HISTORY_WIDTH)
  const [showTip, setShowTip] = useState(false)
  // Use the chat slot model from settings, fallback to first available model
  const [model, setModel] = useState(() => chatModel || allModels[0]?.id || '')

  const [thinkingEnabled, setThinkingEnabled] = useState(false)
  // Capability flags come purely from user-marked settings (no keyword guessing)
  const currentModelMeta = providers.flatMap((p) => p.models).find((m) => m.id === model)
  const modelSupportsThinking = currentModelMeta?.isThinking ?? false
  const modelSupportsVision   = currentModelMeta?.isVision   ?? false
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync model when chatModel setting changes; reset thinking if new model doesn't support it
  useEffect(() => {
    if (chatModel && chatModel !== model) {
      setModel(chatModel)
      setThinkingEnabled(false)  // reset on model change
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatModel])
  // Auto-save conversations to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeConversations(conversations))
    } catch {
      // localStorage might be full — silently ignore
    }
  }, [conversations])

  const bottomRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(DEFAULT_HISTORY_WIDTH)

  const currentConv = useMemo(
    () => conversations.find((c) => c.id === currentConvId),
    [conversations, currentConvId]
  )
  const messages = useMemo(
    () => currentConv?.messages ?? [WELCOME],
    [currentConv]
  )

  // Panel total width
  const panelWidth = showHistory ? historyWidth + CHAT_WIDTH : CHAT_WIDTH

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Drag resize logic
  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = historyWidth
    e.preventDefault()
  }, [historyWidth])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientX - dragStartX.current
      const newWidth = Math.min(MAX_HISTORY_WIDTH, Math.max(MIN_HISTORY_WIDTH, dragStartWidth.current + delta))
      setHistoryWidth(newWidth)
    }
    const onMouseUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const createNewConversation = () => {
    const id = Date.now().toString()
    const newConv: Conversation = { id, title: '新对话', messages: [WELCOME], createdAt: '刚刚' }
    setConversations((prev) => [...prev, newConv])
    setCurrentConvId(id)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    // Limit: max 3 attachments total
    const remaining = 3 - pendingAttachments.length
    files.slice(0, remaining).forEach((file) => {
      const isImage = file.type.startsWith('image/')
      const isText = file.type.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(file.name)
      if (!isImage && !isText) return

      if (isImage && file.size > 5 * 1024 * 1024) return // 5MB limit
      if (isText && file.size > 100 * 1024) return        // 100KB limit

      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = ev.target?.result as string
        if (isImage) {
          // result is "data:image/jpeg;base64,..."
          const base64 = result.split(',')[1]
          setPendingAttachments((prev) => [...prev, {
            type: 'image', name: file.name, data: base64,
            mimeType: file.type, previewUrl: result,
          }])
        } else {
          setPendingAttachments((prev) => [...prev, {
            type: 'text', name: file.name, data: result,
            mimeType: file.type,
          }])
        }
      }
      reader.readAsDataURL(file)
    })
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleSend = async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || loading) return
    const userInput = input.trim()
    const attachments = [...pendingAttachments]
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: userInput, attachments: attachments.length > 0 ? attachments : undefined }
    setInput('')
    setPendingAttachments([])
    setLoading(true)

    // Append user message and update conversation title
    setConversations((prev) => prev.map((c) =>
      c.id === currentConvId
        ? {
            ...c,
            title: c.title === '新对话' ? (userInput || attachments[0]?.name || '附件').slice(0, 22) : c.title,
            messages: [...c.messages, userMsg],
          }
        : c,
    ))

    // Build message history for API (exclude the static welcome message)
    const historyMsgs = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => {
        // For past user messages that had attachments, rebuild multi-modal content
        if (m.role === 'user' && m.attachments?.length) {
          const parts: unknown[] = []
          if (m.content) parts.push({ type: 'text', text: m.content })
          for (const a of m.attachments) {
            if (a.type === 'image') {
              parts.push({ type: 'image_url', image_url: { url: `data:${a.mimeType};base64,${a.data}` } })
            } else {
              parts[0] = { type: 'text', text: `【附件: ${a.name}】\n${a.data}\n\n${m.content}` }
            }
          }
          return { role: m.role, content: parts }
        }
        return { role: m.role as 'user' | 'assistant', content: m.content }
      })

    // Build content for current message (multi-modal if attachments present)
    let currentContent: string | unknown[]
    if (attachments.length > 0) {
      const parts: unknown[] = []
      // Inject text files as text context
      const textFiles = attachments.filter((a) => a.type === 'text')
      const textContext = textFiles.map((a) => `【附件: ${a.name}】\n${a.data}`).join('\n\n')
      const fullText = textContext ? `${textContext}\n\n${userInput}` : userInput
      if (fullText) parts.push({ type: 'text', text: fullText })
      // Add images as image_url parts
      for (const a of attachments.filter((a) => a.type === 'image')) {
        parts.push({ type: 'image_url', image_url: { url: `data:${a.mimeType};base64,${a.data}` } })
      }
      currentContent = parts.length === 1 && typeof (parts[0] as { text?: string }).text === 'string'
        ? (parts[0] as { text: string }).text
        : parts
    } else {
      currentContent = userInput
    }

    const apiMessages = [
      {
        role: 'system' as const,
        content:
          '你是一位专业的 IELTS 英语学习助手，用中文回答。结合学习者的雅思备考需求，解释词汇用法、分析语法、提供写作和口语建议，回答简洁实用。',
      },
      ...historyMsgs,
      { role: 'user' as const, content: currentContent },
    ]

    try {
      const res = await fetch(apiUrl('/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          ...(model ? { model } : {}),
          slot: 'chat',
          ...(thinkingEnabled && modelSupportsThinking ? { enableThinking: true } : {}),
        }),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${errText ? ': ' + errText.slice(0, 200) : ''}`)
      }

      const json = (await res.json()) as {
        data?: { content: string; referencedNotes?: NoteRef[] }
      }
      const content = json.data?.content ?? '（AI 未返回内容）'
      const referencedNotes = json.data?.referencedNotes ?? []

      setConversations((prev) => prev.map((c) =>
        c.id === currentConvId
          ? {
              ...c,
              messages: [
                ...c.messages,
                {
                  id: (Date.now() + 1).toString(),
                  role: 'assistant' as const,
                  content,
                  referencedNotes: referencedNotes.length > 0 ? referencedNotes : undefined,
                },
              ],
            }
          : c,
      ))
    } catch (err) {
      const errContent = allModels.length === 0
        ? '⚠️ 尚未配置任何 AI 模型。请先在「设置 → AI 模型配置」中添加提供商和模型。'
        : `⚠️ 请求失败：${err instanceof Error ? err.message : String(err)}`
      setConversations((prev) => prev.map((c) =>
        c.id === currentConvId
          ? { ...c, messages: [...c.messages, { id: (Date.now() + 1).toString(), role: 'assistant', content: errContent }] }
          : c,
      ))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {showAIPanel && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-30"
            onClick={closeAIPanel}
          />
          <motion.div
            initial={{ x: panelWidth }}
            animate={{ x: 0, width: panelWidth }}
            exit={{ x: panelWidth }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 bg-surface-sidebar border-l border-border z-40 flex flex-col shadow-modal overflow-hidden"
            style={{ width: panelWidth }}
          >
            {/* Header */}
            <div className="border-b border-border shrink-0">
              <div className="flex items-center justify-between px-4 h-[52px]">
                {/* Title + tooltip */}
                <div className="flex items-center gap-1.5 relative">
                  <span className="text-[15px] font-semibold text-text-primary">AI 助手</span>
                  <button
                    onMouseEnter={() => setShowTip(true)}
                    onMouseLeave={() => setShowTip(false)}
                    className="text-text-subtle hover:text-text-dim transition-colors"
                  >
                    <HelpCircle size={13} />
                  </button>
                  <AnimatePresence>
                    {showTip && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute left-0 top-7 w-64 bg-[#1a1a28] border border-border rounded-md p-3 text-[11px] text-text-muted z-50 shadow-modal pointer-events-none"
                      >
                        <div className="flex items-center gap-1 mb-1 text-primary">
                          <Sparkles size={9} /><span className="font-semibold">AI 操作说明</span>
                        </div>
                        {AI_PROMPT_TIP}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={createNewConversation}
                    className="flex items-center gap-1.5 h-7 px-2.5 bg-[#1e1e2e] border border-[#27272a] rounded-md text-[12px] text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Plus size={12} />新对话
                  </button>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className={`w-7 h-7 flex items-center justify-center rounded-sm border transition-colors ${
                      showHistory ? 'border-primary bg-[#1e1b4b] text-primary' : 'border-border text-text-dim hover:text-text-muted hover:bg-[#27272a]'
                    }`}
                  >
                    <AlignJustify size={13} />
                  </button>
                  <button
                    onClick={closeAIPanel}
                    className="w-7 h-7 flex items-center justify-center rounded-sm border border-border text-text-dim hover:text-text-muted hover:bg-[#27272a] transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Model selector row */}
              <div className="flex items-center justify-between px-4 h-10 bg-[#141414] relative">
                <span className="text-xs text-text-dim">模型</span>
                <div className="flex items-center gap-1.5">
                  {/* Capability indicators */}
                  {modelSupportsVision && (
                    <span title="此模型支持视觉输入（图片）"
                      className="h-6 w-6 flex items-center justify-center rounded border border-[#0ea5e940] text-[#0ea5e9] opacity-70">
                      <Camera size={10} />
                    </span>
                  )}
                  {modelSupportsThinking && (
                    <button
                      onClick={() => setThinkingEnabled((v) => !v)}
                      title={thinkingEnabled ? '深度思考已开启（点击关闭）' : '开启深度思考模式'}
                      className={`flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-all ${
                        thinkingEnabled
                          ? 'bg-[#fbbf2422] border border-[#fbbf24] text-[#fbbf24]'
                          : 'border border-border text-text-subtle hover:text-text-dim hover:border-border-strong'
                      }`}
                    >
                      <Zap size={10} className={thinkingEnabled ? 'text-[#fbbf24]' : ''} />
                      思考
                    </button>
                  )}
                  <button
                    onClick={() => setShowModelPicker(!showModelPicker)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-[#232328] border border-border rounded-md text-xs text-text-muted hover:border-border-strong transition-colors max-w-[200px]"
                  >
                    <span className="truncate">{model || '选择模型'}</span>
                    <ChevronDown size={11} className="text-text-subtle shrink-0" />
                  </button>
                </div>
                <AnimatePresence>
                  {showModelPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute top-full right-4 mt-1 bg-[#1c1c20] border border-border rounded-md shadow-modal z-10 min-w-[200px]"
                    >
                      {allModels.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-3 text-xs text-text-dim">
                          <AlertCircle size={12} className="text-[#fbbf24] shrink-0" />
                          <span>尚未配置模型，请先到设置页配置 AI 提供商</span>
                        </div>
                      ) : (
                        allModels.map(({ id, providerName }) => (
                          <button
                            key={id}
                            onClick={() => {
                            setModel(id)
                            setShowModelPicker(false)
                            setThinkingEnabled(false)
                          }}
                            className={`flex flex-col w-full px-3 py-2 text-left hover:bg-[#27272a] transition-colors ${id === model ? 'bg-[#1e1b4b]' : ''}`}
                          >
                            <span className={`text-xs truncate ${id === model ? 'text-primary' : 'text-text-muted'}`}>
                              {id === model && '✓ '}{id}
                            </span>
                            <span className="text-[10px] text-text-subtle mt-0.5">{providerName}</span>
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Body: history sidebar + chat area side by side */}
            <div className="flex flex-1 min-h-0">
              {/* History sidebar — left panel */}
              <AnimatePresence initial={false}>
                {showHistory && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: historyWidth, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0 border-r border-border flex flex-col overflow-hidden bg-[#111113]"
                    style={{ width: historyWidth }}
                  >
                    <div className="px-3 py-2.5 border-b border-border shrink-0 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-text-dim">对话历史</span>
                      <button
                        onClick={() => {
                          const fresh = [{ id: Date.now().toString(), title: '新对话', messages: [WELCOME], createdAt: '今天' }]
                          setConversations(fresh)
                          setCurrentConvId(fresh[0].id)
                          localStorage.removeItem(STORAGE_KEY)
                        }}
                        className="text-[10px] text-text-subtle hover:text-[#fb7185] transition-colors"
                        title="清除所有对话记录"
                      >
                        清除
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto py-1">
                      {conversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => setCurrentConvId(conv.id)}
                          className={`w-full text-left px-3 py-2.5 hover:bg-[#27272a] transition-colors ${conv.id === currentConvId ? 'bg-[#1e1e2e]' : ''}`}
                        >
                          <div className="text-xs text-text-secondary truncate">{conv.title}</div>
                          <div className="text-[10px] text-text-subtle mt-0.5">{conv.createdAt}</div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Drag handle */}
              {showHistory && (
                <div
                  className="w-1 cursor-col-resize bg-border hover:bg-primary/40 active:bg-primary/60 transition-colors shrink-0"
                  onMouseDown={onDragStart}
                />
              )}

              {/* Chat area */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-full bg-[#1e1e2e] border border-primary/30 flex items-center justify-center shrink-0">
                          <Sparkles size={13} className="text-primary" />
                        </div>
                      )}
                      <div className={`flex flex-col gap-1.5 max-w-[90%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                        {/* Attachments preview (user messages) */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 justify-end">
                            {msg.attachments.map((a, i) => {
                              const imgSrc = a.previewUrl ?? (a.data ? `data:${a.mimeType};base64,${a.data}` : '')
                              return a.type === 'image' && imgSrc ? (
                                <img
                                  key={i}
                                  src={imgSrc}
                                  alt={a.name}
                                  className="max-w-[160px] max-h-[120px] rounded-lg object-cover border border-border"
                                />
                              ) : (
                                // Image data was stripped (large image after reload) or text file → show filename pill
                                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]"
                                  style={{ background: '#1e1e2e', border: '1px solid #3a3a5a', color: '#a5b4fc' }}>
                                  {a.type === 'image' ? <ImageIcon size={11} /> : <FileText size={11} />}
                                  <span className="max-w-[120px] truncate">{a.name}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Message bubble */}
                        {(msg.content || msg.role === 'assistant') && (
                          <div
                            className="px-3 py-2.5 text-sm leading-relaxed"
                            style={msg.role === 'user'
                              ? { background: '#2e2e48', border: '1px solid #3a3a5a', borderRadius: '12px 12px 4px 12px', color: '#e4e4e7' }
                              : { background: '#1c1c20', border: '1px solid #2a2a35', borderRadius: '4px 12px 12px 12px', color: '#e4e4e7' }
                            }
                          >
                            {msg.role === 'assistant' ? (
                              /* Wrapper applies `li > p { display:inline; margin:0 }` via inline style
                                 to fix react-markdown wrapping list-item text in <p> blocks */
                              <div style={{ ['--li-p-display' as string]: 'inline' }}>
                              <style>{`
                                .ai-md li > p { display: inline; margin: 0; }
                                .ai-md li > p + p { display: block; margin-top: 4px; }
                              `}</style>
                              <div className="ai-md">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                  h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-2 first:mt-0 text-text-primary">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-sm font-bold mt-2.5 mb-1.5 first:mt-0 text-text-primary">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0 text-text-secondary">{children}</h3>,
                                  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                                  li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
                                  strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
                                  em: ({ children }) => <em className="italic text-text-secondary">{children}</em>,
                                  code: ({ children, className }) => className
                                    ? <code className="block bg-[#0d0d1a] rounded p-0.5 text-xs font-mono text-[#a5b4fc]">{children}</code>
                                    : <code className="bg-[#1a1a2e] rounded px-1 py-0.5 text-[11px] font-mono text-[#a5b4fc]">{children}</code>,
                                  pre: ({ children }) => <pre className="bg-[#0d0d1a] rounded-lg p-3 overflow-x-auto text-xs font-mono my-2 border border-[#1e1e3a]">{children}</pre>,
                                  blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/40 pl-3 text-text-dim my-2 italic">{children}</blockquote>,
                                  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">{children}</a>,
                                  hr: () => <hr className="border-border my-3" />,
                                  table: ({ children }) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
                                  th: ({ children }) => <th className="border border-border px-2 py-1 bg-[#1a1a2e] text-left font-semibold text-text-secondary">{children}</th>,
                                  td: ({ children }) => <td className="border border-border px-2 py-1 text-text-muted">{children}</td>,
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                              </div>
                              </div>
                            ) : (
                              <span className="whitespace-pre-wrap">{msg.content}</span>
                            )}
                          </div>
                        )}

                        {/* Referenced notes */}
                        {msg.referencedNotes && msg.referencedNotes.length > 0 && (
                          <div className="flex flex-col gap-1 mt-0.5">
                            <div className="flex items-center gap-1 text-[10px] text-text-subtle">
                              <Paperclip size={9} />
                              参考了 {msg.referencedNotes.length} 条笔记
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.referencedNotes.map((n) => (
                                <button
                                  key={n.id}
                                  type="button"
                                  onClick={() => { closeAIPanel(); navigate(`/kb/${n.id}`) }}
                                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-colors hover:opacity-80"
                                  style={{ background: '#1a2e22', border: '1px solid #34d39966', color: '#34d399' }}
                                  title={n.translation}
                                >
                                  <Badge category={n.category as Category} size="sm" />
                                  <span className="max-w-[120px] truncate">{n.content}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#1e1e2e] border border-primary/30 flex items-center justify-center">
                        <Sparkles size={13} className="text-primary" />
                      </div>
                      <div
                        className="flex gap-1 items-center px-3 py-2.5"
                        style={{ background: '#1c1c20', border: '1px solid #2a2a35', borderRadius: '4px 12px 12px 12px' }}
                      >
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-text-dim"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t border-border shrink-0">
                  {/* Pending attachments preview */}
                  {pendingAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {pendingAttachments.map((a, i) => (
                        <div key={i} className="relative group">
                          {a.type === 'image' ? (
                            <img
                              src={a.previewUrl}
                              alt={a.name}
                              className="w-14 h-14 rounded-lg object-cover border border-border"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border text-[11px] text-text-muted"
                              style={{ background: '#1e1e2e' }}>
                              <FileText size={11} className="text-primary shrink-0" />
                              <span className="max-w-[80px] truncate">{a.name}</span>
                            </div>
                          )}
                          <button
                            onClick={() => setPendingAttachments((prev) => prev.filter((_, j) => j !== i))}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#27272a] border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <XCircle size={12} className="text-text-dim" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-2 bg-[#141414] border border-border rounded-lg px-3 py-2">
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.txt,.md,.csv,.json"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    {/* Attachment button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={pendingAttachments.length >= 3}
                      title={modelSupportsVision ? '添加图片或文本文件（最多3个）' : '当前模型未标记为视觉模型，发送图片可能失败'}
                      className="text-text-subtle hover:text-text-muted transition-colors disabled:opacity-30 shrink-0 mb-0.5"
                    >
                      <ImageIcon size={16} />
                    </button>
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() }
                      }}
                      placeholder="输入消息..."
                      rows={2}
                      className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-subtle outline-none resize-none"
                    />
                    <button
                      onClick={() => void handleSend()}
                      disabled={(!input.trim() && pendingAttachments.length === 0) || loading}
                      className="w-8 h-8 rounded-lg bg-primary-btn hover:bg-[#4338ca] disabled:opacity-50 flex items-center justify-center transition-colors shrink-0"
                    >
                      <Send size={14} className="text-white" />
                    </button>
                  </div>
                  <div className="flex justify-between mt-1.5 px-1">
                    <span className="text-[10px] text-text-subtle">
                      支持图片、.txt/.md/.json 文件（图片≤5MB，文本≤100KB，最多3个）
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

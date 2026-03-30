import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { X, Send, Plus, AlignJustify, ChevronDown, Sparkles, Paperclip, HelpCircle, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import { apiUrl } from '../../lib/apiBase'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  relatedNote?: string
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

const MIN_HISTORY_WIDTH = 120
const MAX_HISTORY_WIDTH = 280
const DEFAULT_HISTORY_WIDTH = 200

export function AIPanel() {
  const { showAIPanel, closeAIPanel, providers, chatModel } = useAppStore()

  // All available models from configured providers
  const allModels = useMemo(
    () => providers.flatMap((p) => p.models.map((m) => ({ id: m.id, providerName: p.displayName }))),
    [providers],
  )

  const [conversations, setConversations] = useState<Conversation[]>([
    { id: '1', title: '新对话', messages: [WELCOME], createdAt: '今天' }
  ])
  const [currentConvId, setCurrentConvId] = useState('1')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyWidth, setHistoryWidth] = useState(DEFAULT_HISTORY_WIDTH)
  const [showTip, setShowTip] = useState(false)
  // Use the chat slot model from settings, fallback to first available model
  const [model, setModel] = useState(() => chatModel || allModels[0]?.id || '')

  // Sync model when chatModel setting changes
  useEffect(() => {
    if (chatModel && chatModel !== model) setModel(chatModel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatModel])
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
  const panelWidth = showHistory ? historyWidth + 360 : 360

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

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userInput = input.trim()
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: userInput }
    setInput('')
    setLoading(true)

    // Append user message and update conversation title
    setConversations((prev) => prev.map((c) =>
      c.id === currentConvId
        ? {
            ...c,
            title: c.title === '新对话' ? userInput.slice(0, 22) : c.title,
            messages: [...c.messages, userMsg],
          }
        : c,
    ))

    // Build message history for API (exclude the static welcome message)
    const historyMsgs = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const apiMessages = [
      {
        role: 'system' as const,
        content:
          '你是一位专业的 IELTS 英语学习助手，用中文回答。结合学习者的雅思备考需求，解释词汇用法、分析语法、提供写作和口语建议，回答简洁实用。',
      },
      ...historyMsgs,
      { role: 'user' as const, content: userInput },
    ]

    try {
      const res = await fetch(apiUrl('/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          ...(model ? { model } : {}),
          slot: 'chat',
        }),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${errText ? ': ' + errText.slice(0, 200) : ''}`)
      }

      const json = (await res.json()) as { data?: { content: string } }
      const content = json.data?.content ?? '（AI 未返回内容）'

      setConversations((prev) => prev.map((c) =>
        c.id === currentConvId
          ? { ...c, messages: [...c.messages, { id: (Date.now() + 1).toString(), role: 'assistant', content }] }
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
                <button
                  onClick={() => setShowModelPicker(!showModelPicker)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#232328] border border-border rounded-md text-xs text-text-muted hover:border-border-strong transition-colors max-w-[200px]"
                >
                  <span className="truncate">{model || '选择模型'}</span>
                  <ChevronDown size={11} className="text-text-subtle shrink-0" />
                </button>
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
                            onClick={() => { setModel(id); setShowModelPicker(false) }}
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
                    <div className="px-3 py-2.5 border-b border-border shrink-0">
                      <span className="text-[11px] font-semibold text-text-dim">对话历史</span>
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
                      <div className={`flex flex-col gap-1.5 max-w-[85%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                        <div
                          className="px-3 py-2.5 text-sm leading-relaxed"
                          style={msg.role === 'user'
                            ? { background: '#2e2e48', border: '1px solid #3a3a5a', borderRadius: '12px 12px 4px 12px', color: '#e4e4e7' }
                            : { background: '#1c1c20', border: '1px solid #2a2a35', borderRadius: '4px 12px 12px 12px', color: '#e4e4e7' }
                          }
                        >
                          {msg.content}
                        </div>
                        {msg.relatedNote && (
                          <div
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px]"
                            style={{ background: '#1a2e22', border: '1px solid #34d399', color: '#34d399' }}
                          >
                            <Paperclip size={10} />
                            相关笔记: {msg.relatedNote}
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
                  <div className="flex items-end gap-2 bg-[#141414] border border-border rounded-lg px-3 py-2">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() }
                      }}
                      placeholder="输入消息... (Enter 发送)"
                      rows={2}
                      className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-subtle outline-none resize-none"
                    />
                    <button
                      onClick={() => void handleSend()}
                      disabled={!input.trim() || loading}
                      className="w-8 h-8 rounded-lg bg-primary-btn hover:bg-[#4338ca] disabled:opacity-50 flex items-center justify-center transition-colors shrink-0"
                    >
                      <Send size={14} className="text-white" />
                    </button>
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

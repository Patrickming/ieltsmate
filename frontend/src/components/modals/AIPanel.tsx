import { useState, useRef, useEffect } from 'react'
import { X, Send, Plus, AlignJustify, ChevronDown, Sparkles, Paperclip, HelpCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import { mockProviders } from '../../data/mockData'

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

function TooltipBtn({ tip, children }: { tip: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative flex items-center">
      {children}
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="ml-1 text-text-subtle hover:text-text-dim transition-colors"
      >
        <HelpCircle size={11} />
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full left-0 mb-2 w-64 bg-[#1a1a28] border border-border rounded-md p-3 text-[11px] text-text-muted z-50 shadow-modal pointer-events-none"
          >
            <div className="flex items-center gap-1 mb-1 text-primary">
              <Sparkles size={9} /><span className="font-semibold">AI 操作说明</span>
            </div>
            {tip}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function AIPanel() {
  const { showAIPanel, closeAIPanel } = useAppStore()
  const [conversations, setConversations] = useState<Conversation[]>([
    { id: '1', title: '关于 get out of 的用法', messages: [WELCOME], createdAt: '今天' }
  ])
  const [currentConvId, setCurrentConvId] = useState('1')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [model, setModel] = useState(mockProviders[0]?.selectedModel?.split('/').pop() ?? 'GLM-Z1-Flash')
  const bottomRef = useRef<HTMLDivElement>(null)

  const currentConv = conversations.find((c) => c.id === currentConvId)!
  const messages = currentConv?.messages ?? [WELCOME]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const createNewConversation = () => {
    const id = Date.now().toString()
    const newConv: Conversation = {
      id,
      title: '新对话',
      messages: [WELCOME],
      createdAt: '刚刚',
    }
    setConversations((prev) => [...prev, newConv])
    setCurrentConvId(id)
    setShowHistory(false)
  }

  const handleSend = () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input }
    const userInput = input
    setInput('')
    setLoading(true)

    setConversations((prev) => prev.map((c) =>
      c.id === currentConvId
        ? { ...c, title: userInput.slice(0, 20), messages: [...c.messages, userMsg] }
        : c
    ))

    setTimeout(() => {
      const replies: Message[] = [
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `关于「${userInput.slice(0, 15)}」，这是一个常见的 IELTS 词汇。建议结合上下文记忆，效果更好。`,
          relatedNote: userInput.split(' ')[0],
        },
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `这个表达在写作中非常实用，可以替换简单词汇提升语言多样性。在雅思口语 Part 2 中也很常见。`,
        },
      ]
      const reply = replies[Math.floor(Math.random() * replies.length)]
      setConversations((prev) => prev.map((c) =>
        c.id === currentConvId
          ? { ...c, messages: [...c.messages, reply] }
          : c
      ))
      setLoading(false)
    }, 1200)
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
            initial={{ x: 380 }}
            animate={{ x: 0 }}
            exit={{ x: 380 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-[360px] bg-surface-sidebar border-l border-border z-40 flex flex-col shadow-modal"
          >
            {/* Header */}
            <div className="border-b border-border">
              <div className="flex items-center justify-between px-4 h-[52px]">
                <TooltipBtn tip={AI_PROMPT_TIP}>
                  <span className="text-[15px] font-semibold text-text-primary">AI 助手</span>
                </TooltipBtn>
                <div className="flex items-center gap-1.5">
                  {/* New conversation */}
                  <button
                    onClick={createNewConversation}
                    className="flex items-center gap-1.5 h-7 px-2.5 bg-[#1e1e2e] border border-[#27272a] rounded-md text-[12px] text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Plus size={12} />新对话
                  </button>
                  {/* History */}
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-7 h-7 flex items-center justify-center rounded-sm border border-border text-text-dim hover:text-text-muted hover:bg-[#27272a] transition-colors"
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
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#232328] border border-border rounded-md text-xs text-text-muted hover:border-border-strong transition-colors"
                >
                  {model}
                  <ChevronDown size={11} className="text-text-subtle" />
                </button>
                <AnimatePresence>
                  {showModelPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute top-full right-4 mt-1 bg-[#1c1c20] border border-border rounded-md shadow-modal z-10 min-w-[200px]"
                    >
                      {mockProviders.flatMap((p) => p.models).map((m) => {
                        const shortName = m.split('/').pop() ?? m
                        return (
                          <button
                            key={m}
                            onClick={() => { setModel(shortName); setShowModelPicker(false) }}
                            className={`flex items-center w-full px-3 py-2 text-xs text-left hover:bg-[#27272a] transition-colors ${shortName === model ? 'text-primary' : 'text-text-muted'}`}
                          >
                            {shortName === model && <span className="mr-2 text-[#34d399]">✓</span>}
                            <span className="truncate">{m}</span>
                          </button>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* History sidebar overlay */}
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ x: -200, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -200, opacity: 0 }}
                  className="absolute left-0 top-[92px] bottom-0 w-52 bg-[#111113] border-r border-border z-10 flex flex-col"
                >
                  <div className="px-3 py-3 border-b border-border">
                    <span className="text-xs font-semibold text-text-dim">对话历史</span>
                  </div>
                  <div className="flex-1 overflow-y-auto py-1">
                    {conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => { setCurrentConvId(conv.id); setShowHistory(false) }}
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

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i === messages.length - 1 ? 0 : 0 }}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-[#1e1e2e] border border-primary/30 flex items-center justify-center shrink-0">
                      <Sparkles size={13} className="text-primary" />
                    </div>
                  )}
                  <div className={`flex flex-col gap-1.5 max-w-[260px] ${msg.role === 'user' ? 'items-end' : ''}`}>
                    <div
                      className="px-3 py-2.5 text-sm leading-relaxed"
                      style={msg.role === 'user'
                        ? { background: '#2e2e48', border: '1px solid #3a3a5a', borderRadius: '12px 12px 4px 12px', color: '#e4e4e7' }
                        : { background: '#1c1c20', border: '1px solid #2a2a35', borderRadius: '4px 12px 12px 12px', color: '#e4e4e7' }
                      }
                    >
                      {msg.content}
                    </div>
                    {/* Related note chip */}
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
                </motion.div>
              ))}

              {/* Loading dots */}
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
            <div className="p-3 border-t border-border">
              <div className="flex items-end gap-2 bg-[#141414] border border-border rounded-lg px-3 py-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                  }}
                  placeholder="输入消息... (Enter 发送)"
                  rows={2}
                  className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-subtle outline-none resize-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="w-8 h-8 rounded-lg bg-primary-btn hover:bg-[#4338ca] disabled:opacity-50 flex items-center justify-center transition-colors shrink-0"
                >
                  <Send size={14} className="text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

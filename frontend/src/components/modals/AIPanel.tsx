import { useState, useRef, useEffect } from 'react'
import { X, Send, Trash2, ChevronDown, Sparkles, Bot, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: '你好！我是 IELTSmate AI 助手。你可以问我任何关于 IELTS 词汇、语法或写作的问题。',
  },
]

const MODELS = ['DeepSeek-V3', 'Claude 3.5 Sonnet', 'GPT-4o', 'Gemini 2.0 Flash']

export function AIPanel() {
  const { showAIPanel, closeAIPanel } = useAppStore()
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [model, setModel] = useState(MODELS[0])
  const [showModelPicker, setShowModelPicker] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Simulated AI reply
    setTimeout(() => {
      const replies = [
        `关于"${input.slice(0, 20)}"，这是一个常见的 IELTS 词汇。建议结合例句记忆效果更好。`,
        `这个表达在写作中非常实用！可以用于替换更简单的词汇，增加语言多样性。`,
        `在口语中，这类短语使用频率很高。建议多练习在不同语境下的用法。`,
      ]
      const reply = replies[Math.floor(Math.random() * replies.length)]
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: reply }])
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
              <div className="flex items-center justify-between px-4 h-13">
                <span className="text-[15px] font-semibold text-text-primary">AI 助手</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMessages(INITIAL_MESSAGES)}
                    className="w-7 h-7 flex items-center justify-center rounded-sm border border-border text-text-dim hover:text-text-muted hover:bg-[#27272a] transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                  <button
                    onClick={closeAIPanel}
                    className="w-7 h-7 flex items-center justify-center rounded-sm border border-border text-text-dim hover:text-text-muted hover:bg-[#27272a] transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              {/* Model selector */}
              <div className="relative px-4 pb-3">
                <button
                  onClick={() => setShowModelPicker(!showModelPicker)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1e1e2e] border border-[#27272a] rounded-md text-xs text-[#a5b4fc] hover:bg-primary/10 transition-colors"
                >
                  <Sparkles size={11} />
                  {model}
                  <ChevronDown size={11} />
                </button>
                <AnimatePresence>
                  {showModelPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute top-full left-4 mt-1 bg-[#1c1c20] border border-border rounded-md shadow-modal z-10 min-w-[180px]"
                    >
                      {MODELS.map((m) => (
                        <button
                          key={m}
                          onClick={() => { setModel(m); setShowModelPicker(false) }}
                          className={`flex items-center w-full px-3 py-2 text-sm text-left hover:bg-[#27272a] transition-colors ${m === model ? 'text-primary' : 'text-text-muted'}`}
                        >
                          {m === model && <span className="mr-2 text-[#34d399]">✓</span>}
                          {m}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'assistant' ? 'bg-[#1e1e3a]' : 'bg-[#1e3a1e]'
                  }`}>
                    {msg.role === 'assistant'
                      ? <Bot size={14} className="text-primary" />
                      : <User size={14} className="text-[#34d399]" />
                    }
                  </div>
                  <div className={`max-w-[260px] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    msg.role === 'assistant'
                      ? 'bg-[#1c1c28] border border-border text-text-secondary'
                      : 'bg-[#1e1b4b] border border-primary/30 text-text-primary'
                  }`}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#1e1e3a] flex items-center justify-center">
                    <Bot size={14} className="text-primary" />
                  </div>
                  <div className="bg-[#1c1c28] border border-border px-3 py-2.5 rounded-xl flex gap-1 items-center">
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
              <div className="flex items-end gap-2 bg-[#141420] border border-border rounded-lg px-3 py-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                  }}
                  placeholder="输入问题..."
                  rows={2}
                  className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-subtle outline-none resize-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="w-7 h-7 rounded-md bg-primary-btn hover:bg-[#4338ca] disabled:opacity-50 flex items-center justify-center transition-colors shrink-0"
                >
                  <Send size={13} className="text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

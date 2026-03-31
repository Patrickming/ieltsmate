import { useState, useEffect, useRef } from 'react'
import { Plus, Check, X, ClipboardList } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'

function getTodayCSTString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

interface TodoListProps {
  onAllDone: (done: boolean) => void
}

export function TodoList({ onAllDone }: TodoListProps) {
  const { todos, todosLoading, loadTodos, addTodo, toggleTodo, deleteTodo } = useAppStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const today = getTodayCSTString()

  useEffect(() => {
    void loadTodos(today)
  }, [today]) // eslint-disable-line react-hooks/exhaustive-deps

  const todayTodos = todos.filter((t) => t.taskDate === today)
  const doneCount = todayTodos.filter((t) => t.done).length
  const total = todayTodos.length
  const allDone = total > 0 && doneCount === total
  const progress = total > 0 ? (doneCount / total) * 100 : 0

  useEffect(() => {
    onAllDone(total > 0 && todayTodos.every((t) => t.done))
  }, [todayTodos, onAllDone, total])

  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setInput('')
    }
  }, [modalOpen])

  function confirmAdd() {
    const text = input.trim()
    if (!text) return
    void addTodo(text, today)
    setModalOpen(false)
  }

  if (todosLoading && todayTodos.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text-secondary">今日任务</span>
        </div>
        <div className="h-8 rounded-lg bg-[#27272a] animate-pulse" />
        <div className="h-8 rounded-lg bg-[#27272a] animate-pulse w-3/4" />
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-secondary">今日任务</span>
            {total > 0 && (
              <motion.span
                key={allDone ? 'done' : 'progress'}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-all ${
                  allDone
                    ? 'bg-[#022c22] text-[#34d399] border border-[#065f46]'
                    : 'bg-[#27272a] text-text-subtle'
                }`}
              >
                {allDone ? '全部完成 ✓' : `${doneCount} / ${total}`}
              </motion.span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-medium text-text-subtle border border-border bg-[#27272a]/50 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
          >
            <Plus size={12} strokeWidth={2.5} />
            添加
          </button>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="h-1 rounded-full bg-[#27272a] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: allDone ? '#34d399' : '#818cf8' }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        )}

        {/* List */}
        <div className="flex flex-col min-h-[48px]">
          <AnimatePresence initial={false}>
            {total === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-2 py-5 text-center"
              >
                <ClipboardList size={24} className="text-border-strong" />
                <p className="text-[12px] text-text-subtle">今天还没有任务</p>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="text-[12px] text-primary hover:underline"
                >
                  添加第一个任务
                </button>
              </motion.div>
            ) : (
              todayTodos.map((todo, i) => (
                <motion.div
                  key={todo.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, overflow: 'hidden', marginBottom: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex items-center gap-3 py-2.5 group ${i !== 0 ? 'border-t border-[#27272a]' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => void toggleTodo(todo.id)}
                    className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                      todo.done
                        ? 'bg-[#34d399] border-[#34d399] scale-95'
                        : 'border-[#3f3f46] bg-transparent hover:border-primary/70'
                    }`}
                  >
                    <AnimatePresence>
                      {todo.done && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Check size={11} strokeWidth={3} className="text-[#052e16]" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>

                  <span
                    onClick={() => void toggleTodo(todo.id)}
                    className={`flex-1 text-[13px] leading-snug cursor-pointer select-none transition-all duration-200 ${
                      todo.done ? 'line-through text-text-subtle opacity-50' : 'text-text-muted'
                    }`}
                  >
                    {todo.text}
                  </span>

                  <motion.button
                    type="button"
                    onClick={() => void deleteTodo(todo.id)}
                    initial={{ opacity: 0 }}
                    whileHover={{ scale: 1.1 }}
                    className="opacity-0 group-hover:opacity-100 shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-text-subtle hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <X size={11} />
                  </motion.button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Add modal */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[3px]"
              onClick={() => setModalOpen(false)}
            />
            <motion.div
              key="dialog"
              initial={{ opacity: 0, scale: 0.96, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] bg-[#18181b] border border-[#3f3f46] rounded-2xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8)] p-6 flex flex-col gap-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-text-primary">添加今日任务</h3>
                  <p className="text-[12px] text-text-subtle mt-0.5">完成后点击左侧勾选框标记</p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-text-subtle hover:text-text-muted hover:bg-[#27272a] transition-all"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-text-subtle font-medium uppercase tracking-wide">任务名称</label>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmAdd()
                    if (e.key === 'Escape') setModalOpen(false)
                  }}
                  placeholder="例如：复习20个单词…"
                  className="w-full h-11 rounded-xl bg-[#27272a] border border-[#3f3f46] px-4 text-[13px] text-text-primary placeholder:text-[#52525b] outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 h-9 rounded-xl text-[13px] font-medium text-text-muted border border-[#3f3f46] hover:border-[#52525b] hover:text-text-secondary transition-all"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={confirmAdd}
                  disabled={!input.trim()}
                  className="flex-1 h-9 rounded-xl text-[13px] font-medium bg-primary-btn text-white hover:bg-primary-btn-hover disabled:opacity-35 disabled:cursor-not-allowed transition-all"
                >
                  确认添加
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

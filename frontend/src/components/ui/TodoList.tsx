import { useState, useEffect, useRef } from 'react'
import { Plus, Check, X, ClipboardList, ChevronLeft, ChevronRight, CalendarDays, Calendar, Pencil } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'

function getCSTDateString(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

function formatDateLabel(dateStr: string, todayStr: string): string {
  const diff = Math.round(
    (new Date(todayStr + 'T12:00:00+08:00').getTime() - new Date(dateStr + 'T12:00:00+08:00').getTime()) / 86_400_000,
  )
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff === 2) return '前天'
  if (diff < 0) {
    const ahead = -diff
    if (ahead === 1) return '明天'
    if (ahead === 2) return '后天'
    if (ahead <= 6) return `${ahead} 天后`
    return new Date(dateStr + 'T12:00:00+08:00').toLocaleDateString('zh-CN', {
      month: 'numeric', day: 'numeric',
    })
  }
  if (diff <= 6) return `${diff} 天前`
  // 超过一周显示具体日期（月/日格式）
  return new Date(dateStr + 'T12:00:00+08:00').toLocaleDateString('zh-CN', {
    month: 'numeric', day: 'numeric',
  })
}

interface TodoListProps {
  onAllDone: (done: boolean) => void
  selectedDate?: string
  onSelectedDateChange?: (date: string) => void
}

export function TodoList({ onAllDone, selectedDate: selectedDateProp, onSelectedDateChange }: TodoListProps) {
  const { todos, todosLoading, loadTodos, addTodo, updateTodoText, toggleTodo, deleteTodo } = useAppStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [taskModalMode, setTaskModalMode] = useState<'add' | 'edit'>('add')
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const today = getCSTDateString(0)
  const [internalSelectedDate, setInternalSelectedDate] = useState(today)
  const selectedDate = selectedDateProp ?? internalSelectedDate
  const isToday = selectedDate === today
  const isFutureDay = selectedDate > today

  function updateSelectedDate(date: string) {
    if (selectedDateProp === undefined) {
      setInternalSelectedDate(date)
    }
    onSelectedDateChange?.(date)
  }

  // 切换日期时加载对应任务
  useEffect(() => {
    void loadTodos(selectedDate)
  }, [selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const dayTodos = todos.filter((t) => t.taskDate === selectedDate)
  const doneCount = dayTodos.filter((t) => t.done).length
  const total = dayTodos.length
  const allDone = total > 0 && doneCount === total
  const progress = total > 0 ? (doneCount / total) * 100 : 0

  // 只有今天的 allDone 才向外汇报（用于热力图黄色）
  useEffect(() => {
    if (isToday) {
      onAllDone(total > 0 && dayTodos.every((t) => t.done))
    }
  }, [dayTodos, onAllDone, total, isToday])

  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setInput('')
      setEditingTodoId(null)
      setTaskModalMode('add')
    }
  }, [modalOpen])

  function openAddModal() {
    setTaskModalMode('add')
    setEditingTodoId(null)
    setInput('')
    setModalOpen(true)
  }

  function openEditModal(todo: { id: string, text: string }) {
    setTaskModalMode('edit')
    setEditingTodoId(todo.id)
    setInput(todo.text)
    setModalOpen(true)
  }

  function confirmTaskModal() {
    const text = input.trim()
    if (!text) return
    if (taskModalMode === 'add') {
      void addTodo(text, selectedDate)
    } else if (editingTodoId) {
      void updateTodoText(editingTodoId, text)
    }
    setModalOpen(false)
  }

  function prevDay() {
    const dt = new Date(selectedDate + 'T12:00:00+08:00')
    dt.setDate(dt.getDate() - 1)
    updateSelectedDate(dt.toISOString().slice(0, 10))
  }

  function nextDay() {
    const dt = new Date(selectedDate + 'T12:00:00+08:00')
    dt.setDate(dt.getDate() + 1)
    updateSelectedDate(dt.toISOString().slice(0, 10))
  }

  function goToday() {
    updateSelectedDate(today)
  }

  if (todosLoading && dayTodos.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text-secondary">每日任务</span>
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
          {/* 左侧：标题 + 日期导航 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-secondary">每日任务</span>

            {/* 日期导航：箭头 + 可点击日期（触发原生日历） */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={prevDay}
                title="前一天"
                className="w-5 h-5 rounded flex items-center justify-center text-text-subtle hover:text-text-muted hover:bg-[#27272a] transition-all"
              >
                <ChevronLeft size={13} />
              </button>

              {/* 点击日期标签弹出原生日期选择器 */}
              <div className="relative">
                <button
                  type="button"
                  title="选择日期"
                  onClick={() => dateInputRef.current?.showPicker?.()}
                  className={`flex items-center gap-1 text-[11px] font-medium px-1.5 min-w-[48px] text-center tabular-nums rounded hover:bg-[#27272a] transition-all ${
                    isToday ? 'text-primary' : 'text-text-dim hover:text-text-muted'
                  }`}
                >
                  <Calendar size={10} className="shrink-0" />
                  {formatDateLabel(selectedDate, today)}
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={selectedDate}
                  onChange={(e) => { if (e.target.value) updateSelectedDate(e.target.value) }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer pointer-events-none"
                  style={{ colorScheme: 'dark' }}
                  tabIndex={-1}
                />
              </div>

              <button
                type="button"
                onClick={nextDay}
                title="后一天"
                className="w-5 h-5 rounded flex items-center justify-center text-text-subtle hover:text-text-muted hover:bg-[#27272a] transition-all"
              >
                <ChevronRight size={13} />
              </button>
            </div>

            {/* 完成计数 / 回到今天 */}
            {!isToday ? (
              <button
                type="button"
                onClick={goToday}
                className="flex items-center gap-1 text-[11px] text-text-subtle hover:text-primary transition-colors"
              >
                <CalendarDays size={11} />
                回到今天
              </button>
            ) : (
              total > 0 && (
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
              )
            )}
          </div>

          {/* 右侧：任意日期均可添加；未来日勾选完成在列表中禁用 */}
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-medium text-text-subtle border border-border bg-[#27272a]/50 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
          >
            <Plus size={12} strokeWidth={2.5} />
            添加
          </button>
        </div>

        {/* 历史日期完成统计徽章 */}
        {!isToday && total > 0 && (
          <div className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full w-fit ${
            allDone
              ? 'bg-[#022c22] text-[#34d399] border border-[#065f46]'
              : 'bg-[#27272a] text-text-subtle'
          }`}>
            {allDone ? `全部完成 ✓  ${total} 项` : `完成 ${doneCount} / ${total}`}
          </div>
        )}

        {/* 进度条（未来日不可勾选，进度保持 0；仍显示条便于布局一致） */}
        {total > 0 && (
          <div className="h-1 rounded-full bg-[#27272a] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: allDone ? '#34d399' : '#818cf8' }}
              initial={{ width: 0 }}
              animate={{ width: `${isFutureDay ? 0 : progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        )}

        {isFutureDay && total > 0 && (
          <p className="text-[11px] text-text-subtle -mt-1">
            未到该日不可勾选完成，可随时修改或删除任务。
          </p>
        )}

        {/* 任务列表 */}
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
                <p className="text-[12px] text-text-subtle">
                  {isToday ? '今天还没有任务' : isFutureDay ? '这一天还没有安排任务' : '这天没有任务记录'}
                </p>
                <button
                  type="button"
                  onClick={openAddModal}
                  className="text-[12px] text-primary hover:underline"
                >
                  添加任务
                </button>
              </motion.div>
            ) : (
              dayTodos.map((todo, i) => (
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
                    disabled={isFutureDay}
                    title={isFutureDay ? '未到该日暂不可标记完成' : undefined}
                    onClick={() => { if (!isFutureDay) void toggleTodo(todo.id) }}
                    className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#3f3f46] ${
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
                    onClick={() => { if (!isFutureDay) void toggleTodo(todo.id) }}
                    className={`flex-1 min-w-0 text-[13px] leading-snug select-none transition-all duration-200 ${
                      isFutureDay ? 'cursor-default text-text-muted' : 'cursor-pointer text-text-muted'
                    } ${todo.done ? 'line-through text-text-subtle opacity-50' : ''}`}
                  >
                    {todo.text}
                  </span>

                  <button
                    type="button"
                    title="修改"
                    onClick={() => openEditModal(todo)}
                    className="opacity-0 group-hover:opacity-100 shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-text-subtle hover:text-primary hover:bg-primary/10 transition-all hover:scale-110"
                  >
                    <Pencil size={11} />
                  </button>

                  <button
                    type="button"
                    title="删除"
                    onClick={() => void deleteTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-text-subtle hover:text-red-400 hover:bg-red-500/10 transition-all hover:scale-110"
                  >
                    <X size={11} />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 添加任务弹窗 */}
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
                  <h3 className="text-[15px] font-semibold text-text-primary">
                    {taskModalMode === 'add'
                      ? `添加任务 · ${formatDateLabel(selectedDate, today)}`
                      : '修改任务'}
                  </h3>
                  <p className="text-[12px] text-text-subtle mt-0.5">
                    {taskModalMode === 'add'
                      ? '任务将记在选中的这一天；未到该日不可勾选完成。'
                      : '可重命名任务；未到任务日不可标记完成。'}
                  </p>
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
                    if (e.key === 'Enter') confirmTaskModal()
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
                  onClick={confirmTaskModal}
                  disabled={!input.trim()}
                  className="flex-1 h-9 rounded-xl text-[13px] font-medium bg-primary-btn text-white hover:bg-primary-btn-hover disabled:opacity-35 disabled:cursor-not-allowed transition-all"
                >
                  {taskModalMode === 'add' ? '确认添加' : '保存'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

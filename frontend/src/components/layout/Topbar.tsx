import { Search, Sparkles } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { Tooltip } from '../ui/Tooltip'

interface TopbarProps {
  title: string
}

/** 次要控件：极简底 + 细边框与克制光晕，与 Sidebar 200ms 节奏对齐 */
const chromeBtn =
  'rounded-sm border border-border-strong bg-[#27272a]/75 text-text-muted shadow-sm backdrop-blur-[2px] transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out hover:border-primary/30 hover:bg-[#27272a] hover:text-text-secondary hover:shadow-[0_0_0_1px_rgba(129,140,248,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg active:scale-[0.985] active:brightness-[0.97]'


export function Topbar({ title }: TopbarProps) {
  const { openSearch, openAIPanel } = useAppStore()

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface-bg px-6">
      <span className="shrink-0 text-[15px] font-semibold text-text-secondary">{title}</span>

      {/* Search bar */}
      <Tooltip content="全局搜索笔记，快捷键 ⌘K" className="flex-1">
        <button
          type="button"
          onClick={openSearch}
          className={`flex h-8 w-full items-center gap-2 px-3 text-left text-text-subtle ${chromeBtn}`}
        >
          <Search size={14} className="shrink-0 opacity-80" />
          <span className="text-[13px]">⌘K 搜索笔记...</span>
        </button>
      </Tooltip>

      {/* Right actions */}
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={openAIPanel} className={`flex h-8 items-center gap-1.5 px-3 text-[13px] ${chromeBtn}`}>
          <Sparkles size={14} className="shrink-0" />
          <span>AI 助手&nbsp; Ctrl+/</span>
        </button>
      </div>
    </header>
  )
}

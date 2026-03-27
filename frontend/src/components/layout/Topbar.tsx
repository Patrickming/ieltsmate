import { Search, Sparkles, Plus } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

interface TopbarProps {
  title: string
}

export function Topbar({ title }: TopbarProps) {
  const { openSearch, openAIPanel, openQuickNote } = useAppStore()

  return (
    <header className="h-14 bg-surface-bg border-b border-border flex items-center gap-4 px-6 shrink-0">
      <span className="text-[15px] font-semibold text-text-secondary shrink-0">{title}</span>

      {/* Search bar */}
      <button
        onClick={openSearch}
        className="flex-1 h-8 bg-[#27272a] border border-border-strong rounded-sm flex items-center gap-2 px-3 text-text-subtle hover:border-[#52525b] transition-colors text-left"
      >
        <Search size={14} />
        <span className="text-[13px]">⌘K 搜索笔记...</span>
      </button>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={openAIPanel}
          className="h-8 flex items-center gap-1.5 px-3 border border-border-strong rounded-sm text-text-muted hover:text-text-secondary hover:bg-[#27272a] transition-colors text-[13px]"
        >
          <Sparkles size={14} />
          <span>AI 助手&nbsp; Ctrl+/</span>
        </button>
        <button
          onClick={openQuickNote}
          className="h-8 flex items-center gap-1.5 px-3.5 bg-primary-btn hover:bg-[#4338ca] rounded-sm text-white text-[13px] font-medium transition-colors"
        >
          <Plus size={14} />
          <span>添加笔记</span>
        </button>
      </div>
    </header>
  )
}

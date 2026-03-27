import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, RefreshCw, Upload, Settings,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import { CATEGORY_BAR, CATEGORIES } from '../../data/mockData'

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: '首页' },
  { path: '/kb', icon: BookOpen, label: '知识库' },
  { path: '/review', icon: RefreshCw, label: '复习' },
]

const GROUPS = ['杂笔记', '写作']

const CATEGORY_EMOJI: Record<string, string> = {
  '口语': '🗣',
  '短语': '💬',
  '句子': '📝',
  '同义替换': '🔄',
  '拼写': '✏',
  '单词': '📖',
  '写作': '✍',
}

const GROUP_EMOJI: Record<string, string> = {
  '杂笔记': '📒',
  '写作': '✍',
}

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { expandedGroups, toggleGroup, openImport } = useAppStore()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const handleCategoryClick = (name: string, group: string) => {
    if (group === '写作') {
      navigate(`/kb?group=写作`)
    } else {
      navigate(`/kb?group=杂笔记&cat=${encodeURIComponent(name)}`)
    }
  }

  return (
    <aside className="w-60 min-w-[240px] h-full bg-surface-sidebar flex flex-col">
      {/* Logo */}
      <div className="px-5 pt-5 pb-3">
        <span
          className="text-[22px] font-bold tracking-tight"
          style={{
            background: 'linear-gradient(135deg, #818cf8 0%, #60a5fa 60%, #34d399 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          IELTSmate
        </span>
        <p className="text-[10px] text-text-subtle mt-0.5 tracking-wide">IELTS 备考助手</p>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-1">
        <div className="px-4 pt-2 pb-1">
          <span className="text-[9px] font-bold text-text-subtle tracking-[1.8px] uppercase">主要</span>
        </div>

        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const active = isActive(path)
          return (
            <NavLink key={path} to={path} end={path === '/'}>
              <div
                className={`relative flex items-center gap-2.5 h-9 mx-2 px-3 rounded-md transition-all ${
                  active
                    ? 'bg-[#1e1b4b] text-[#c7d2fe]'
                    : 'text-text-muted hover:text-text-secondary hover:bg-[#27272a]/60'
                }`}
              >
                {active && (
                  <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-primary rounded-full" />
                )}
                <Icon
                  size={15}
                  className={active ? 'text-primary ml-0.5' : 'text-text-dim ml-0.5'}
                />
                <span className={`text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}>
                  {label}
                </span>
              </div>
            </NavLink>
          )
        })}

        {/* Categories */}
        <div className="px-4 pt-4 pb-1">
          <span className="text-[9px] font-bold text-text-subtle tracking-[1.8px] uppercase">分类</span>
        </div>

        {GROUPS.map((group) => {
          const isOpen = expandedGroups.includes(group)
          const cats = CATEGORIES.filter((c) => c.group === group)

          return (
            <div key={group}>
              <button
                onClick={() => toggleGroup(group)}
                className="flex items-center gap-2 w-full h-8 mx-2 px-3 rounded-md text-text-dim hover:text-text-muted hover:bg-[#27272a]/50 transition-colors"
                style={{ width: 'calc(100% - 16px)' }}
              >
                <span className="text-sm">{GROUP_EMOJI[group]}</span>
                <span className="text-[13px] font-medium flex-1 text-left">{group}</span>
                <motion.span
                  animate={{ rotate: isOpen ? 0 : -90 }}
                  transition={{ duration: 0.15 }}
                >
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    {cats.map(({ name }) => (
                      <button
                        key={name}
                        onClick={() => handleCategoryClick(name, group)}
                        className="flex items-center gap-2 h-7 w-full text-text-dim hover:text-text-muted hover:bg-[#27272a]/40 transition-colors"
                        style={{ paddingLeft: '2.5rem', paddingRight: '1rem' }}
                      >
                        <span className="text-sm">{CATEGORY_EMOJI[name]}</span>
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: CATEGORY_BAR[name] ?? '#71717a' }}
                        />
                        <span className="text-xs">{name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-border pt-1 pb-2">
        <button
          onClick={openImport}
          className="flex items-center gap-2.5 w-full h-9 mx-2 px-3 rounded-md text-text-muted hover:text-text-secondary hover:bg-[#27272a]/60 transition-all group"
          style={{ width: 'calc(100% - 16px)' }}
        >
          <Upload size={14} className="text-text-dim group-hover:text-text-muted transition-colors" />
          <span className="text-[13px] font-medium">导入数据</span>
        </button>
        <NavLink to="/settings">
          {() => {
            const active = isActive('/settings')
            return (
              <div
                className={`flex items-center gap-2.5 w-full h-9 mx-2 px-3 rounded-md transition-all group cursor-pointer ${
                  active ? 'bg-[#1e1b4b] text-[#c7d2fe]' : 'text-text-muted hover:text-text-secondary hover:bg-[#27272a]/60'
                }`}
                style={{ width: 'calc(100% - 16px)' }}
              >
                <Settings size={14} className={active ? 'text-primary' : 'text-text-dim group-hover:text-text-muted transition-colors'} />
                <span className={`text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}>设置</span>
              </div>
            )
          }}
        </NavLink>
      </div>
    </aside>
  )
}

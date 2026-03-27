import { NavLink, useLocation } from 'react-router-dom'
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

export function Sidebar() {
  const location = useLocation()
  const { expandedGroups, toggleGroup, openQuickNote } = useAppStore()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <aside className="w-60 min-w-[240px] h-full bg-surface-sidebar flex flex-col">
      {/* Logo */}
      <div className="px-4 pt-6 pb-2">
        <span className="text-xl font-bold bg-gradient-to-b from-primary to-cat-speech bg-clip-text text-transparent">
          IELTSmate
        </span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-0 py-2">
        <div className="px-4 py-2">
          <span className="text-[10px] font-semibold text-text-subtle tracking-[1.2px]">MAIN</span>
        </div>

        {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
          <NavLink key={path} to={path} end={path === '/'}>
            {() => {
              const active = isActive(path)
              return (
                <div
                  className={`flex items-center gap-2 h-9 px-4 relative transition-colors ${
                    active
                      ? 'bg-[#1e1b4b] text-[#c7d2fe]'
                      : 'text-text-muted hover:text-text-secondary hover:bg-[#27272a]/50'
                  }`}
                >
                  {active && (
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />
                  )}
                  <Icon size={16} className={active ? 'text-primary' : 'text-text-dim'} />
                  <span className="text-[13px] font-medium">{label}</span>
                </div>
              )
            }}
          </NavLink>
        ))}

        {/* Categories */}
        <div className="px-4 pt-4 pb-1">
          <span className="text-[10px] font-semibold text-text-subtle tracking-[1.2px]">CATEGORIES</span>
        </div>

        {GROUPS.map((group) => {
          const isOpen = expandedGroups.includes(group)
          const cats = CATEGORIES.filter((c) => c.group === group)

          return (
            <div key={group}>
              <button
                onClick={() => toggleGroup(group)}
                className="flex items-center gap-1 w-full h-8 px-4 text-text-dim hover:text-text-muted transition-colors"
              >
                <span className="text-[13px] font-medium flex-1 text-left">{group}</span>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
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
                      <NavLink key={name} to={`/kb?cat=${encodeURIComponent(name)}`}>
                        {() => (
                          <div className="flex items-center gap-2 h-7 pl-8 pr-4 text-text-dim hover:text-text-muted transition-colors">
                            <div
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: CATEGORY_BAR[name] ?? '#71717a' }}
                            />
                            <span className="text-xs">{name}</span>
                          </div>
                        )}
                      </NavLink>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-border">
        <button
          onClick={openQuickNote}
          className="flex items-center gap-2 w-full h-9 px-4 text-text-muted hover:text-text-secondary hover:bg-[#27272a]/50 transition-colors"
        >
          <Upload size={16} className="text-text-dim" />
          <span className="text-[13px]">导入数据</span>
        </button>
        <NavLink to="/settings">
          {() => (
            <div className="flex items-center gap-2 w-full h-9 px-4 text-text-muted hover:text-text-secondary hover:bg-[#27272a]/50 transition-colors">
              <Settings size={16} className="text-text-dim" />
              <span className="text-[13px]">设置</span>
            </div>
          )}
        </NavLink>
      </div>
    </aside>
  )
}

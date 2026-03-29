import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, RefreshCw, Upload, Settings,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import { CATEGORY_BAR, CATEGORIES } from '../../data/mockData'

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: '首页' },
  { path: '/kb', icon: BookOpen, label: '知识库' },
  { path: '/review', icon: RefreshCw, label: '复习' },
]

const GROUPS = ['杂笔记', '写作'] as const

const GROUP_SLUG: Record<string, string> = {
  杂笔记: 'misc',
  写作: 'writing',
}

const GROUP_EMOJI: Record<string, string> = {
  '杂笔记': '📒',
  '写作': '✍',
}

const navMotionTransition = { duration: 0.2, ease: 'easeOut' as const }

const itemTransition =
  'transition-[color,transform] duration-200 ease-out active:scale-[0.985] motion-reduce:transition-colors motion-reduce:active:scale-100'

const surfaceHoverTransition =
  'transition-[color,background-color,border-color] duration-200 ease-out active:scale-[0.985] motion-reduce:transition-colors motion-reduce:active:scale-100'

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
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
                className={`group relative flex h-9 mx-2 items-center gap-2.5 rounded-md px-3 ${itemTransition} ${
                  active
                    ? 'text-[#e0e7ff]'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {/* Animated background using layoutId (instant swap when reduced motion) */}
                {active &&
                  (reduceMotion ? (
                    <div className="absolute inset-0 rounded-md border border-primary/40 bg-gradient-to-br from-[#2a2652] via-[#1e1b4b] to-[#18122e] shadow-glow shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" />
                  ) : (
                    <motion.div
                      layoutId="nav-active-bg"
                      className="absolute inset-0 rounded-md border border-primary/40 bg-gradient-to-br from-[#2a2652] via-[#1e1b4b] to-[#18122e] shadow-glow shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      transition={navMotionTransition}
                    />
                  ))}
                {!active &&
                  (reduceMotion ? (
                    <div className="pointer-events-none absolute inset-0 rounded-md bg-[#27272a]/65 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 motion-reduce:transition-none" />
                  ) : (
                    <motion.div
                      whileHover={{ opacity: 1 }}
                      initial={{ opacity: 0 }}
                      transition={navMotionTransition}
                      className="pointer-events-none absolute inset-0 rounded-md bg-[#27272a]/65"
                    />
                  ))}
                {active && (
                  <div className="absolute left-0 top-1 bottom-1 z-10 w-[3px] rounded-full bg-primary shadow-[0_0_14px_rgba(129,140,248,0.55)]" />
                )}
                <Icon
                  size={15}
                  className={`relative z-10 ${active ? 'text-primary ml-0.5' : 'text-text-dim ml-0.5'}`}
                />
                <span className={`relative z-10 text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}>
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
          const slug = GROUP_SLUG[group]
          const panelId = `sidebar-group-panel-${slug}`
          const triggerId = `sidebar-group-trigger-${slug}`

          const categoryButtons = cats.map(({ name }) => (
            <button
              key={name}
              type="button"
              onClick={() => handleCategoryClick(name, group)}
              className={`flex h-7 w-full items-center gap-2 rounded-sm border border-transparent text-text-dim hover:border-border/80 hover:bg-[#27272a]/45 hover:text-text-muted ${surfaceHoverTransition}`}
              style={{ paddingLeft: '2.75rem', paddingRight: '1rem' }}
            >
              <div
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: CATEGORY_BAR[name] ?? '#71717a' }}
              />
              <span className="text-xs">{name}</span>
            </button>
          ))

          return (
            <div key={group}>
              <button
                type="button"
                id={triggerId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleGroup(group)}
                className={`mx-2 flex h-8 w-full items-center gap-2 rounded-md border border-transparent px-3 text-text-dim hover:border-border hover:bg-[#27272a]/50 hover:text-text-muted ${surfaceHoverTransition}`}
                style={{ width: 'calc(100% - 16px)' }}
              >
                <span className="text-sm">{GROUP_EMOJI[group]}</span>
                <span className="flex-1 text-left text-[13px] font-medium">{group}</span>
                {reduceMotion ? (
                  <span
                    className={`inline-flex transition-transform duration-200 ease-out motion-reduce:transition-none ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                  >
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </span>
                ) : (
                  <motion.span
                    animate={{ rotate: isOpen ? 0 : -90 }}
                    transition={navMotionTransition}
                    className="inline-flex"
                  >
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </motion.span>
                )}
              </button>
              {reduceMotion ? (
                isOpen ? (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={triggerId}
                  >
                    {categoryButtons}
                  </div>
                ) : null
              ) : (
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={panelId}
                      role="region"
                      aria-labelledby={triggerId}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={navMotionTransition}
                      style={{ overflow: 'hidden' }}
                    >
                      {categoryButtons}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-border pt-1 pb-2">
        <button
          type="button"
          onClick={openImport}
          className={`group mx-2 flex h-9 w-full items-center gap-2.5 rounded-md border border-transparent px-3 text-text-muted hover:border-border hover:bg-[#27272a]/60 hover:text-text-secondary ${surfaceHoverTransition}`}
          style={{ width: 'calc(100% - 16px)' }}
        >
          <Upload size={14} className="text-text-dim transition-colors duration-200 ease-out group-hover:text-text-muted" />
          <span className="text-[13px] font-medium">导入数据</span>
        </button>
        <NavLink to="/settings">
          {() => {
            const active = isActive('/settings')
            return (
              <div
                className={`group flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md border px-3 mx-2 ${itemTransition} ${
                  active
                    ? 'border-primary/40 bg-gradient-to-br from-[#2a2652] via-[#1e1b4b] to-[#18122e] text-[#e0e7ff] shadow-glow shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'border-transparent text-text-muted hover:border-border hover:bg-[#27272a]/60 hover:text-text-secondary'
                }`}
                style={{ width: 'calc(100% - 16px)' }}
              >
                <Settings
                  size={14}
                  className={
                    active
                      ? 'text-primary'
                      : 'text-text-dim transition-colors duration-200 ease-out group-hover:text-text-muted'
                  }
                />
                <span className={`text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}>设置</span>
              </div>
            )
          }}
        </NavLink>
      </div>
    </aside>
  )
}

import { CATEGORY_COLORS } from '../../data/mockData'

interface BadgeProps {
  category: string
  size?: 'sm' | 'md'
}

export function Badge({ category, size = 'sm' }: BadgeProps) {
  const colors = CATEGORY_COLORS[category] ?? { color: '#a1a1aa', bg: '#27272a', border: '#3f3f46' }
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'

  return (
    <span
      className={`inline-flex items-center rounded font-semibold tracking-wide ${padding}`}
      style={{ color: colors.color, background: colors.bg, border: `1px solid ${colors.border}` }}
    >
      {category}
    </span>
  )
}

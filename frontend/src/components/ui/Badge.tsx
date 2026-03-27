import { CATEGORY_COLORS } from '../../data/mockData'

interface BadgeProps {
  category: string
  size?: 'sm' | 'md'
}

export function Badge({ category, size = 'sm' }: BadgeProps) {
  const colors = CATEGORY_COLORS[category] ?? { color: '#a1a1aa', bg: '#27272a', border: '#3f3f46' }
  const padding = size === 'sm'
    ? 'px-1.5 py-0 text-[10px] leading-4'
    : 'px-2 py-0.5 text-[11px]'

  return (
    <span
      className={`w-fit inline-flex items-center rounded font-medium tracking-wide whitespace-nowrap ${padding}`}
      style={{ color: colors.color, background: colors.bg, border: `1px solid ${colors.border}` }}
    >
      {category}
    </span>
  )
}

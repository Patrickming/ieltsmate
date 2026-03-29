import { type ButtonHTMLAttributes, type ReactNode } from 'react'

interface StrokeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** CSS color for the border and fill, e.g. "#34d399" */
  color: string
  children: ReactNode
}

/**
 * Pill-shaped button: transparent outline by default, fills with color on hover.
 * Uses a ::before pseudo-element at z-index:-1 so text always stays above the fill.
 */
export function StrokeButton({
  color,
  children,
  className = '',
  style,
  ...rest
}: StrokeButtonProps) {
  // Derive a semi-transparent shadow from the color for the glow effect
  const shadow = `${color}70` // ~44% opacity hex suffix

  return (
    <button
      className={`pill-btn ${className}`}
      style={{
        ['--btn-color' as string]: color,
        ['--btn-shadow' as string]: shadow,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

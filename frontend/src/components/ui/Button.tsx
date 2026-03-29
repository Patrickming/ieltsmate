import { motion, useReducedMotion } from 'framer-motion'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type NativeButtonAttrs = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | 'children'
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onAnimationStart'
  | 'onAnimationEnd'
>

export interface ButtonProps extends NativeButtonAttrs {
  children: ReactNode
  variant?: 'primary' | 'ghost' | 'outline' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
}

/** Layout + interaction baseline shared by all variants */
const baseClasses =
  'group relative inline-flex items-center justify-center overflow-hidden rounded-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed'

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-primary-btn text-white shadow-sm shadow-black/20 hover:bg-primary-btn-hover focus-visible:ring-primary/45 hover:shadow-[0_0_0_1px_rgba(129,140,248,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] motion-reduce:hover:shadow-sm',
  ghost:
    'bg-transparent text-text-muted hover:bg-white/[0.06] hover:text-text-secondary focus-visible:ring-text-muted/35 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] motion-reduce:hover:shadow-none',
  outline:
    'border border-border bg-transparent text-text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-border-strong hover:bg-white/[0.04] hover:text-text-secondary focus-visible:ring-border-strong/40 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(63,63,70,0.5)] motion-reduce:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
  danger:
    'border border-[#7f1d1d] bg-[#450a0a] text-[#fb7185] hover:bg-[#7f1d1d] hover:border-[#991b1b] focus-visible:ring-red-500/40 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] motion-reduce:hover:shadow-none',
}

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-7 min-h-7 px-3 text-xs gap-1.5',
  md: 'h-8 min-h-8 px-4 text-sm gap-2',
  lg: 'h-10 min-h-10 px-5 text-sm gap-2',
}

function VariantSheen({ variant }: { variant: NonNullable<ButtonProps['variant']> }) {
  if (variant === 'ghost') return null
  const sheen =
    variant === 'primary'
      ? 'from-white/[0.14] to-transparent opacity-70 group-hover:opacity-100'
      : variant === 'outline'
        ? 'from-white/[0.06] to-transparent opacity-100 group-hover:from-white/[0.09]'
        : 'from-white/[0.08] to-transparent opacity-80 group-hover:opacity-100'
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 rounded-sm bg-gradient-to-b ${sheen} transition-opacity duration-200 motion-reduce:transition-none`}
    />
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    onClick,
    variant = 'outline',
    size = 'md',
    disabled,
    className = '',
    type = 'button',
    icon,
    ...rest
  },
  ref,
) {
  const prefersReducedMotion = useReducedMotion()
  const gesturesDisabled = Boolean(disabled || prefersReducedMotion)

  return (
    <motion.button
      ref={ref}
      {...rest}
      type={type}
      data-variant={variant}
      data-size={size}
      data-reduced-motion={prefersReducedMotion ? 'true' : undefined}
      onClick={onClick}
      disabled={disabled}
      whileTap={gesturesDisabled ? undefined : { scale: 0.96 }}
      whileHover={gesturesDisabled ? undefined : { scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 520, damping: 28 }}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      <VariantSheen variant={variant} />
      {icon && <span className="relative z-10 shrink-0">{icon}</span>}
      <span className="relative z-10 min-w-0">{children}</span>
    </motion.button>
  )
})

Button.displayName = 'Button'

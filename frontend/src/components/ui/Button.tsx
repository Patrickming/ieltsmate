import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'outline' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
  icon?: ReactNode
}

const variants = {
  primary: 'bg-primary-btn hover:bg-[#4338ca] text-white',
  ghost: 'hover:bg-[#27272a] text-text-muted hover:text-text-secondary',
  outline: 'border border-border hover:border-border-strong text-text-muted hover:text-text-secondary',
  danger: 'bg-[#450a0a] hover:bg-[#7f1d1d] text-[#fb7185] border border-[#7f1d1d]',
}

const sizes = {
  sm: 'h-7 px-3 text-xs gap-1.5',
  md: 'h-8 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
}

export function Button({ children, onClick, variant = 'outline', size = 'md', disabled, className = '', type = 'button', icon }: ButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.96 }}
      className={`inline-flex items-center justify-center rounded-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </motion.button>
  )
}

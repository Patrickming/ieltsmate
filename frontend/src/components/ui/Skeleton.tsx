import type { HTMLAttributes } from 'react'

export type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  /** Block height when you omit className (e.g. text line vs avatar) */
  rounded?: 'sm' | 'md' | 'full'
}

const roundedMap = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  full: 'rounded-full',
} as const

export function Skeleton({ className = '', rounded = 'sm', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse motion-reduce:animate-none bg-border/50 ${roundedMap[rounded]} ${className}`}
      aria-hidden
      {...props}
    />
  )
}

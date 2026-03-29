import { Loader2 } from 'lucide-react'
import type { SVGProps } from 'react'

export interface SpinnerProps extends Omit<SVGProps<SVGSVGElement>, 'size'> {
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
}

const frameClasses: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'p-0.5',
  md: 'p-px',
  lg: 'p-0.5',
}

export function Spinner({ size = 'md', className = '', ...props }: SpinnerProps) {
  return (
    <span
      className={`inline-flex rounded-full ring-1 ring-inset ring-primary/25 motion-safe:shadow-[0_0_10px_rgba(129,140,248,0.12)] motion-reduce:shadow-none ${frameClasses[size]}`}
    >
      <Loader2
        className={`motion-safe:animate-spin motion-reduce:animate-none text-primary ${sizeClasses[size]} ${className}`}
        role="status"
        aria-label="加载中"
        {...props}
      />
    </span>
  )
}

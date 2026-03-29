import { forwardRef, type InputHTMLAttributes } from 'react'

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses: Record<NonNullable<InputProps['size']>, string> = {
  sm: 'h-8 min-h-8 px-2.5 text-xs',
  md: 'h-10 min-h-10 px-3 text-sm',
  lg: 'h-12 min-h-12 px-4 text-base',
}

function isAriaInvalidTrue(ariaInvalid: InputProps['aria-invalid']): boolean {
  return ariaInvalid === true || ariaInvalid === 'true'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', size = 'md', 'aria-invalid': ariaInvalid, ...props },
  ref,
) {
  const invalid = isAriaInvalidTrue(ariaInvalid)

  const stateClasses = invalid
    ? 'border-cat-sentence ring-1 ring-cat-sentence/35 focus-visible:ring-cat-sentence/50'
    : 'border-border hover:border-border-strong focus-visible:ring-primary/35'

  return (
    <input
      ref={ref}
      data-size={size}
      data-invalid={invalid ? 'true' : undefined}
      aria-invalid={ariaInvalid}
      className={`w-full rounded-sm border bg-surface-card text-text-primary placeholder:text-text-dim transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${sizeClasses[size]} ${stateClasses} ${className}`}
      {...props}
    />
  )
})

Input.displayName = 'Input'

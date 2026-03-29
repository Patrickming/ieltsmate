import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode } from 'react'

export type TooltipProps = {
  /** Tooltip text (keep short for hover layers) */
  content: ReactNode
  /** Preferred edge placement */
  side?: 'top' | 'bottom'
  /** Wrapper classes for layout participation in flex/grid */
  className?: string
  children: ReactElement
}

function tokenizeDescribedBy(value: string | undefined): string[] {
  if (!value?.trim()) return []
  return value.trim().split(/\s+/).filter(Boolean)
}

/** Merge existing id list with tooltip id, de-duplicated, stable order: existing first */
function mergeDescribedBy(existing: string | undefined, tooltipId: string): string {
  const next = [...tokenizeDescribedBy(existing)]
  if (!next.includes(tooltipId)) next.push(tooltipId)
  return next.join(' ')
}

export function Tooltip({ content, side = 'top', className = '', children }: TooltipProps) {
  const id = useId()
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)

  const existingDescribedBy = isValidElement(children)
    ? (children.props as { 'aria-describedby'?: string })['aria-describedby']
    : undefined

  const ariaDescribedBy = open
    ? mergeDescribedBy(existingDescribedBy, id)
    : existingDescribedBy

  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': ariaDescribedBy?.trim() ? ariaDescribedBy : undefined,
      })
    : children

  const positionClass =
    side === 'top'
      ? 'bottom-full left-1/2 mb-2 -translate-x-1/2'
      : 'top-full left-1/2 mt-2 -translate-x-1/2'

  return (
    <span
      className={`relative inline-flex ${className}`}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      {trigger}
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={
              reduced
                ? { opacity: 1, y: 0 }
                : side === 'top'
                  ? { opacity: 0, y: 6 }
                  : { opacity: 0, y: -6 }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: side === 'top' ? 4 : -4 }}
            transition={{ duration: reduced ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] as const }}
            className={`pointer-events-none absolute z-[60] w-max max-w-[min(16rem,calc(100vw-1.5rem))] rounded-md border border-primary/20 bg-surface-card/95 px-2.5 py-1.5 text-xs leading-snug text-text-secondary shadow-glow backdrop-blur-sm ${positionClass}`}
          >
            <span
              aria-hidden
              className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent"
            />
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

export type ModalShellProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function ModalShell({ open, onClose, children }: ModalShellProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const reduced = useReducedMotion()
  const overlayTransition = reduced
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const }
  const panelTransition = reduced
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 300, damping: 32 }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="modal-overlay"
            data-testid="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="modal-content"
            role="dialog"
            aria-modal="true"
            initial={
              reduced
                ? { opacity: 1, scale: 1, y: 0 }
                : { scale: 0.96, opacity: 0, y: -10 }
            }
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={
              reduced
                ? { opacity: 0 }
                : { scale: 0.96, opacity: 0, y: -10 }
            }
            transition={panelTransition}
            style={{ position: 'fixed', left: '50%', top: '18%', translateX: '-50%', zIndex: 50 }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

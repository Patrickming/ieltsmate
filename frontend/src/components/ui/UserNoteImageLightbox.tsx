import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { backendAssetUrl } from '../../lib/apiBase'

type UserNoteImageLightboxProps = {
  images: string[]
  startIndex: number
  onClose: () => void
  returnFocusTo?: HTMLElement | null
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function UserNoteImageLightbox({
  images,
  startIndex,
  onClose,
  returnFocusTo,
}: UserNoteImageLightboxProps) {
  const [index, setIndex] = useState(startIndex)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(returnFocusTo ?? null)
  const src = backendAssetUrl(images[index] ?? '')

  useEffect(() => {
    setIndex(startIndex)
  }, [startIndex])

  useEffect(() => {
    restoreFocusRef.current = returnFocusTo ?? restoreFocusRef.current
  }, [returnFocusTo])

  useEffect(() => {
    closeButtonRef.current?.focus()

    return () => {
      const trigger = restoreFocusRef.current
      if (trigger?.isConnected) {
        trigger.focus()
      }
    }
  }, [])

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return

    const container = dialogRef.current
    if (!container) return

    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((element) => !element.hasAttribute('disabled'))

    if (focusable.length === 0) {
      event.preventDefault()
      container.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    if (event.shiftKey) {
      if (active === first || !container.contains(active)) {
        event.preventDefault()
        last.focus()
      }
      return
    }

    if (active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!src) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85"
      role="dialog"
      aria-modal="true"
      aria-label="备注图片预览"
      onKeyDown={handleKeyDown}
    >
      <div className="absolute inset-0" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 flex max-h-[90vh] max-w-[90vw] flex-col gap-3 rounded-2xl border border-white/10 bg-[#111111] p-3 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-white/80">
            图片 {index + 1} / {images.length}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="关闭备注图片预览"
            className="rounded-md border border-white/15 bg-white/8 px-3 py-1.5 text-sm text-white transition hover:bg-white/14"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
        <div className="flex max-h-[90vh] max-w-[90vw] items-center gap-3">
          {images.length > 1 && (
            <button
              type="button"
              aria-label="上一张备注图片"
              className="rounded-full border border-white/20 bg-black/40 px-3 py-2 text-2xl leading-none text-white transition hover:bg-black/60"
              onClick={() => setIndex((current) => (current - 1 + images.length) % images.length)}
            >
              ‹
            </button>
          )}
          <img
            src={src}
            alt={`备注图片 ${index + 1}`}
            className="max-h-[80vh] max-w-[80vw] rounded-xl border border-border object-contain"
          />
          {images.length > 1 && (
            <button
              type="button"
              aria-label="下一张备注图片"
              className="rounded-full border border-white/20 bg-black/40 px-3 py-2 text-2xl leading-none text-white transition hover:bg-black/60"
              onClick={() => setIndex((current) => (current + 1) % images.length)}
            >
              ›
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { UserNoteImageLightbox } from './UserNoteImageLightbox'
import { backendAssetUrl } from '../../lib/apiBase'

type UserNoteImageStripProps = {
  images: string[]
  thumbnailClassName: string
  maxVisible?: number
}

export function UserNoteImageStrip({
  images,
  thumbnailClassName,
  maxVisible,
}: UserNoteImageStripProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null)
  const resolvedImages = images.map((image) => backendAssetUrl(image))
  const visibleLimit = typeof maxVisible === 'number' ? Math.max(0, maxVisible) : images.length
  const visibleImages = resolvedImages.slice(0, visibleLimit)
  const hiddenCount = resolvedImages.length - visibleImages.length

  if (resolvedImages.length === 0) return null

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {visibleImages.map((image, index) => (
          <button
            key={`${image}-${index}`}
            type="button"
            aria-label={`查看备注图片 ${index + 1}/${resolvedImages.length}`}
            className={thumbnailClassName}
            onClick={(event) => {
              setReturnFocusTo(event.currentTarget)
              setOpenIndex(index)
            }}
          >
            <img src={image} alt="" className="h-full w-full rounded-md bg-black/10 object-contain" />
          </button>
        ))}
        {hiddenCount > 0 && <div className="self-center text-xs text-text-dim">+{hiddenCount}</div>}
      </div>

      {openIndex !== null && (
        <UserNoteImageLightbox
          images={resolvedImages}
          startIndex={openIndex}
          onClose={() => setOpenIndex(null)}
          returnFocusTo={returnFocusTo}
        />
      )}
    </>
  )
}

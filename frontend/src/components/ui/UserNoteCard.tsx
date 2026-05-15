import type { ReactNode } from 'react'
import type { UserNote } from '../../types/userNote'
import { UserNoteImageStrip } from './UserNoteImageStrip'

type UserNoteCardProps = {
  note: UserNote
  thumbnailClassName: string
  maxVisibleImages?: number
  actions?: ReactNode
}

export function UserNoteCard({
  note,
  thumbnailClassName,
  maxVisibleImages,
  actions,
}: UserNoteCardProps) {
  const hasText = note.content.trim().length > 0
  const hasImages = note.images.length > 0

  if (!hasText && !hasImages) return null

  return (
    <div className="flex items-start gap-2 border-l-2 border-primary/35 pl-3">
      <div className="min-w-0 flex-1">
        {hasText && <p className="text-[13px] leading-relaxed text-text-muted">{note.content}</p>}
        {hasImages && (
          <div className={hasText ? 'mt-2' : undefined}>
            <UserNoteImageStrip
              images={note.images}
              thumbnailClassName={thumbnailClassName}
              maxVisible={maxVisibleImages}
            />
          </div>
        )}
      </div>
      {actions}
    </div>
  )
}

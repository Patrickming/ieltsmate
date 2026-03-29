import { useId } from 'react'
import { useAppStore } from '../../store/useAppStore'

interface FavoriteButtonProps {
  noteId: string
  /** 'full' = icon + sliding text label, 'compact' = icon only (for NoteCard) */
  variant?: 'full' | 'compact'
}

export function FavoriteButton({ noteId, variant = 'full' }: FavoriteButtonProps) {
  const uid = useId()
  const inputId = `fav-${uid}`
  const { favorites, toggleFavorite } = useAppStore()
  const isFav = favorites.includes(noteId)

  const heart = (
    <svg
      className="fav-heart"
      width={variant === 'compact' ? 16 : 15}
      height={variant === 'compact' ? 16 : 15}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )

  return (
    <>
      <input
        type="checkbox"
        id={inputId}
        className="fav-input"
        checked={isFav}
        onChange={() => toggleFavorite(noteId)}
      />
      {variant === 'compact' ? (
        <label htmlFor={inputId} className="fav-label-compact" title={isFav ? '取消收藏' : '收藏'}>
          {heart}
        </label>
      ) : (
        <label htmlFor={inputId} className="fav-label">
          {heart}
          <div className="fav-action">
            <span className="fav-opt1">收藏</span>
            <span className="fav-opt2">已收藏</span>
          </div>
        </label>
      )}
    </>
  )
}

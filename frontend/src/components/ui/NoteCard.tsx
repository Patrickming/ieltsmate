import { CATEGORY_BAR } from '../../data/mockData'
import type { Note } from '../../data/mockData'
import { Badge } from './Badge'
import { FavoriteButton } from './FavoriteButton'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'

interface NoteCardProps {
  note: Note
}

export function NoteCard({ note }: NoteCardProps) {
  const navigate = useNavigate()
  const setSelectedNote = useAppStore((s) => s.setSelectedNote)
  const barColor = CATEGORY_BAR[note.category] ?? '#71717a'

  const handleClick = () => {
    const main = document.querySelector('main')
    if (main) sessionStorage.setItem(`scroll-y:${window.location.pathname}`, String(main.scrollTop))
    setSelectedNote(note)
    navigate(`/kb/${note.id}`)
  }

  // Back face (反面) content: extended info from the DB
  const hasSynonyms = note.synonyms && note.synonyms.length > 0
  const hasExample = !!note.example
  const hasMemoryTip = !!note.memoryTip
  const hasPhonetic = !!note.phonetic

  return (
    /* Perspective wrapper */
    <div
      className="note-flip-card perspective cursor-pointer"
      style={{ height: '210px' }}
    >
      {/* Rotating inner container */}
      <div
        className="note-flip-inner preserve-3d relative w-full h-full"
        style={{
          transition: 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 4px 24px -4px rgba(0,0,0,0.5)',
          borderRadius: '12px',
        }}
      >

        {/* ── 正面 (front, default visible) ─────────────────── */}
        <div
          className="backface-hidden absolute inset-0 rounded-xl overflow-hidden flex flex-col"
          style={{ background: '#1c1c20', border: '1px solid #27272a' }}
        >
          {/* Top accent bar */}
          <div style={{ height: 3, background: barColor, flexShrink: 0 }} />

          {/* Floating blobs (decorative) */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div style={{
              position: 'absolute', borderRadius: '50%',
              background: barColor, opacity: 0.08, filter: 'blur(28px)',
              width: 120, height: 120, top: -30, right: -20,
              animation: 'blob-float 3000ms infinite ease-in-out',
            }} />
            <div style={{
              position: 'absolute', borderRadius: '50%',
              background: barColor, opacity: 0.05, filter: 'blur(20px)',
              width: 70, height: 70, bottom: 10, left: -10,
              animation: 'blob-float 2600ms infinite ease-in-out',
              animationDelay: '-800ms',
            }} />
          </div>

          {/* Content */}
          <div className="relative flex flex-col items-center justify-center text-center gap-2.5 px-5 py-5 flex-1 min-w-0">
            <Badge category={note.category} />
            <div
              className="font-bold text-white w-full truncate leading-tight"
              style={{ fontSize: '24px' }}
            >
              {note.content}
            </div>
            {note.phonetic && (
              <div className="w-full truncate" style={{ fontSize: '13px', color: '#71717a', letterSpacing: '0.02em' }}>
                {note.phonetic}
              </div>
            )}
            <div className="w-full truncate" style={{ fontSize: '16px', color: '#a1a1aa' }}>
              {note.translation}
            </div>
          </div>

          {/* Bottom: mastery status */}
          <div className="flex items-center justify-center pb-2.5">
            {note.reviewStatus === 'mastered' ? (
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                color: '#4ade80', background: 'rgba(74,222,128,0.1)',
                border: '1px solid rgba(74,222,128,0.25)',
                borderRadius: 20, padding: '2px 8px',
              }}>已掌握</span>
            ) : note.reviewStatus === 'learning' ? (
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                color: '#fbbf24', background: 'rgba(251,191,36,0.1)',
                border: '1px solid rgba(251,191,36,0.25)',
                borderRadius: 20, padding: '2px 8px',
              }}>学习中</span>
            ) : (
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                color: '#71717a', background: 'rgba(113,113,122,0.1)',
                border: '1px solid rgba(113,113,122,0.2)',
                borderRadius: 20, padding: '2px 8px',
              }}>新词</span>
            )}
          </div>
        </div>

        {/* ── 反面 (back, visible on hover) ─────────────────── */}
        <div
          className="backface-hidden rotate-y-180 absolute inset-0 rounded-xl overflow-hidden flex items-center justify-center"
          style={{ background: '#151515' }}
        >
          {/* Spinning gradient beam */}
          <div
            style={{
              position: 'absolute',
              width: 80,
              height: '170%',
              background: `linear-gradient(90deg, transparent, ${barColor}88, ${barColor}cc, ${barColor}88, transparent)`,
              animation: 'beam-spin 4000ms infinite linear',
              pointerEvents: 'none',
            }}
          />

          {/* Inner card */}
          <div
            onClick={handleClick}
            style={{
              position: 'absolute',
              inset: 2,
              background: '#18181b',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 8,
              overflow: 'hidden',
            }}
          >
            {/* Category badge + hint */}
            <div className="flex items-center justify-between shrink-0">
              <Badge category={note.category} />
              <span style={{ fontSize: 11, color: '#52525b' }}>点击查看详情 →</span>
            </div>

            {/* Extended content — flex-1 + overflow:hidden keeps layout stable */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
              {hasSynonyms && (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#52525b', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>同义 / 近义</div>
                  <div style={{ fontSize: 14, color: '#a1a1aa', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {note.synonyms!.slice(0, 3).join(' · ')}
                  </div>
                </div>
              )}

              {hasExample && (
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontSize: 11, color: '#52525b', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>例句</div>
                  <div style={{
                    fontSize: 13, color: '#71717a', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {note.example}
                  </div>
                </div>
              )}

              {hasMemoryTip && !hasExample && (
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontSize: 11, color: '#52525b', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>记忆技巧</div>
                  <div style={{
                    fontSize: 13, color: '#71717a', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {note.memoryTip}
                  </div>
                </div>
              )}

              {!hasSynonyms && !hasExample && !hasMemoryTip && !hasPhonetic && (
                <div style={{ fontSize: 13, color: '#52525b', textAlign: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
                  暂无延伸内容
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              fontSize: 11, color: '#3f3f46', flexShrink: 0,
              paddingTop: 8, borderTop: '1px solid #27272a',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{note.createdAt}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: barColor, opacity: 0.8 }}>
                  {note.reviewStatus === 'mastered' ? '已掌握' : note.reviewStatus === 'learning' ? '学习中' : '新词'}
                </span>
                {/* stop propagation so clicking heart doesn't navigate */}
                <div onClick={(e) => e.stopPropagation()}>
                  <FavoriteButton noteId={note.id} variant="compact" />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

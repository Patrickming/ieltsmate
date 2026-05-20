import { useCallback, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { playWordPronunciation } from '@/lib/dictionaryPronunciation'

type PhoneticPlayButtonProps = {
  word: string
  phonetic?: string | null
  audioUrl?: string | null
  loading?: boolean
  className?: string
  iconSize?: number
  textClassName?: string
}

export function PhoneticPlayButton({
  word,
  phonetic,
  audioUrl,
  loading: loadingProp = false,
  className = 'flex items-center gap-2.5 bg-[#141420] border border-[#27272a] rounded-md px-3.5 py-3 w-fit cursor-pointer hover:border-primary/40 transition-colors',
  iconSize = 16,
  textClassName = 'text-[16px] text-[#a5b4fc]',
}: PhoneticPlayButtonProps) {
  const [playing, setPlaying] = useState(false)
  const displayPhonetic = phonetic?.trim()
  const lookupWord = word.trim()
  const busy = loadingProp || playing

  const hasAudio = Boolean(audioUrl?.trim())

  const play = useCallback(async () => {
    if (!lookupWord || !hasAudio) return
    setPlaying(true)
    try {
      await playWordPronunciation(lookupWord, audioUrl)
    } finally {
      setPlaying(false)
    }
  }, [audioUrl, hasAudio, lookupWord])

  if (!lookupWord) return null

  return (
    <button
      type="button"
      data-review-card-interactive="true"
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        void play()
      }}
      disabled={busy}
      aria-label={
        busy ? '加载中' : hasAudio ? '播放发音' : displayPhonetic ? '暂无读音' : '发音'
      }
      title={hasAudio ? '播放发音' : '暂无读音文件'}
      style={{ cursor: hasAudio && !busy ? 'pointer' : 'default' }}
    >
      <Volume2
        size={iconSize}
        className={
          busy
            ? 'text-text-subtle animate-pulse'
            : hasAudio
              ? 'text-primary'
              : 'text-text-subtle opacity-60'
        }
      />
      {displayPhonetic ? (
        <span className={textClassName}>{displayPhonetic}</span>
      ) : (
        <span className={`${textClassName} opacity-70`}>发音</span>
      )}
    </button>
  )
}

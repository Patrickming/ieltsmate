import { useEffect, useRef, useState } from 'react'
import { apiUrl } from '@/lib/apiBase'
import {
  ensureNotePhonetic,
  lookupWordPronunciation,
} from '@/lib/dictionaryPronunciation'
import { PhoneticPlayButton } from './PhoneticPlayButton'

type BritishPhoneticBlockProps = {
  word: string
  noteId?: string
  phonetic?: string | null
  audioUrl?: string | null
  className?: string
  iconSize?: number
  textClassName?: string
}

/** 复习音标：词典优先；无音标时用 AI 写回笔记；无 MP3 时点击不播放 */
export function BritishPhoneticBlock({
  word,
  noteId,
  phonetic,
  audioUrl,
  className,
  iconSize,
  textClassName,
}: BritishPhoneticBlockProps) {
  const [resolved, setResolved] = useState<{
    phonetic?: string
    audioUrl?: string
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const syncedRef = useRef(false)
  const ensureRef = useRef(false)
  const lookupWord = word.trim()

  useEffect(() => {
    syncedRef.current = false
    ensureRef.current = false
    if (!lookupWord) {
      setResolved(null)
      setLoading(false)
      return
    }
    if (phonetic?.trim() && audioUrl?.trim()) {
      setResolved(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const run = async () => {
      let dictPhonetic: string | undefined
      let dictAudio: string | undefined

      const d = await lookupWordPronunciation(lookupWord)
      if (cancelled) return
      if (d?.phonetic?.trim()) dictPhonetic = d.phonetic.trim()
      if (d?.audioUrl?.trim()) dictAudio = d.audioUrl.trim()

      let finalPhonetic = phonetic?.trim() || dictPhonetic
      let finalAudio = audioUrl?.trim() || dictAudio

      if (!finalPhonetic && noteId && !ensureRef.current) {
        ensureRef.current = true
        const ensured = await ensureNotePhonetic(noteId)
        if (cancelled) return
        if (ensured?.phonetic?.trim()) {
          finalPhonetic = ensured.phonetic.trim()
          if (!finalAudio && ensured.audioUrl?.trim()) {
            finalAudio = ensured.audioUrl.trim()
          }
          const { useAppStore } = await import('@/store/useAppStore')
          void useAppStore.getState().loadNotes()
        }
      }

      if (!cancelled && (finalPhonetic || finalAudio)) {
        setResolved({
          phonetic: finalPhonetic,
          audioUrl: finalAudio,
        })
      }
    }

    void run().finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [lookupWord, phonetic, audioUrl, noteId])

  useEffect(() => {
    if (!noteId || syncedRef.current) return
    const ph = phonetic?.trim() || resolved?.phonetic
    if (!ph) return
    if (phonetic?.trim() && audioUrl?.trim()) return
    syncedRef.current = true
    void fetch(apiUrl(`/notes/${noteId}/pronunciation/sync`), { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) return
        const { useAppStore } = await import('@/store/useAppStore')
        void useAppStore.getState().loadNotes()
      })
      .catch(() => {})
  }, [noteId, phonetic, audioUrl, resolved?.phonetic])

  if (!lookupWord) return null

  const displayPhonetic = resolved?.phonetic || phonetic?.trim()
  const displayAudio = audioUrl?.trim() || resolved?.audioUrl

  return (
    <PhoneticPlayButton
      word={lookupWord}
      phonetic={displayPhonetic}
      audioUrl={displayAudio}
      loading={loading}
      className={className}
      iconSize={iconSize}
      textClassName={textClassName}
    />
  )
}

export function pronunciationAudioFromAi(ai: Record<string, unknown>): string | null | undefined {
  const v = ai.pronunciationAudioUrl
  return typeof v === 'string' ? v : v === null ? null : undefined
}

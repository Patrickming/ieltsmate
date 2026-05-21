import { useEffect } from 'react'
import {
  ensureNotePhonetic,
  lookupWordPronunciation,
} from '@/lib/dictionaryPronunciation'

/** 复习卡自动发音：独立 Audio，不因卡片交互或卸载而中断 */
let reviewAutoplayAudio: HTMLAudioElement | null = null

function playReviewAutoplayUrl(url: string): void {
  const trimmed = url.trim()
  if (!trimmed) return
  try {
    if (!reviewAutoplayAudio) {
      reviewAutoplayAudio = new Audio()
    }
    reviewAutoplayAudio.src = trimmed
    reviewAutoplayAudio.currentTime = 0
    void reviewAutoplayAudio.play()
  } catch {
    /* 浏览器自动播放策略等 */
  }
}

/**
 * 进入「拼写」「单词」复习卡正面时自动播放一次发音；无音频则不播放。
 * 不绑定 cleanup 停止播放，避免被翻转等操作打断。
 */
export function useReviewPronunciationAutoplay(opts: {
  enabled: boolean
  noteId: string
  word: string
  audioUrl?: string | null
}): void {
  const { enabled, noteId, word, audioUrl } = opts

  useEffect(() => {
    if (!enabled || !word.trim()) return

    void (async () => {
      let url = audioUrl?.trim()
      if (!url) {
        const d = await lookupWordPronunciation(word)
        url = d?.audioUrl?.trim()
      }
      if (!url && noteId) {
        const ensured = await ensureNotePhonetic(noteId)
        url = ensured?.audioUrl?.trim()
      }
      if (url) playReviewAutoplayUrl(url)
    })()
  }, [enabled, noteId, word, audioUrl])
}

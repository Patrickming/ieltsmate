import { apiUrl } from './apiBase'

export type WordPronunciation = {
  word: string
  phonetic: string | null
  audioUrl: string | null
  accent: 'uk' | 'us' | 'other' | null
  source: 'freedictionaryapi.com' | 'dictionaryapi.dev'
}

const cache = new Map<string, Promise<WordPronunciation | null>>()

export function lookupWordPronunciation(word: string): Promise<WordPronunciation | null> {
  const key = word.trim().toLowerCase().split(/\s+/)[0] ?? ''
  if (!key) return Promise.resolve(null)
  const existing = cache.get(key)
  if (existing) return existing

  const req = fetch(apiUrl(`/dictionary/pronunciation/${encodeURIComponent(key)}`))
    .then(async (res) => {
      if (!res.ok) return null
      const body = (await res.json()) as { data?: WordPronunciation }
      return body.data ?? null
    })
    .then((data) => {
      if (data) cache.set(key, Promise.resolve(data))
      else cache.delete(key)
      return data
    })
    .catch(() => {
      cache.delete(key)
      return null
    })

  cache.set(key, req)
  return req
}

export type EnsuredNotePhonetic = {
  phonetic: string
  audioUrl: string | null
  source: 'note' | 'dictionary' | 'ai'
}

/** 词典无音标时由后端 AI 生成并写回笔记 */
export async function ensureNotePhonetic(
  noteId: string,
): Promise<EnsuredNotePhonetic | null> {
  try {
    const res = await fetch(apiUrl(`/notes/${noteId}/phonetic/ensure`), {
      method: 'POST',
    })
    if (!res.ok) return null
    const body = (await res.json()) as { data?: EnsuredNotePhonetic }
    return body.data ?? null
  } catch {
    return null
  }
}

export async function playAudioUrl(url: string): Promise<boolean> {
  try {
    const audio = new Audio(url)
    await audio.play()
    return true
  } catch {
    return false
  }
}

/** 仅播放 MP3；无音频 URL 时不做任何事（不用 TTS） */
export async function playWordPronunciation(
  _word: string,
  audioUrl?: string | null,
): Promise<void> {
  const url = audioUrl?.trim()
  if (!url) return
  await playAudioUrl(url)
}

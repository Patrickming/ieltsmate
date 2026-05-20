import { Injectable, NotFoundException } from '@nestjs/common'
import type { WordPronunciationDto } from './dictionary.types'
import {
  mergePronunciation,
  normalizeLookupKeys,
  normalizeLookupWord,
  parseDictionaryApiDev,
  parseFreeDictionaryCom,
} from './free-dictionary-api.util'

const COM_BASE =
  process.env.FREE_DICTIONARY_API_BASE?.trim() ||
  'https://api.freedictionaryapi.com/api/v1/entries/en'
const DEV_BASE =
  process.env.DICTIONARY_API_DEV_BASE?.trim() ||
  'https://api.dictionaryapi.dev/api/v2/entries/en'

const FETCH_TIMEOUT_MS = 12_000

@Injectable()
export class FreeDictionaryApiService {
  private readonly britishCache = new Map<string, WordPronunciationDto | null>()

  /** 复习：优先英式音标/音频；无英式条目时回退任意可用 IPA 与发音（避免整词 404） */
  async lookupBritishPronunciation(rawText: string): Promise<WordPronunciationDto | null> {
    for (const key of normalizeLookupKeys(rawText)) {
      const cacheKey = `uk:${key}`
      if (this.britishCache.has(cacheKey)) {
        const hit = this.britishCache.get(cacheKey) ?? null
        if (hit) return hit
        continue
      }
      const fromCom = await this.fetchCom(key, false)
      const fromDev = await this.fetchDev(key, false)
      const merged = mergePronunciation(fromCom, fromDev)
      let result =
        merged && (merged.phonetic || merged.audioUrl)
          ? merged.accent === 'uk'
            ? { ...merged, accent: 'uk' as const }
            : merged
          : null
      if (result && !result.audioUrl) {
        const probed = await this.probeDevAudioUrl(key)
        if (probed) result = { ...result, audioUrl: probed, source: 'dictionaryapi.dev' }
      }
      this.britishCache.set(cacheKey, result)
      if (result) return result
    }
    return null
  }

  async lookupPronunciation(rawWord: string): Promise<WordPronunciationDto> {
    const word = normalizeLookupWord(rawWord)
    if (!word) {
      throw new NotFoundException('无效的单词')
    }

    const [fromCom, fromDev] = await Promise.all([
      this.fetchCom(word),
      this.fetchDev(word),
    ])

    const merged = mergePronunciation(fromCom, fromDev)
    if (!merged || (!merged.phonetic && !merged.audioUrl)) {
      throw new NotFoundException(`未找到「${word}」的音标或发音`)
    }

    return merged
  }

  private async fetchCom(word: string, ukOnly = false): Promise<WordPronunciationDto | null> {
    const url = `${COM_BASE.replace(/\/$/, '')}/${encodeURIComponent(word)}`
    const json = await this.fetchJson(url)
    if (!json) return null
    return parseFreeDictionaryCom(json, word, ukOnly)
  }

  private async fetchDev(word: string, ukOnly = false): Promise<WordPronunciationDto | null> {
    const url = `${DEV_BASE.replace(/\/$/, '')}/${encodeURIComponent(word)}`
    const json = await this.fetchJson(url)
    if (!json) return null
    return parseDictionaryApiDev(json, word, ukOnly)
  }

  /** dictionaryapi.dev 常见命名：/media/pronunciations/en/{word}-uk.mp3 */
  private async probeDevAudioUrl(word: string): Promise<string | null> {
    const mediaBase = `${DEV_BASE.replace(/\/api\/v2\/entries\/en\/?$/, '')}/media/pronunciations/en`
    for (const suffix of ['uk', 'us'] as const) {
      const url = `${mediaBase}/${encodeURIComponent(word)}-${suffix}.mp3`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)
      try {
        const res = await fetch(url, { method: 'HEAD', signal: controller.signal })
        if (res.ok) return url
      } catch {
        /* try next */
      } finally {
        clearTimeout(timer)
      }
    }
    return null
  }

  private async fetchJson(url: string): Promise<unknown | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      if (res.status === 404) return null
      if (!res.ok) return null
      return (await res.json()) as unknown
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }
}

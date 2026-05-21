import type { FreeDictionaryApiService } from '../dictionary/free-dictionary-api.service'
import type { WordPronunciationDto } from '../dictionary/dictionary.types'
import type { WordFamily } from '../notes/types/word-family'
import type { CardAIContent, CardType } from './types/card-ai-content'

export type PronunciationOverlay = {
  phonetic: string
  pronunciationAudioUrl?: string | null
  pronunciationAccent?: 'uk' | null
}

function overlayFromDict(d: WordPronunciationDto): PronunciationOverlay {
  return {
    phonetic: d.phonetic ?? '',
    pronunciationAudioUrl: d.audioUrl,
    pronunciationAccent: d.accent === 'uk' ? 'uk' : null,
  }
}

function hasPhoneticField(
  content: CardAIContent,
): content is CardAIContent & { phonetic: string } {
  return !content.fallback && typeof (content as { phonetic?: unknown }).phonetic === 'string'
}

async function lookupUk(
  dictionary: FreeDictionaryApiService,
  text: string,
): Promise<PronunciationOverlay | null> {
  const d = await dictionary.lookupBritishPronunciation(text)
  if (!d?.phonetic) return null
  return overlayFromDict(d)
}

async function enrichWordFamily(
  dictionary: FreeDictionaryApiService,
  wf: WordFamily,
): Promise<WordFamily> {
  const words = new Set<string>()
  if (wf.base?.word?.trim()) words.add(wf.base.word.trim())
  for (const bucket of Object.values(wf.derivedByPos ?? {})) {
    for (const item of bucket ?? []) {
      if (item.word?.trim()) words.add(item.word.trim())
    }
  }
  for (const item of wf.rootDerived ?? []) {
    if (item.word?.trim()) words.add(item.word.trim())
  }

  const overlays = new Map<string, PronunciationOverlay>()
  await Promise.all(
    [...words].map(async (w) => {
      const o = await lookupUk(dictionary, w)
      if (o) overlays.set(w.toLowerCase(), o)
    }),
  )

  const applyItem = <T extends { word: string; phonetic?: string }>(item: T): T => {
    const o = overlays.get(item.word.trim().toLowerCase())
    if (!o) return item
    return { ...item, phonetic: o.phonetic }
  }

  return {
    ...wf,
    base: wf.base
      ? (() => {
          const o = overlays.get(wf.base!.word.trim().toLowerCase())
          return o ? { ...wf.base!, phonetic: o.phonetic } : wf.base
        })()
      : wf.base,
    derivedByPos: Object.fromEntries(
      Object.entries(wf.derivedByPos ?? {}).map(([k, list]) => [
        k,
        (list ?? []).map((item) => applyItem(item)),
      ]),
    ) as WordFamily['derivedByPos'],
    rootDerived: (wf.rootDerived ?? []).map((item) => applyItem(item)),
  }
}

/**
 * 用 Free Dictionary API 覆盖复习卡中的音标与英式发音，忽略 AI 生成的 phonetic。
 */
export async function enrichReviewCardWithDictionary(
  dictionary: FreeDictionaryApiService,
  content: CardAIContent,
  cardType: CardType,
  lookupText: string,
): Promise<CardAIContent> {
  if (content.fallback) {
    const main = await lookupUk(dictionary, lookupText)
    if (!main) return content
    return {
      ...content,
      phonetic: main.phonetic,
      pronunciationAudioUrl: main.pronunciationAudioUrl,
      pronunciationAccent: main.pronunciationAccent,
    }
  }

  if (cardType === 'synonym' && 'wordMeanings' in content) {
    const wordMeanings = await Promise.all(
      content.wordMeanings.map(async (row) => {
        const o = await lookupUk(dictionary, row.word)
        if (!o) return { ...row, phonetic: row.phonetic || '' }
        return { ...row, phonetic: o.phonetic }
      }),
    )
    return { ...content, wordMeanings }
  }

  if (!hasPhoneticField(content)) {
    return content
  }

  const main = await lookupUk(dictionary, lookupText)
  let next: CardAIContent = { ...content }
  if (main) {
    next = {
      ...next,
      phonetic: main.phonetic,
      pronunciationAudioUrl: main.pronunciationAudioUrl,
      pronunciationAccent: main.pronunciationAccent,
    }
  } else {
    next = { ...next, phonetic: '' }
  }

  if ('wordFamily' in next && next.wordFamily) {
    next = { ...next, wordFamily: await enrichWordFamily(dictionary, next.wordFamily) }
  }

  return next
}

type CardWithPronunciation = CardAIContent & {
  phonetic: string
  pronunciationAudioUrl?: string | null
  pronunciationAccent?: 'uk' | null
}

/** 词典 enrichment 后音标仍为空时，用笔记/AI 预热结果补全复习卡 */
export function overlayNotePronunciationOnCard(
  content: CardAIContent,
  pron: {
    phonetic: string
    pronunciationAudioUrl?: string | null
    pronunciationAccent?: 'uk' | null
  } | null,
): CardAIContent {
  if (!pron?.phonetic?.trim() || content.fallback || !hasPhoneticField(content)) {
    return content
  }
  const card = content as CardWithPronunciation
  if (card.phonetic?.trim()) return content
  return {
    ...card,
    phonetic: pron.phonetic.trim(),
    pronunciationAudioUrl:
      pron.pronunciationAudioUrl ?? card.pronunciationAudioUrl ?? null,
    pronunciationAccent:
      pron.pronunciationAudioUrl != null
        ? 'uk'
        : (card.pronunciationAccent ?? null),
  }
}

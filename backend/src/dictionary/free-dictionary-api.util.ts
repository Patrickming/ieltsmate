import type { PronunciationAccent, WordPronunciationDto } from './dictionary.types'

const UK_TAG_RE =
  /\b(uk|u\.k\.|british|received-pronunciation|rp|england|commonwealth)\b/i

export function normalizeLookupWord(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return ''
  const first = trimmed.split(/\s+/)[0] ?? ''
  return first.replace(/[^a-z'-]/g, '')
}

/** 短语优先整句，再回退首个单词（用于词典查询顺序） */
export function normalizeLookupKeys(raw: string): string[] {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return []
  const keys: string[] = []
  if (/\s/.test(trimmed)) {
    const phrase = trimmed.replace(/\s+/g, ' ').replace(/[^a-z0-9' -]/g, '').trim()
    if (phrase.length >= 2) keys.push(phrase)
  }
  const head = normalizeLookupWord(raw)
  if (head && !keys.includes(head)) keys.push(head)
  return keys
}

type PronunciationCandidate = {
  phonetic: string | null
  audioUrl: string | null
  accent: PronunciationAccent
  score: number
}

function wrapPhonetic(text: string): string {
  const t = text.trim()
  if (!t) return ''
  if (t.startsWith('/') && t.endsWith('/')) return t
  return `/${t.replace(/^\/+|\/+$/g, '')}/`
}

function isLikelyIpa(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (t.startsWith('http')) return false
  return /^\/.*\/$/.test(t) || /[ˈˌəɪʊæɒɑːθðʃʒŋ]/.test(t)
}

function audioFromRecord(row: Record<string, unknown>): string | null {
  for (const key of ['audio', 'mp3_url', 'ogg_url', 'audioUrl']) {
    const v = row[key]
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim()
  }
  const text = typeof row.text === 'string' ? row.text.trim() : ''
  if (/^https?:\/\//i.test(text)) return text
  return null
}

function accentFromTags(tags: string[] | undefined, audioUrl: string | null): PronunciationAccent {
  if (tags?.some((t) => UK_TAG_RE.test(t))) return 'uk'
  if (audioUrl && /-uk\.|_uk_|\/uk[_-]|en-uk/i.test(audioUrl)) return 'uk'
  if (tags?.some((t) => /\b(us|u\.s\.|american)\b/i.test(t))) return 'us'
  if (audioUrl && /-us\.|_us_|\/us[_-]|en-us/i.test(audioUrl)) return 'us'
  return 'other'
}

function scoreCandidate(c: PronunciationCandidate): number {
  let s = c.score
  if (c.phonetic) s += 2
  if (c.audioUrl) s += 4
  if (c.accent === 'uk') s += 8
  else if (c.accent === 'us') s -= 2
  return s
}

function pickBest(candidates: PronunciationCandidate[]): PronunciationCandidate | null {
  if (candidates.length === 0) return null
  return candidates.reduce((best, cur) =>
    scoreCandidate(cur) > scoreCandidate(best) ? cur : best,
  )
}

function pushCandidate(
  list: PronunciationCandidate[],
  row: Record<string, unknown>,
  extraScore = 0,
  ukOnly = false,
): void {
  const tags = Array.isArray(row.tags)
    ? row.tags.filter((t): t is string => typeof t === 'string')
    : undefined
  const type = typeof row.type === 'string' ? row.type.toLowerCase() : ''
  const rawText = typeof row.text === 'string' ? row.text.trim() : ''
  const audioUrl = audioFromRecord(row)
  const accent = accentFromTags(tags, audioUrl)

  if (ukOnly && accent !== 'uk') return

  let phonetic: string | null = null
  if (rawText && isLikelyIpa(rawText)) phonetic = wrapPhonetic(rawText)
  else if (typeof row.ipa === 'string' && row.ipa.trim()) phonetic = wrapPhonetic(row.ipa)

  if (!phonetic && !audioUrl) return
  if (ukOnly && !phonetic && audioUrl && accent !== 'uk') return

  let score = extraScore
  if (type === 'ipa') score += 3
  if (accent === 'uk') score += 5

  list.push({ phonetic, audioUrl, accent, score })
}

/** https://freedictionaryapi.com — entries[].pronunciations[] */
export function parseFreeDictionaryCom(
  payload: unknown,
  lookupWord: string,
  ukOnly = false,
): WordPronunciationDto | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as Record<string, unknown>
  const word =
    typeof root.word === 'string' && root.word.trim()
      ? root.word.trim().toLowerCase()
      : lookupWord
  const entries = Array.isArray(root.entries) ? root.entries : []
  const candidates: PronunciationCandidate[] = []

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const rawPron = (entry as Record<string, unknown>).pronunciations
    const pronunciations = Array.isArray(rawPron) ? rawPron : []
    for (const p of pronunciations) {
      if (!p || typeof p !== 'object') continue
      pushCandidate(candidates, p as Record<string, unknown>, 0, ukOnly)
    }
  }

  const best = pickBest(candidates)
  if (!best) return null
  if (ukOnly && best.accent !== 'uk') return null
  return {
    word,
    phonetic: best.phonetic,
    audioUrl: best.audioUrl,
    accent: best.phonetic || best.audioUrl ? best.accent : null,
    source: 'freedictionaryapi.com',
  }
}

/** https://api.dictionaryapi.dev — 同系免费 API，英式音频更全，作 fallback */
export function parseDictionaryApiDev(
  payload: unknown,
  lookupWord: string,
  ukOnly = false,
): WordPronunciationDto | null {
  const rows = Array.isArray(payload) ? payload : null
  if (!rows?.length) return null
  const first = rows[0]
  if (!first || typeof first !== 'object') return null
  const entry = first as Record<string, unknown>
  const word =
    typeof entry.word === 'string' && entry.word.trim()
      ? entry.word.trim().toLowerCase()
      : lookupWord

  const candidates: PronunciationCandidate[] = []
  const topPhonetic =
    typeof entry.phonetic === 'string' && entry.phonetic.trim()
      ? wrapPhonetic(entry.phonetic)
      : null

  const phonetics = Array.isArray(entry.phonetics) ? entry.phonetics : []
  for (const p of phonetics) {
    if (!p || typeof p !== 'object') continue
    const row = p as Record<string, unknown>
    const text = typeof row.text === 'string' ? row.text.trim() : ''
    const audio =
      typeof row.audio === 'string' && row.audio.trim()
        ? row.audio.trim().replace(/^\/\//, 'https://')
        : null
    const accent = accentFromTags(undefined, audio)
    const phonetic = text && isLikelyIpa(text) ? wrapPhonetic(text) : null
    if (!phonetic && !audio) continue
    if (ukOnly && accent !== 'uk') continue
    if (ukOnly && audio && !/-uk\.|_uk_|en-uk/i.test(audio)) continue
    let score = 0
    if (accent === 'uk') score += 10
    if (audio?.includes('-uk.')) score += 6
    candidates.push({ phonetic, audioUrl: audio, accent, score })
  }

  if (!ukOnly && topPhonetic && candidates.length === 0) {
    candidates.push({
      phonetic: topPhonetic,
      audioUrl: null,
      accent: 'other',
      score: 1,
    })
  }

  const best = pickBest(candidates)
  if (!best) return null
  if (ukOnly && best.accent !== 'uk') return null
  return {
    word,
    phonetic: best.phonetic ?? topPhonetic,
    audioUrl: best.audioUrl,
    accent: best.phonetic || best.audioUrl ? best.accent : null,
    source: 'dictionaryapi.dev',
  }
}

export function mergePronunciation(
  primary: WordPronunciationDto | null,
  fallback: WordPronunciationDto | null,
): WordPronunciationDto | null {
  if (!primary && !fallback) return null
  if (!primary) return fallback
  if (!fallback) return primary
  return {
    word: primary.word || fallback.word,
    phonetic: primary.phonetic ?? fallback.phonetic,
    audioUrl: primary.audioUrl ?? fallback.audioUrl,
    accent: primary.accent ?? fallback.accent,
    source: primary.audioUrl ? primary.source : fallback.audioUrl ? fallback.source : primary.source,
  }
}

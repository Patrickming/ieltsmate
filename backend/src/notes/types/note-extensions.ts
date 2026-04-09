export interface PartOfSpeechItem {
  pos: string
  label: string
  meaning: string
  phonetic?: string
  example?: string
  exampleTranslation?: string
}

export interface ConfusableWord {
  word: string
  meaning: string
  phonetic?: string
}

export type ConfusableGroup =
  | { kind: 'form'; words: ConfusableWord[] }
  | { kind: 'meaning'; words: ConfusableWord[]; difference: string }

function normKeyPosMeaning(pos: string, meaning: string): string {
  return `${pos.trim().toLowerCase()}|${meaning.trim().toLowerCase()}`
}

/** 词面归一化，用于组去重键中的排序拼接 */
function normWordSurface(word: string): string {
  return word.trim().toLowerCase()
}

/**
 * partsOfSpeech：每项至少 pos/label/meaning，trim；空项丢弃；按 pos+meaning（归一化）去重。
 */
export function normalizePartOfSpeechList(input: unknown): PartOfSpeechItem[] {
  if (!Array.isArray(input)) {
    return []
  }
  const seen = new Set<string>()
  const out: PartOfSpeechItem[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') {
      continue
    }
    const o = raw as Record<string, unknown>
    const pos = typeof o.pos === 'string' ? o.pos.trim() : ''
    const label = typeof o.label === 'string' ? o.label.trim() : ''
    const meaning = typeof o.meaning === 'string' ? o.meaning.trim() : ''
    const phonetic = typeof o.phonetic === 'string' ? o.phonetic.trim() : ''
    const example = typeof o.example === 'string' ? o.example.trim() : ''
    const exampleTranslation =
      typeof o.exampleTranslation === 'string' ? o.exampleTranslation.trim() : ''
    if (!pos || !label || !meaning) {
      continue
    }
    const key = normKeyPosMeaning(pos, meaning)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push({
      pos,
      label,
      meaning,
      ...(phonetic ? { phonetic } : {}),
      ...(example ? { example } : {}),
      ...(exampleTranslation ? { exampleTranslation } : {}),
    })
  }
  return out
}

/**
 * confusables：每组 words >= 2；每项至少 word/meaning；kind 为 form|meaning；
 * kind=meaning 时 difference 必须非空；按 kind + 词面归一化排序拼接去重。
 */
export function normalizeConfusableGroups(input: unknown): ConfusableGroup[] {
  if (!Array.isArray(input)) {
    return []
  }
  const seen = new Set<string>()
  const out: ConfusableGroup[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') {
      continue
    }
    const o = raw as Record<string, unknown>
    const kind = o.kind
    if (kind !== 'form' && kind !== 'meaning') {
      continue
    }
    const wordsRaw = o.words
    if (!Array.isArray(wordsRaw) || wordsRaw.length < 2) {
      continue
    }
    const words: ConfusableWord[] = []
    let valid = true
    for (const w of wordsRaw) {
      if (!w || typeof w !== 'object') {
        valid = false
        break
      }
      const wo = w as Record<string, unknown>
      const word = typeof wo.word === 'string' ? wo.word.trim() : ''
      const meaning = typeof wo.meaning === 'string' ? wo.meaning.trim() : ''
      const phonetic = typeof wo.phonetic === 'string' ? wo.phonetic.trim() : ''
      if (!word || !meaning) {
        valid = false
        break
      }
      words.push({ word, meaning, ...(phonetic ? { phonetic } : {}) })
    }
    if (!valid) {
      continue
    }
    if (kind === 'meaning') {
      const difference = typeof o.difference === 'string' ? o.difference.trim() : ''
      if (!difference) {
        continue
      }
      const dedupKey =
        'meaning|' + words.map((x) => normWordSurface(x.word)).sort().join('\u0001') + '|' + difference.toLowerCase()
      if (seen.has(dedupKey)) {
        continue
      }
      seen.add(dedupKey)
      out.push({ kind: 'meaning', words, difference })
    } else {
      const dedupKey =
        'form|' + words.map((x) => normWordSurface(x.word)).sort().join('\u0001')
      if (seen.has(dedupKey)) {
        continue
      }
      seen.add(dedupKey)
      out.push({ kind: 'form', words })
    }
  }
  return out
}

import type { ConfusableGroup, PartOfSpeechItem } from '../types/noteExtensions'

const POS_ALIAS_TO_CANONICAL: Record<string, string> = {
  n: 'noun',
  'n.': 'noun',
  noun: 'noun',
  v: 'verb',
  'v.': 'verb',
  verb: 'verb',
  adj: 'adjective',
  'adj.': 'adjective',
  adjective: 'adjective',
  adv: 'adverb',
  'adv.': 'adverb',
  adverb: 'adverb',
}

export function canonicalizePos(pos: string): string {
  const normalized = pos.trim().toLowerCase().replace(/\s+/g, '')
  return POS_ALIAS_TO_CANONICAL[normalized] ?? normalized
}

/** 与后端 normalize 一致：pos + meaning（归一化） */
export function posDedupKey(item: PartOfSpeechItem): string {
  return `${canonicalizePos(item.pos)}|${item.meaning.trim().toLowerCase()}`
}

function normWordSurface(word: string): string {
  return word.trim().toLowerCase()
}

/** 忽略 kind，仅按词面集合判断是否同一组 */
export function confusableWordsSurfaceKey(group: ConfusableGroup): string {
  return group.words.map((w) => normWordSurface(w.word)).sort().join('\u0001')
}

/** 与后端 normalizeConfusableGroups 的组键一致 */
export function confusableDedupKey(group: ConfusableGroup): string {
  const sorted = confusableWordsSurfaceKey(group)
  if (group.kind === 'meaning') {
    return `meaning|${sorted}|${group.difference.trim().toLowerCase()}`
  }
  return `form|${sorted}`
}

const posKeySet = (items: PartOfSpeechItem[]) => new Set(items.map(posDedupKey))

/** 先保留 base 顺序，再追加 incoming 中未见过的项 */
export function mergeUniquePos(base: PartOfSpeechItem[], incoming: PartOfSpeechItem[]): PartOfSpeechItem[] {
  const seen = posKeySet(base)
  const out = [...base]
  for (const item of incoming) {
    const k = posDedupKey(item)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

const confKeySet = (groups: ConfusableGroup[]) => new Set(groups.map(confusableDedupKey))

export function mergeUniqueConfusables(base: ConfusableGroup[], incoming: ConfusableGroup[]): ConfusableGroup[] {
  const seen = confKeySet(base)
  const out = [...base]
  for (const g of incoming) {
    const k = confusableDedupKey(g)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(g)
  }
  return out
}

function asRecord(input: unknown): Record<string, unknown> | null {
  return input && typeof input === 'object' ? (input as Record<string, unknown>) : null
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizePartOfSpeechForUI(input: unknown): PartOfSpeechItem[] {
  if (!Array.isArray(input)) return []
  const out: PartOfSpeechItem[] = []
  const seen = new Set<string>()
  for (const row of input) {
    const obj = asRecord(row)
    if (!obj) continue
    const pos = cleanString(obj.pos)
    const label = cleanString(obj.label)
    const meaning = cleanString(obj.meaning)
    if (!pos || !label || !meaning) continue
    const item: PartOfSpeechItem = {
      pos,
      label,
      meaning,
      ...(cleanString(obj.phonetic) ? { phonetic: cleanString(obj.phonetic) } : {}),
      ...(cleanString(obj.example) ? { example: cleanString(obj.example) } : {}),
      ...(cleanString(obj.exampleTranslation)
        ? { exampleTranslation: cleanString(obj.exampleTranslation) }
        : {}),
    }
    const key = posDedupKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

export function normalizeConfusablesForUI(input: unknown): ConfusableGroup[] {
  if (!Array.isArray(input)) return []
  const out: ConfusableGroup[] = []
  const seen = new Set<string>()
  for (const row of input) {
    const obj = asRecord(row)
    if (!obj) continue
    const kind = obj.kind
    if (kind !== 'form' && kind !== 'meaning') continue
    if (!Array.isArray(obj.words) || obj.words.length < 2) continue
    const words = obj.words
      .map((w) => {
        const wo = asRecord(w)
        if (!wo) return null
        const word = cleanString(wo.word)
        const meaning = cleanString(wo.meaning)
        if (!word || !meaning) return null
        const phonetic = cleanString(wo.phonetic)
        return {
          word,
          meaning,
          ...(phonetic ? { phonetic } : {}),
        }
      })
      .filter((w): w is NonNullable<typeof w> => Boolean(w))
    if (words.length < 2) continue
    if (kind === 'meaning') {
      const difference = cleanString(obj.difference)
      if (!difference) continue
      const group: ConfusableGroup = { kind: 'meaning', difference, words }
      const key = confusableDedupKey(group)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(group)
    } else {
      const group: ConfusableGroup = { kind: 'form', words }
      const key = confusableDedupKey(group)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(group)
    }
  }
  return out
}

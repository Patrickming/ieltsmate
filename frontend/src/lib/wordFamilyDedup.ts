import type { Pos4, WordFamily, WordFamilyItem } from '../types/wordFamily'

const POS4_ORDER: Pos4[] = ['noun', 'verb', 'adjective', 'adverb']

export function emptyDerivedByPos(): Record<Pos4, WordFamilyItem[]> {
  return {
    noun: [],
    verb: [],
    adjective: [],
    adverb: [],
  }
}

function asRecord(input: unknown): Record<string, unknown> | null {
  return input && typeof input === 'object' ? (input as Record<string, unknown>) : null
}

function cleanString(input: unknown): string {
  return typeof input === 'string' ? input.trim() : ''
}

function isPos4(input: unknown): input is Pos4 {
  return input === 'noun' || input === 'verb' || input === 'adjective' || input === 'adverb'
}

function normalizeBucketItem(raw: unknown, bucket: Pos4): WordFamilyItem | null {
  const row = asRecord(raw)
  if (!row) return null
  const word = cleanString(row.word)
  const meaning = cleanString(row.meaning)
  if (!word || !meaning) return null
  const posRaw = row.pos
  const pos: Pos4 = isPos4(posRaw) ? posRaw : bucket
  if (pos !== bucket) return null
  return {
    word,
    pos,
    meaning,
    phonetic: cleanString(row.phonetic),
  }
}

/**
 * UI 防御性归一：输入脏 JSON 时不抛异常，非法项直接丢弃。
 * - derivedByPos 四个键始终存在且为数组
 * - rootDerived 始终为数组（与派生项相同校验与去重键）
 * - 派生项仅保留合法 word/pos/meaning，phonetic 兜底为空串
 */
export function normalizeWordFamilyForUI(input: unknown): WordFamily | undefined {
  try {
    const root = asRecord(input)
    if (!root) return undefined
    const baseRaw = asRecord(root.base)
    if (!baseRaw) return undefined
    const baseWord = cleanString(baseRaw.word)
    const baseMeaning = cleanString(baseRaw.meaning)
    if (!baseWord || !baseMeaning) return undefined
    const basePosRaw = cleanString(baseRaw.pos)
    const basePos = isPos4(basePosRaw) ? basePosRaw : 'other'

    const derivedByPos = emptyDerivedByPos()
    const seen = new Set<string>()
    const derivedRaw = asRecord(root.derivedByPos)
    for (const bucket of POS4_ORDER) {
      const rows = derivedRaw?.[bucket]
      if (!Array.isArray(rows)) continue
      for (const row of rows) {
        const normalized = normalizeBucketItem(row, bucket)
        if (!normalized) continue
        const key = wordFamilyItemDedupKey(normalized)
        if (seen.has(key)) continue
        seen.add(key)
        derivedByPos[bucket].push(normalized)
      }
    }

    const rootDerived: WordFamilyItem[] = []
    const rootArr = root.rootDerived
    if (Array.isArray(rootArr)) {
      for (const row of rootArr) {
        const r = asRecord(row)
        if (!r) continue
        const w = cleanString(r.word)
        const m = cleanString(r.meaning)
        if (!w || !m) continue
        const p = r.pos
        if (!isPos4(p)) continue
        const item: WordFamilyItem = { word: w, pos: p, meaning: m, phonetic: cleanString(r.phonetic) }
        const key = wordFamilyItemDedupKey(item)
        if (seen.has(key)) continue
        seen.add(key)
        rootDerived.push(item)
      }
    }

    return {
      base: {
        word: baseWord,
        pos: basePos,
        meaning: baseMeaning,
        ...(cleanString(baseRaw.phonetic) ? { phonetic: cleanString(baseRaw.phonetic) } : {}),
      },
      derivedByPos,
      rootDerived,
    }
  } catch {
    return undefined
  }
}

/** 与后端一致：word + pos + meaning（trim + lower） */
export function wordFamilyItemDedupKey(item: WordFamilyItem): string {
  return `${item.word.trim().toLowerCase()}|${item.pos}|${item.meaning.trim().toLowerCase()}`
}

export function flattenWordFamilyItems(wf: WordFamily): WordFamilyItem[] {
  const out: WordFamilyItem[] = []
  for (const k of POS4_ORDER) {
    out.push(...wf.derivedByPos[k])
  }
  return out
}

export function mergeWordFamilyItems(
  base: WordFamily,
  incomingItems: WordFamilyItem[],
  incomingRootItems?: WordFamilyItem[],
): WordFamily {
  const seen = new Set<string>()
  const derived = emptyDerivedByPos()
  for (const k of POS4_ORDER) {
    for (const it of base.derivedByPos[k]) {
      const key = wordFamilyItemDedupKey(it)
      if (seen.has(key)) continue
      seen.add(key)
      derived[k].push(it)
    }
  }
  for (const it of incomingItems) {
    const key = wordFamilyItemDedupKey(it)
    if (seen.has(key)) continue
    seen.add(key)
    derived[it.pos].push(it)
  }
  const rootDerived: WordFamilyItem[] = []
  for (const it of base.rootDerived ?? []) {
    const key = wordFamilyItemDedupKey(it)
    if (seen.has(key)) continue
    seen.add(key)
    rootDerived.push(it)
  }
  for (const it of incomingRootItems ?? []) {
    const key = wordFamilyItemDedupKey(it)
    if (seen.has(key)) continue
    seen.add(key)
    rootDerived.push(it)
  }
  return { base: { ...base.base }, derivedByPos: derived, rootDerived }
}

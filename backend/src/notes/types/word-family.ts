export type Pos4 = 'noun' | 'verb' | 'adjective' | 'adverb'

export type BasePos = Pos4 | 'other'

export interface WordFamilyBase {
  word: string
  pos: BasePos
  meaning: string
  phonetic?: string
}

export interface WordFamilyItem {
  word: string
  pos: Pos4
  meaning: string
  phonetic: string
}

export interface WordFamily {
  base: WordFamilyBase
  derivedByPos: Record<Pos4, WordFamilyItem[]>
  rootDerived: WordFamilyItem[]
}

const POS4_ORDER: Pos4[] = ['noun', 'verb', 'adjective', 'adverb']

export function emptyDerivedByPos(): Record<Pos4, WordFamilyItem[]> {
  return {
    noun: [],
    verb: [],
    adjective: [],
    adverb: [],
  }
}

function trimStr(x: unknown): string {
  return typeof x === 'string' ? x.trim() : ''
}

/** 与 product 约定一致：word + pos + meaning（trim + lower） */
export function wordFamilyItemDedupKey(item: WordFamilyItem): string {
  return `${item.word.trim().toLowerCase()}|${item.pos}|${item.meaning.trim().toLowerCase()}`
}

function mapToPos4(raw: string): Pos4 | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null
  if (t === 'noun' || t === 'n.' || t === 'n' || t === '名' || t.includes('名词')) {
    return 'noun'
  }
  if (t === 'verb' || t === 'v.' || t === 'v' || t === '动' || t.includes('动词')) {
    return 'verb'
  }
  if (
    t === 'adjective' ||
    t === 'adj.' ||
    t === 'adj' ||
    t === 'a.' ||
    t.includes('形容词') ||
    t.includes('形')
  ) {
    return 'adjective'
  }
  if (t === 'adverb' || t === 'adv.' || t === 'adv' || t.includes('副词') || t.includes('副')) {
    return 'adverb'
  }
  return null
}

function mapToBasePos(raw: string): BasePos | null {
  const t = trimStr(raw)
  if (!t) return null
  const p = mapToPos4(t)
  if (p) return p
  if (/^other|其它|其他$/i.test(t)) return 'other'
  return 'other'
}

function normalizeItemForBucket(
  bucket: Pos4,
  raw: Record<string, unknown>,
  globalSeen: Set<string>,
): WordFamilyItem | null {
  const word = trimStr(raw.word)
  const meaning = trimStr(raw.meaning)
  if (!word || !meaning) return null
  let pos = mapToPos4(trimStr(raw.pos))
  if (!pos) pos = bucket
  if (pos !== bucket) return null
  const phoneticRaw = trimStr(raw.phonetic)
  const item: WordFamilyItem = {
    word,
    pos,
    meaning,
    phonetic: phoneticRaw,
  }
  const k = wordFamilyItemDedupKey(item)
  if (globalSeen.has(k)) return null
  globalSeen.add(k)
  return item
}

function normalizeRootItem(
  raw: Record<string, unknown>,
  globalSeen: Set<string>,
): WordFamilyItem | null {
  const word = trimStr(raw.word)
  const meaning = trimStr(raw.meaning)
  if (!word || !meaning) return null
  const pos = mapToPos4(trimStr(raw.pos))
  if (!pos) return null
  const phoneticRaw = trimStr(raw.phonetic)
  const item: WordFamilyItem = { word, pos, meaning, phonetic: phoneticRaw }
  const k = wordFamilyItemDedupKey(item)
  if (globalSeen.has(k)) return null
  globalSeen.add(k)
  return item
}

/**
 * 校验并归一化 wordFamily；非法结构返回 null。
 * base.word / base.meaning 必填；各分区固定存在（可空数组）。
 */
export function normalizeWordFamily(input: unknown): WordFamily | null {
  if (!input || typeof input !== 'object') {
    return null
  }
  const o = input as Record<string, unknown>
  const baseRaw = o.base
  if (!baseRaw || typeof baseRaw !== 'object') {
    return null
  }
  const b = baseRaw as Record<string, unknown>
  const word = trimStr(b.word)
  const meaning = trimStr(b.meaning)
  if (!word || !meaning) {
    return null
  }
  const posLabel = trimStr(b.pos)
  const pos = mapToBasePos(posLabel)
  if (!pos) {
    return null
  }
  const phoneticB = trimStr(b.phonetic)
  const base: WordFamilyBase = {
    word,
    pos,
    meaning,
    ...(phoneticB ? { phonetic: phoneticB } : {}),
  }

  const globalSeen = new Set<string>()
  const derivedByPos = emptyDerivedByPos()
  const derivedRaw = o.derivedByPos
  if (derivedRaw && typeof derivedRaw === 'object') {
    const d = derivedRaw as Record<string, unknown>
    for (const key of POS4_ORDER) {
      const arr = d[key]
      if (!Array.isArray(arr)) {
        continue
      }
      for (const row of arr) {
        if (!row || typeof row !== 'object') continue
        const item = normalizeItemForBucket(key, row as Record<string, unknown>, globalSeen)
        if (item) {
          derivedByPos[key].push(item)
        }
      }
    }
  }

  const rootDerived: WordFamilyItem[] = []
  const rootArr = o.rootDerived
  if (Array.isArray(rootArr)) {
    for (const row of rootArr) {
      if (!row || typeof row !== 'object') continue
      const item = normalizeRootItem(row as Record<string, unknown>, globalSeen)
      if (item) {
        rootDerived.push(item)
      }
    }
  }

  return { base, derivedByPos, rootDerived }
}

/**
 * 将 incoming 派生项合并进 base，按 word+pos+meaning 全局去重。
 */
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

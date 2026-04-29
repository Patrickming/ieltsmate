import type { Note } from '../data/mockData'
import type { ConfusableGroup, PartOfSpeechItem } from '../types/noteExtensions'
import type { WordFamily, WordFamilyBase, WordFamilyItem } from '../types/wordFamily'

export type SearchModalResult =
  | {
      kind: 'note'
      id: string
      note: Note
    }
  | {
      kind: 'association'
      id: string
      token: string
      note: Note
    }

const ENGLISH_TOKEN_RE = /[A-Za-z]{2,}/g
/** Unicode「汉字」脚本——与英文字段一致：从关联原文中拆出可匹配的片段（子串语义与英文一致） */
const HAN_FRAGMENT_RE = /\p{Script=Han}+/gu

function containsHanScript(s: string): boolean {
  return /\p{Script=Han}/u.test(s)
}

/** 拉丁词条在原文中出现的边界（避免 striped 误判为 stripe） */
function latinTokenLikelyOccurs(text: string, normalizedToken: string): boolean {
  const t = text.toLowerCase()
  const tok = normalizedToken.toLowerCase()
  if (!t.includes(tok)) return false
  const escaped = normalizedToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i').test(text)
}

/**
 * 关联行在主标题中的展示（汉字检索）：若该行是「拉丁短语 + （ + 汉字」紧邻结构，则为 english(命中汉字片段)；
 * 否则仅为含关键词的那一段 Unicode 汉字连续片段。
 */
export function formatHanAssociationPrimaryTitle(source: string, normalizedQuery: string): string | null {
  const ql = normalizedQuery
  if (!ql.trim()) return null
  if (!sliceMatchesQuery(source, ql)) return null

  HAN_FRAGMENT_RE.lastIndex = 0
  for (const hanMatch of source.matchAll(/\p{Script=Han}+/gu)) {
    const rs = hanMatch.index!
    const hanSeg = hanMatch[0]
    if (!hanSeg.toLowerCase().includes(ql)) continue

    const trimmedBefore = source.slice(0, rs).trimEnd()

    const parenEnglish = trimmedBefore.match(/^(.*?[A-Za-z0-9])\s*[(（]\s*$/)
    if (parenEnglish?.[1] && /^[\s\S]*[A-Za-z]/u.test(parenEnglish[1])) {
      const eng = parenEnglish[1].trim().replace(/\s+/g, ' ')
      return `${eng}(${hanSeg}`
    }

    return hanSeg
  }

  return null
}

function associationSourceMatchesToken(
  source: string,
  normalizedToken: string,
  normalizedQuery: string,
): boolean {
  if (!sliceMatchesQuery(source, normalizedQuery)) return false
  if (containsHanScript(normalizedToken)) {
    return source.toLowerCase().includes(normalizedToken.toLowerCase())
  }
  return latinTokenLikelyOccurs(source, normalizedToken)
}

function findSourceLineForAssociationToken(
  note: Note,
  normalizedToken: string,
  normalizedQuery: string,
): string | undefined {
  const orderedSources = collectAssociationTextSources(note)
  const matching = orderedSources.filter((s) =>
    associationSourceMatchesToken(s, normalizedToken, normalizedQuery),
  )
  if (!matching.length) return undefined

  if (!containsHanScript(normalizedQuery)) {
    return matching.find((s) => latinTokenLikelyOccurs(s, normalizedToken)) ?? matching[0]
  }

  const scored = matching.map((s) => ({
    s,
    primary: formatHanAssociationPrimaryTitle(s, normalizedQuery),
  }))

  const sorted = [...scored]
    .filter((row): row is { s: string; primary: string } => row.primary != null && row.primary.length > 0)
    .sort((a, b) => {
      const rb = (b.primary.includes('(') ? 1 : 0) - (a.primary.includes('(') ? 1 : 0)
      if (rb !== 0) return rb
      return orderedSources.indexOf(a.s) - orderedSources.indexOf(b.s)
    })

  return sorted[0]?.s ?? matching[0]
}

function formatAssociationDisplayTitle(note: Note, normalizedToken: string, normalizedQuery: string): string {
  const src = findSourceLineForAssociationToken(note, normalizedToken, normalizedQuery)
  if (!src) return normalizedToken

  if (containsHanScript(normalizedQuery)) {
    return formatHanAssociationPrimaryTitle(src, normalizedQuery) ?? normalizedToken
  }
  return normalizedToken
}

export function extractAssociationEnglishTokens(text: string): string[] {
  return text.match(ENGLISH_TOKEN_RE)?.map((token) => token.toLowerCase()) ?? []
}

export function extractAssociationHanFragments(text: string): string[] {
  return text.match(HAN_FRAGMENT_RE)?.map((t) => t.toLowerCase()) ?? []
}

function extractAssociationSearchTokens(text: string): string[] {
  return [...extractAssociationEnglishTokens(text), ...extractAssociationHanFragments(text)]
}

export function normalizeSearchQuery(raw: string): string {
  return raw.trim().toLowerCase()
}

/** 笔记本体搜索：只匹配词条和释义，扩展字段由 association 结果单独呈现 */
export function noteMatchesPrimarySearch(note: Note, rawQuery: string): boolean {
  const query = normalizeSearchQuery(rawQuery)
  if (!query) return true
  return primaryMatches(note, query)
}

function sliceMatchesQuery(slice: string, normalizedQuery: string): boolean {
  return slice.trim().toLowerCase().includes(normalizedQuery)
}

function getNotePrimarySearchSlices(note: Note): string[] {
  return [
    note.content,
    note.translation,
  ].filter(Boolean)
}

export function buildSearchModalResults(notes: Note[], rawQuery: string): SearchModalResult[] {
  const query = normalizeSearchQuery(rawQuery)
  if (!query) {
    return notes.slice(0, 6).map((note) => ({
      kind: 'note',
      id: note.id,
      note,
    }))
  }

  const noteResults = notes
    .filter((note) => primaryMatches(note, query))
    .map((note) => ({
      kind: 'note' as const,
      id: note.id,
      note,
    }))

  const associationResults = notes.flatMap((note) => {
    const rows = Array.from(new Set(collectAssociationTokens(note)))
      .filter((token) => token.includes(query))
      .map((token) => {
        const title = formatAssociationDisplayTitle(note, token, query)
        return {
          kind: 'association' as const,
          id: `${note.id}::${title}`,
          token: title,
          note,
        }
      })

    const seen = new Set<string>()
    const deduped = rows.filter((row) => {
      const key = `${row.note.id}::${row.token}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    deduped.sort((a, b) => compareAssociationTokens(a.token, b.token, query))
    return deduped
  })

  return [...noteResults, ...associationResults].slice(0, 8)
}

function primaryMatches(note: Note, normalizedQuery: string): boolean {
  return getNotePrimarySearchSlices(note).some((s) => sliceMatchesQuery(s, normalizedQuery))
}

function collectAssociationTokens(note: Note): string[] {
  return collectAssociationTextSources(note).flatMap(extractAssociationSearchTokens)
}

function collectAssociationTextSources(note: Note): string[] {
  const sources: string[] = []

  pushTexts(sources, note.userNotes)
  pushTexts(sources, note.synonyms)
  pushTexts(sources, note.antonyms)
  pushTexts(sources, note.example ? [note.example] : [])
  pushTexts(sources, note.memoryTip ? [note.memoryTip] : [])
  pushTexts(sources, flattenPartsOfSpeech(note.partsOfSpeech))
  pushTexts(sources, flattenConfusables(note.confusables))
  pushTexts(sources, flattenWordFamily(note.wordFamily))

  return sources
}

function pushTexts(target: string[], values: string[] | undefined) {
  if (!values?.length) return
  for (const value of values) {
    const text = value.trim()
    if (!text) continue
    target.push(text)
  }
}

function flattenPartsOfSpeech(partsOfSpeech: PartOfSpeechItem[] | undefined): string[] {
  if (!partsOfSpeech?.length) return []
  return partsOfSpeech.flatMap((item) => [
    item.pos,
    item.label,
    item.meaning,
    item.phonetic ?? '',
    item.example ?? '',
    item.exampleTranslation ?? '',
  ])
}

function flattenConfusables(confusables: ConfusableGroup[] | undefined): string[] {
  if (!confusables?.length) return []

  return confusables.flatMap((group) => {
    const words = group.words.flatMap((word) => [word.word, word.meaning, word.phonetic ?? ''])
    if (group.kind === 'meaning') {
      return [group.difference, ...words]
    }
    return words
  })
}

function flattenWordFamily(wordFamily: WordFamily | undefined): string[] {
  if (!wordFamily) return []

  return [
    ...flattenWordFamilyItems([wordFamily.base]),
    ...Object.values(wordFamily.derivedByPos).flatMap((items) => flattenWordFamilyItems(items)),
    ...flattenWordFamilyItems(wordFamily.rootDerived),
  ]
}

function flattenWordFamilyItems(items: Array<WordFamilyBase | WordFamilyItem>): string[] {
  return items.flatMap((item) => [item.word, item.meaning, item.phonetic ?? ''])
}

function compareAssociationTokens(a: string, b: string, query: string): number {
  const aIndex = a.indexOf(query)
  const bIndex = b.indexOf(query)
  if (aIndex !== bIndex) return aIndex - bIndex
  if (a.length !== b.length) return a.length - b.length
  return a.localeCompare(b)
}

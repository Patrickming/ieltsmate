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

export function extractAssociationEnglishTokens(text: string): string[] {
  return text.match(ENGLISH_TOKEN_RE)?.map((token) => token.toLowerCase()) ?? []
}

export function buildSearchModalResults(notes: Note[], rawQuery: string): SearchModalResult[] {
  const query = rawQuery.trim().toLowerCase()
  if (!query) {
    return notes.slice(0, 6).map((note) => ({
      kind: 'note',
      id: note.id,
      note,
    }))
  }

  const noteResults = notes
    .filter((note) => noteMatchesSearch(note, query))
    .map((note) => ({
      kind: 'note' as const,
      id: note.id,
      note,
    }))

  const associationResults = notes.flatMap((note) =>
    Array.from(new Set(collectAssociationTokens(note)))
      .filter((token) => token.includes(query))
      .sort((a, b) => compareAssociationTokens(a, b, query))
      .map((token) => ({
        kind: 'association' as const,
        id: `${note.id}::${token}`,
        token,
        note,
      })),
  )

  return [...noteResults, ...associationResults].slice(0, 8)
}

function noteMatchesSearch(note: Note, query: string): boolean {
  return (
    note.content.toLowerCase().includes(query) ||
    note.translation.toLowerCase().includes(query)
  )
}

function collectAssociationTokens(note: Note): string[] {
  return collectAssociationTextSources(note).flatMap(extractAssociationEnglishTokens)
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

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
}

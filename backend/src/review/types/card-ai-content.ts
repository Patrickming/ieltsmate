import type { ConfusableGroup, PartOfSpeechItem } from '../../notes/types/note-extensions'
import type { WordFamily } from '../../notes/types/word-family'

export type CardType = 'word-speech' | 'phrase' | 'synonym' | 'sentence' | 'spelling'

const CATEGORY_TO_CARD_TYPE: Record<string, CardType> = {
  口语: 'word-speech',
  单词: 'word-speech',
  短语: 'phrase',
  同义替换: 'synonym',
  句子: 'sentence',
  拼写: 'spelling',
}

export function categoryToCardType(category: string): CardType | null {
  return CATEGORY_TO_CARD_TYPE[category] ?? null
}

export interface AssociationItem {
  word: string
  meaning: string
}

export interface WordSpeechAI {
  fallback: false
  phonetic: string
  synonyms: AssociationItem[]
  antonyms: AssociationItem[]
  example: string
  exampleTranslation?: string
  memoryTip: string
  partsOfSpeech?: PartOfSpeechItem[]
  confusables?: ConfusableGroup[]
  wordFamily?: WordFamily
}

export interface PhraseAI {
  fallback: false
  phonetic: string
  synonyms: AssociationItem[]
  antonyms: AssociationItem[]
  example: string
  exampleTranslation?: string
  memoryTip: string
}

export interface SynonymAI {
  fallback: false
  wordMeanings: Array<{ word: string; phonetic: string; meaning: string }>
  antonymGroup: AssociationItem[]
  moreSynonyms: AssociationItem[]
}

export interface SentenceAI {
  fallback: false
  analysis: string
  paraphrases: Array<{ sentence: string; dimension: string }>
}

export interface SpellingAI {
  fallback: false
  phonetic: string
  synonyms: AssociationItem[]
  antonyms: AssociationItem[]
  memoryTip: string
  contextExample: { sentence: string; analysis: string; translation?: string }
  partsOfSpeech?: PartOfSpeechItem[]
  confusables?: ConfusableGroup[]
  wordFamily?: WordFamily
}

export interface FallbackResponse {
  fallback: true
  phonetic: string | null
  translation: string
  synonyms: string[]
  antonyms: string[]
  example: string | null
  memoryTip: string | null
}

export type CardAIContent =
  | WordSpeechAI
  | PhraseAI
  | SynonymAI
  | SentenceAI
  | SpellingAI
  | FallbackResponse

export const CARD_TYPES = ['word-speech', 'phrase', 'synonym', 'sentence', 'spelling'] as const

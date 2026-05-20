export type PronunciationAccent = 'uk' | 'us' | 'other'

export interface WordPronunciationDto {
  word: string
  phonetic: string | null
  audioUrl: string | null
  accent: PronunciationAccent | null
  source: 'freedictionaryapi.com' | 'dictionaryapi.dev'
}

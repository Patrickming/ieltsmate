/** 与后端 `note-extensions` / DTO 对齐 */

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

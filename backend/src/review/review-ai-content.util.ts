import {
  normalizeConfusableGroups,
  normalizePartOfSpeechList,
} from '../notes/types/note-extensions'
import { normalizeWordFamily } from '../notes/types/word-family'
import type {
  CardAIContent,
  CardType,
  PhraseAI,
  SentenceAI,
  SpellingAI,
  SynonymAI,
  WordSpeechAI,
} from './types/card-ai-content'

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((i) => typeof i === 'string')
}

function cleanOptionalString(x: unknown): string | undefined {
  if (typeof x !== 'string') {
    return undefined
  }
  const cleaned = x.trim()
  return cleaned ? cleaned : undefined
}

function parseWordSpeechPayload(p: Record<string, unknown>): WordSpeechAI | null {
  if (typeof p.phonetic !== 'string') {
    return null
  }
  if (!isStringArray(p.synonyms) || !isStringArray(p.antonyms)) {
    return null
  }
  if (typeof p.example !== 'string' || typeof p.memoryTip !== 'string') {
    return null
  }
  const parts = normalizePartOfSpeechList(p.partsOfSpeech)
  const conf = normalizeConfusableGroups(p.confusables)
  const wf = normalizeWordFamily(p.wordFamily)
  const exampleTranslation = cleanOptionalString(p.exampleTranslation)
  return {
    fallback: false,
    phonetic: p.phonetic,
    synonyms: p.synonyms,
    antonyms: p.antonyms,
    example: p.example,
    ...(exampleTranslation ? { exampleTranslation } : {}),
    memoryTip: p.memoryTip,
    ...(parts.length > 0 ? { partsOfSpeech: parts } : {}),
    ...(conf.length > 0 ? { confusables: conf } : {}),
    ...(wf ? { wordFamily: wf } : {}),
  }
}

function parsePhrasePayload(p: Record<string, unknown>): PhraseAI | null {
  if (typeof p.phonetic !== 'string') {
    return null
  }
  if (!isStringArray(p.synonyms) || !isStringArray(p.antonyms)) {
    return null
  }
  if (typeof p.example !== 'string' || typeof p.memoryTip !== 'string') {
    return null
  }
  const exampleTranslation = cleanOptionalString(p.exampleTranslation)
  return {
    fallback: false,
    phonetic: p.phonetic,
    synonyms: p.synonyms,
    antonyms: p.antonyms,
    example: p.example,
    ...(exampleTranslation ? { exampleTranslation } : {}),
    memoryTip: p.memoryTip,
  }
}

function parseSynonymPayload(p: Record<string, unknown>): SynonymAI | null {
  const wm = p.wordMeanings
  if (!Array.isArray(wm) || wm.length === 0) {
    return null
  }
  const wordMeanings: SynonymAI['wordMeanings'] = []
  for (const row of wm) {
    if (!row || typeof row !== 'object') {
      return null
    }
    const o = row as Record<string, unknown>
    if (
      typeof o.word !== 'string' ||
      typeof o.phonetic !== 'string' ||
      typeof o.meaning !== 'string'
    ) {
      return null
    }
    wordMeanings.push({
      word: o.word,
      phonetic: o.phonetic,
      meaning: o.meaning,
    })
  }
  if (!isStringArray(p.antonymGroup) || !isStringArray(p.moreSynonyms)) {
    return null
  }
  return {
    fallback: false,
    wordMeanings,
    antonymGroup: p.antonymGroup,
    moreSynonyms: p.moreSynonyms,
  }
}

function parseSentencePayload(p: Record<string, unknown>): SentenceAI | null {
  if (typeof p.analysis !== 'string') {
    return null
  }
  const pr = p.paraphrases
  if (!Array.isArray(pr) || pr.length === 0) {
    return null
  }
  const paraphrases: SentenceAI['paraphrases'] = []
  for (const row of pr) {
    if (!row || typeof row !== 'object') {
      return null
    }
    const o = row as Record<string, unknown>
    if (typeof o.sentence !== 'string' || typeof o.dimension !== 'string') {
      return null
    }
    paraphrases.push({ sentence: o.sentence, dimension: o.dimension })
  }
  return {
    fallback: false,
    analysis: p.analysis,
    paraphrases,
  }
}

function parseSpellingPayload(p: Record<string, unknown>): SpellingAI | null {
  if (typeof p.phonetic !== 'string') {
    return null
  }
  if (!isStringArray(p.synonyms) || !isStringArray(p.antonyms)) {
    return null
  }
  if (typeof p.memoryTip !== 'string') {
    return null
  }
  const cx = p.contextExample
  if (!cx || typeof cx !== 'object') {
    return null
  }
  const c = cx as Record<string, unknown>
  if (typeof c.sentence !== 'string' || typeof c.analysis !== 'string') {
    return null
  }
  const contextTranslation = cleanOptionalString(c.translation)
  const parts = normalizePartOfSpeechList(p.partsOfSpeech)
  const conf = normalizeConfusableGroups(p.confusables)
  const wf = normalizeWordFamily(p.wordFamily)
  return {
    fallback: false,
    phonetic: p.phonetic,
    synonyms: p.synonyms,
    antonyms: p.antonyms,
    memoryTip: p.memoryTip,
    contextExample: {
      sentence: c.sentence,
      analysis: c.analysis,
      ...(contextTranslation ? { translation: contextTranslation } : {}),
    },
    ...(parts.length > 0 ? { partsOfSpeech: parts } : {}),
    ...(conf.length > 0 ? { confusables: conf } : {}),
    ...(wf ? { wordFamily: wf } : {}),
  }
}

/**
 * 校验 AI JSON 并（对 word-speech / spelling）注入归一化后的扩展字段。
 * 旧结构缺少扩展字段时仍可通过；核心字段不合法时返回 null。
 */
export function parseReviewAiPayload(
  payload: unknown,
  cardType: CardType,
): CardAIContent | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const p = payload as Record<string, unknown>
  if (p.fallback !== false) {
    return null
  }

  switch (cardType) {
    case 'word-speech':
      return parseWordSpeechPayload(p)
    case 'phrase':
      return parsePhrasePayload(p)
    case 'synonym':
      return parseSynonymPayload(p)
    case 'sentence':
      return parseSentencePayload(p)
    case 'spelling':
      return parseSpellingPayload(p)
    default:
      return null
  }
}

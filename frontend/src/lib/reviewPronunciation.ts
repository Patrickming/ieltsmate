import type { Category } from '@/data/mockData'

export type ReviewCardType =
  | 'word-speech'
  | 'phrase'
  | 'synonym'
  | 'sentence'
  | 'spelling'

/** 仅「拼写」「单词」复习卡展示词典音标与发音 */
export function showsReviewDictionaryPronunciation(
  category: Category,
  cardType?: ReviewCardType,
): boolean {
  if (cardType === 'spelling' || category === '拼写') return true
  if (category === '单词') return true
  return false
}

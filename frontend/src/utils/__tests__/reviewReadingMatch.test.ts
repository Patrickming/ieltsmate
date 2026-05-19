import { describe, expect, it } from 'vitest'
import { findExpressionMatches } from '@/utils/reviewReadingMatch'

describe('reviewReadingMatch', () => {
  it('matches whole words only', () => {
    const text = 'It was a vast landscape as far as the eye could see.'
    expect(findExpressionMatches(text, 'as').map((item) => item.text)).toEqual(['as', 'as'])
    expect(findExpressionMatches(text, 'was').map((item) => item.text)).toEqual(['was'])
  })
})

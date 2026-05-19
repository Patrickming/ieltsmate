import {
  countEnglishWords,
  hasChineseText,
  inferUsedNotesFromArticle,
  parseParagraphTranslationsPayload,
  parseReadingArticlePayload,
} from '../src/review/review-reading-content.util'

describe('review-reading-content util', () => {
  it('parses fenced reading article JSON without used note metadata', () => {
    const parsed = parseReadingArticlePayload(`before
\`\`\`json
{
  "title": "Academic Mobility",
  "article": "Academic mobility shapes research communities.",
  "paragraphTranslations": ["学术流动塑造研究共同体。"]
}
\`\`\``)

    expect(parsed).not.toBeNull()
    expect(parsed?.title).toBe('Academic Mobility')
    expect(parsed?.wordCount).toBe(5)
    expect(parsed?.usedNotes).toEqual([])
    expect(hasChineseText(parsed?.paragraphTranslations[0] ?? '')).toBe(true)
  })

  it('accepts payloads without used notes', () => {
    const parsed = parseReadingArticlePayload(JSON.stringify({
      title: 'No Notes',
      article: 'A short article.',
      paragraphTranslations: ['短文章。'],
    }))

    expect(parsed).not.toBeNull()
    expect(parsed?.usedNotes).toEqual([])
  })

  it('parses paragraph translation payloads', () => {
    expect(parseParagraphTranslationsPayload(JSON.stringify({
      paragraphTranslations: ['第一段', '第二段'],
    }))).toEqual(['第一段', '第二段'])
  })

  it('does not match short expressions inside longer words', () => {
    const article = 'It was a vast landscape as far as the eye could see.'
    const used = inferUsedNotesFromArticle([
      { id: 'as-note', content: 'as' },
    ], article)
    expect(used).toEqual([
      expect.objectContaining({ noteId: 'as-note', expression: 'as', isVariant: false }),
    ])
  })

  it('matches synonym pair variants instead of copying the raw note text', () => {
    const article = 'The process looked easy on paper, though preparation was concerned with details.'
    const used = inferUsedNotesFromArticle([
      { id: 'syn-note', content: 'straightforward = easy' },
    ], article)
    expect(used).toEqual([
      expect.objectContaining({
        noteId: 'syn-note',
        original: 'straightforward = easy',
        expression: 'easy',
        isVariant: true,
      }),
    ])
  })

  it('counts common English word forms', () => {
    expect(countEnglishWords("Researchers' long-term, evidence-based work can't stop.")).toBe(6)
  })
})

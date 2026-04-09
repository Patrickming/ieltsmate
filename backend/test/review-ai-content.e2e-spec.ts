import 'reflect-metadata'
import {
  normalizeConfusableGroups,
  normalizePartOfSpeechList,
} from '../src/notes/types/note-extensions'
import { parseReviewAiPayload } from '../src/review/review-ai-content.util'
import { ReviewAiService } from '../src/review/review-ai.service'

describe('review-ai-content util', () => {
  it('normalizePartOfSpeechList 按 pos+meaning 去重', () => {
    const out = normalizePartOfSpeechList([
      {
        pos: 'n.',
        label: '名词',
        meaning: '测试',
        phonetic: ' /test/ ',
        example: ' sample ',
        exampleTranslation: ' 示例 ',
      },
      { pos: 'N.', label: '名', meaning: '测试' },
      { pos: 'v.', label: '动', meaning: '跑' },
    ])
    expect(out).toHaveLength(2)
    expect(out.map((x) => x.pos)).toEqual(['n.', 'v.'])
    expect(out[0]).toMatchObject({
      phonetic: '/test/',
      example: 'sample',
      exampleTranslation: '示例',
    })
  })

  it('normalizeConfusableGroups 过滤 kind=meaning 且 difference 为空', () => {
    const out = normalizeConfusableGroups([
      {
        kind: 'meaning',
        difference: '',
        words: [
          { word: 'a', meaning: '1' },
          { word: 'b', meaning: '2' },
        ],
      },
      {
        kind: 'meaning',
        difference: 'ok',
        words: [
          { word: 'a', meaning: '1', phonetic: ' /eɪ/ ' },
          { word: 'b', meaning: '2' },
        ],
      },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('meaning')
    if (out[0].kind === 'meaning') {
      expect(out[0].difference).toBe('ok')
      expect(out[0].words[0].phonetic).toBe('/eɪ/')
    }
  })

  it('normalizeConfusableGroups kind=meaning 去重键包含 difference', () => {
    const out = normalizeConfusableGroups([
      {
        kind: 'meaning',
        difference: '差异A',
        words: [
          { word: 'a', meaning: '1' },
          { word: 'b', meaning: '2' },
        ],
      },
      {
        kind: 'meaning',
        difference: '差异B',
        words: [
          { word: 'b', meaning: '2' },
          { word: 'a', meaning: '1' },
        ],
      },
    ])
    expect(out).toHaveLength(2)
  })

  it('parseReviewAiPayload word-speech 兼容无扩展字段的旧结构', () => {
    const payload = {
      fallback: false,
      phonetic: '/tɛst/',
      synonyms: ['a'],
      antonyms: ['b'],
      example: 'ex',
      memoryTip: 'tip',
    }
    const r = parseReviewAiPayload(payload, 'word-speech')
    expect(r).not.toBeNull()
    expect(r && 'partsOfSpeech' in r ? (r as { partsOfSpeech?: unknown }).partsOfSpeech : undefined).toBeUndefined()
    expect(r && 'confusables' in r ? (r as { confusables?: unknown }).confusables : undefined).toBeUndefined()
  })

  it('parseReviewAiPayload word-speech 提取并归一化扩展字段', () => {
    const payload = {
      fallback: false,
      phonetic: '/tɛst/',
      synonyms: ['a'],
      antonyms: ['b'],
      example: 'ex',
      exampleTranslation: ' 例句译文 ',
      memoryTip: 'tip',
      partsOfSpeech: [
        {
          pos: 'n.',
          label: '名',
          meaning: '义',
          phonetic: ' /n/ ',
          example: ' ex ',
          exampleTranslation: ' 例 ',
        },
        { pos: 'n.', label: '名', meaning: '义' },
      ],
      confusables: [
        {
          kind: 'form',
          words: [
            { word: 'w1', meaning: 'm1', phonetic: ' /w1/ ' },
            { word: 'w2', meaning: 'm2' },
          ],
        },
      ],
    }
    const r = parseReviewAiPayload(payload, 'word-speech')
    expect(r).not.toBeNull()
    if (r && 'partsOfSpeech' in r) {
      expect(r.partsOfSpeech).toHaveLength(1)
      expect(r.partsOfSpeech?.[0]).toMatchObject({
        phonetic: '/n/',
        example: 'ex',
        exampleTranslation: '例',
      })
    }
    if (r && 'confusables' in r) {
      expect(r.confusables).toHaveLength(1)
      expect(r.confusables?.[0].words[0]).toMatchObject({ phonetic: '/w1/' })
    }
    if (r && 'exampleTranslation' in r) {
      expect(r.exampleTranslation).toBe('例句译文')
    }
  })

  it('parseReviewAiPayload phrase 保留 exampleTranslation', () => {
    const payload = {
      fallback: false,
      phonetic: '/frɛɪz/',
      synonyms: ['s1'],
      antonyms: ['a1'],
      example: 'phrase example',
      exampleTranslation: ' 短语例句译文 ',
      memoryTip: 'tip',
    }
    const r = parseReviewAiPayload(payload, 'phrase')
    expect(r).not.toBeNull()
    if (r && 'exampleTranslation' in r) {
      expect(r.exampleTranslation).toBe('短语例句译文')
    }
  })

  it('parseReviewAiPayload spelling 提取 contextExample 与扩展字段', () => {
    const payload = {
      fallback: false,
      phonetic: '/t/',
      synonyms: ['s'],
      antonyms: ['a'],
      memoryTip: 'm',
      contextExample: { sentence: 'S.', analysis: 'A.', translation: ' 译文 ' },
      partsOfSpeech: [{ pos: 'n.', label: '名', meaning: '义' }],
      confusables: [
        {
          kind: 'meaning',
          difference: 'd',
          words: [
            { word: 'x', meaning: '1', phonetic: ' /x/ ' },
            { word: 'y', meaning: '2' },
          ],
        },
      ],
    }
    const r = parseReviewAiPayload(payload, 'spelling')
    expect(r).not.toBeNull()
    if (r && 'contextExample' in r && r) {
      expect(r.contextExample).toEqual({ sentence: 'S.', analysis: 'A.', translation: '译文' })
    }
    if (r && 'confusables' in r) {
      expect(r.confusables?.[0].words[0]).toMatchObject({ phonetic: '/x/' })
    }
  })

  it('parseReviewAiPayload spelling 兼容无扩展字段的旧结构', () => {
    const payload = {
      fallback: false,
      phonetic: '/t/',
      synonyms: ['s'],
      antonyms: ['a'],
      memoryTip: 'm',
      contextExample: { sentence: 'S.', analysis: 'A.' },
    }
    const r = parseReviewAiPayload(payload, 'spelling')
    expect(r).not.toBeNull()
    if (r && 'contextExample' in r) {
      expect(r.contextExample).toEqual({ sentence: 'S.', analysis: 'A.' })
    }
    expect(
      r && 'partsOfSpeech' in r ? (r as { partsOfSpeech?: unknown }).partsOfSpeech : undefined,
    ).toBeUndefined()
    expect(r && 'confusables' in r ? (r as { confusables?: unknown }).confusables : undefined).toBeUndefined()
  })

  it('parseAIResponse 能从混杂文本中提取首个平衡 JSON 对象', () => {
    const service = new ReviewAiService({} as never, {} as never)
    const content = [
      '这里是前置说明，不是 JSON。',
      '以下是结果：',
      '{"fallback":false,"phonetic":"/t/","synonyms":["s"],"antonyms":["a"],"example":"ex","exampleTranslation":"译文","memoryTip":"tip","note":"text with braces {ok} and escaped quote \\"yes\\""}',
      '后面还有别的文本 {not-json',
    ].join('\n')

    const parsed = (service as unknown as { parseAIResponse: (...args: unknown[]) => unknown }).parseAIResponse(
      content,
      'word-speech',
      {
        content: 'c',
        translation: 't',
        phonetic: null,
        synonyms: [],
        antonyms: [],
        example: null,
        memoryTip: null,
      },
    ) as { fallback: boolean; exampleTranslation?: string }

    expect(parsed.fallback).toBe(false)
    expect(parsed.exampleTranslation).toBe('译文')
  })
})

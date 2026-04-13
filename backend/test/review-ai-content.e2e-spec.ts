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

  it('normalizePartOfSpeechList 将词性全称与缩写视为同一别名', () => {
    const out = normalizePartOfSpeechList([
      { pos: 'adjective', label: '形容词', meaning: '受欢迎的' },
      { pos: 'adj.', label: '形', meaning: '受欢迎的' },
      { pos: 'adverb', label: '副词', meaning: '通俗地' },
    ])
    expect(out).toHaveLength(2)
    expect(out.map((x) => x.pos)).toEqual(['adjective', 'adverb'])
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

  it('parseReviewAiPayload word-speech 旧 string[] 同义/反义不再有效', () => {
    const payload = {
      fallback: false,
      phonetic: '/tɛst/',
      synonyms: ['a'],
      antonyms: ['b'],
      example: 'ex',
      memoryTip: 'tip',
    }
    expect(parseReviewAiPayload(payload, 'word-speech')).toBeNull()
  })

  it('parseReviewAiPayload Association meaning 为空字符串时返回 null', () => {
    const payload = {
      fallback: false,
      phonetic: '/tɛst/',
      synonyms: [{ word: 'ok', meaning: '有' }],
      antonyms: [{ word: 'x', meaning: '' }],
      example: 'ex',
      memoryTip: 'tip',
    }
    expect(parseReviewAiPayload(payload, 'word-speech')).toBeNull()
  })

  it('parseReviewAiPayload word-speech 可解析 AssociationItem[] 的同义/反义结构', () => {
    const payload = {
      fallback: false,
      phonetic: '/tɛst/',
      synonyms: [
        { word: 'similar', meaning: '近义说明甲' },
        { word: ' alike ', meaning: ' 近义说明乙 ' },
      ],
      antonyms: [{ word: 'opposite', meaning: '反义说明' }],
      example: 'ex',
      memoryTip: 'tip',
    }
    const r = parseReviewAiPayload(payload, 'word-speech')
    expect(r).not.toBeNull()
    if (r && 'synonyms' in r && 'antonyms' in r) {
      expect(r.synonyms).toEqual([
        { word: 'similar', meaning: '近义说明甲' },
        { word: 'alike', meaning: '近义说明乙' },
      ])
      expect(r.antonyms).toEqual([{ word: 'opposite', meaning: '反义说明' }])
    }
  })

  it('parseReviewAiPayload word-speech 提取并归一化扩展字段', () => {
    const payload = {
      fallback: false,
      phonetic: '/tɛst/',
      synonyms: [{ word: 'a', meaning: '同' }],
      antonyms: [{ word: 'b', meaning: '反' }],
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
      synonyms: [{ word: 's1', meaning: '近' }],
      antonyms: [{ word: 'a1', meaning: '反' }],
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
      synonyms: [{ word: 's', meaning: '同' }],
      antonyms: [{ word: 'a', meaning: '反' }],
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

  it('parseReviewAiPayload spelling 旧 string[] 同义/反义不再有效', () => {
    const payload = {
      fallback: false,
      phonetic: '/t/',
      synonyms: ['s'],
      antonyms: ['a'],
      memoryTip: 'm',
      contextExample: { sentence: 'S.', analysis: 'A.' },
    }
    expect(parseReviewAiPayload(payload, 'spelling')).toBeNull()
  })

  it('parseAIResponse 能从混杂文本中提取首个平衡 JSON 对象', () => {
    const service = new ReviewAiService({} as never, {} as never)
    const content = [
      '这里是前置说明，不是 JSON。',
      '以下是结果：',
      '{"fallback":false,"phonetic":"/t/","synonyms":[{"word":"s","meaning":"同"}],"antonyms":[{"word":"a","meaning":"反"}],"example":"ex","exampleTranslation":"译文","memoryTip":"tip","note":"text with braces {ok} and escaped quote \\"yes\\""}',
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

  it('parseAIResponse 会过滤不围绕目标词且拼写不够接近的 confusables', () => {
    const service = new ReviewAiService({} as never, {} as never)
    const content = JSON.stringify({
      fallback: false,
      phonetic: '/lɔːn/',
      synonyms: [
        { word: 'grass', meaning: '草坪' },
        { word: 'meadow', meaning: '草地，牧场' },
      ],
      antonyms: [{ word: 'concrete', meaning: '混凝土地面' }],
      example: 'The lawn looks neat.',
      memoryTip: 'tip',
      confusables: [
        {
          kind: 'form',
          words: [
            { word: 'lorn', meaning: '孤独的' },
            { word: 'laugh', meaning: '笑' },
          ],
        },
        {
          kind: 'form',
          words: [
            { word: 'lawn', meaning: '草坪' },
            { word: 'laugh', meaning: '笑' },
          ],
        },
        {
          kind: 'form',
          words: [
            { word: 'lawn', meaning: '草坪' },
            { word: 'dawn', meaning: '黎明' },
          ],
        },
        {
          kind: 'meaning',
          difference: '都是自然环境相关词',
          words: [
            { word: 'wild', meaning: '野生的' },
            { word: 'grass', meaning: '草' },
          ],
        },
        {
          kind: 'meaning',
          difference: 'lawn 是人工维护的草坪，meadow 是自然生长的草地',
          words: [
            { word: 'lawn', meaning: '草坪' },
            { word: 'meadow', meaning: '草地，牧场' },
          ],
        },
        {
          kind: 'meaning',
          difference: 'lawn 强调修剪整齐的草坪，grassland 更强调大片天然草地',
          words: [
            { word: 'lawn', meaning: '草坪' },
            { word: 'grassland', meaning: '草原' },
          ],
        },
      ],
    })

    const parsed = (service as unknown as { parseAIResponse: (...args: unknown[]) => unknown }).parseAIResponse(
      content,
      'word-speech',
      {
        content: 'lawn',
        translation: '草地',
        phonetic: null,
        synonyms: [],
        antonyms: [],
        example: null,
        memoryTip: null,
      },
    ) as { fallback: boolean; confusables?: Array<{ kind: string; words: Array<{ word: string }> }> }

    expect(parsed.fallback).toBe(false)
    expect(parsed.confusables).toEqual([
      {
        kind: 'form',
        words: [
          { word: 'lawn', meaning: '草坪' },
          { word: 'dawn', meaning: '黎明' },
        ],
      },
      {
        kind: 'meaning',
        words: [
          { word: 'lawn', meaning: '草坪' },
          { word: 'grassland', meaning: '草原' },
        ],
        difference: 'lawn 强调修剪整齐的草坪，grassland 更强调大片天然草地',
      },
    ])
  })

  const stubNote = {
    content: 'test',
    translation: '测试',
    category: 'c',
    phonetic: null as string | null,
    synonyms: [] as string[],
    antonyms: [] as string[],
    example: null as string | null,
    memoryTip: null as string | null,
  }

  it('buildPrompt word-speech 含关联词对象示例与 meaning 约束', () => {
    const service = new ReviewAiService({} as never, {} as never)
    const buildPrompt = (service as unknown as { buildPrompt: (...args: unknown[]) => string }).buildPrompt.bind(service)
    const prompt = buildPrompt(stubNote, 'word-speech')
    expect(prompt).toContain('"synonyms":')
    expect(prompt).toMatch(/\{\s*"word"\s*:/)
    expect(prompt).toMatch(/\{\s*"word"\s*:.*"meaning"\s*:/s)
    expect(prompt).toContain('word 与 meaning 必须非空')
    expect(prompt).toContain('meaning 必须给出具体中文释义')
    expect(prompt).toContain('中文含义”来自用户笔记，可能不准确或词性有误')
    expect(prompt).toContain('wordFamily.base.pos 必须是“目标词本身”的主词性')
    expect(prompt).toContain('rootDerived')
    expect(prompt).toContain('partsOfSpeech 必填')
    expect(prompt).toContain('不要放共享词根的派生词')
    expect(prompt).toContain('derivedByPos 只放词形变化派生')
    expect(prompt).toContain('每个 confusables 分组必须包含目标词本身')
    expect(prompt).toContain('若找不到可靠的 form 类，直接省略 form 组')
    expect(prompt).toContain('只返回 JSON')
  })

  it('buildPrompt synonym 含 antonymGroup/moreSynonyms 对象示例与 meaning 约束', () => {
    const service = new ReviewAiService({} as never, {} as never)
    const buildPrompt = (service as unknown as { buildPrompt: (...args: unknown[]) => string }).buildPrompt.bind(service)
    const prompt = buildPrompt({ ...stubNote, content: 'a, b' }, 'synonym')
    expect(prompt).toContain('"antonymGroup":')
    expect(prompt).toContain('"moreSynonyms":')
    expect(prompt).toMatch(/"antonymGroup"\s*:\s*\[/s)
    expect(prompt).toMatch(/\{\s*"word"\s*:.*"meaning"\s*:/s)
    expect(prompt).toContain('antonymGroup 与 moreSynonyms 须为对象数组')
    expect(prompt).toContain('word 与 meaning 必须非空')
    expect(prompt).toContain('meaning 必须给出具体中文释义')
    expect(prompt).toContain('只返回 JSON')
  })

  it('buildPrompt phrase 含关联词对象示例与 meaning 约束', () => {
    const service = new ReviewAiService({} as never, {} as never)
    const buildPrompt = (service as unknown as { buildPrompt: (...args: unknown[]) => string }).buildPrompt.bind(service)
    const prompt = buildPrompt(stubNote, 'phrase')
    expect(prompt).toContain('"synonyms":')
    expect(prompt).toMatch(/\{\s*"word"\s*:/)
    expect(prompt).toMatch(/\{\s*"word"\s*:.*"meaning"\s*:/s)
    expect(prompt).toContain('word 与 meaning 必须非空')
    expect(prompt).toContain('meaning 必须给出具体中文释义')
    expect(prompt).toContain('中文含义”来自用户笔记，可能不准确或词性有误')
    expect(prompt).toContain('只返回 JSON')
  })

  it('buildPrompt spelling 含关联词对象示例与 meaning 约束', () => {
    const service = new ReviewAiService({} as never, {} as never)
    const buildPrompt = (service as unknown as { buildPrompt: (...args: unknown[]) => string }).buildPrompt.bind(service)
    const prompt = buildPrompt(stubNote, 'spelling')
    expect(prompt).toContain('"synonyms":')
    expect(prompt).toMatch(/\{\s*"word"\s*:/)
    expect(prompt).toMatch(/\{\s*"word"\s*:.*"meaning"\s*:/s)
    expect(prompt).toContain('word 与 meaning 必须非空')
    expect(prompt).toContain('meaning 必须给出具体中文释义')
    expect(prompt).toContain('中文含义”来自用户笔记，可能不准确或词性有误')
    expect(prompt).toContain('rootDerived')
    expect(prompt).toContain('不要放共享词根的派生词')
    expect(prompt).toContain('每个 confusables 分组必须包含目标词本身')
    expect(prompt).toContain('只返回 JSON')
  })
})

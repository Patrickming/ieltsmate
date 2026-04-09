import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import type { ConfusableGroup, PartOfSpeechItem } from '@/types/noteExtensions'
import type { WordFamily } from '@/types/wordFamily'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('useAppStore updateNote extensions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useAppStore.setState({
      notes: [
        {
          id: 'n-ext-1',
          content: 'lead',
          translation: '引导',
          category: '单词',
          subcategory: '杂笔记',
          createdAt: '今天',
          reviewStatus: 'new',
          synonyms: [],
          antonyms: [],
          reviewCount: 0,
          correctCount: 0,
          wrongCount: 0,
        },
      ],
      notesLoaded: true,
    })
  })

  it('updateNote 可写入 partsOfSpeech', async () => {
    const pos: PartOfSpeechItem[] = [{ pos: 'n.', label: '名', meaning: '示例义', phonetic: '/p/' }]
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.includes('/notes/n-ext-1') && init && (init as RequestInit).method === 'PATCH') {
        const body = JSON.parse((init as RequestInit).body as string) as { partsOfSpeech?: PartOfSpeechItem[] }
        expect(body.partsOfSpeech).toEqual(pos)
        return Promise.resolve(
          jsonResponse({
            data: {
              id: 'n-ext-1',
              content: 'lead',
              translation: '引导',
              category: '单词',
              phonetic: null,
              synonyms: [],
              antonyms: [],
              partsOfSpeech: pos,
              example: null,
              memoryTip: null,
              reviewStatus: 'new',
              reviewCount: 0,
              correctCount: 0,
              wrongCount: 0,
              createdAt: new Date().toISOString(),
            },
          }),
        )
      }
      return Promise.resolve(new Response('', { status: 404 }))
    })

    const ok = await useAppStore.getState().updateNote('n-ext-1', { partsOfSpeech: pos })
    expect(ok).toBe(true)
    expect(fetchMock).toHaveBeenCalled()
    const updated = useAppStore.getState().notes.find((n) => n.id === 'n-ext-1')
    expect(updated?.partsOfSpeech).toEqual(pos)
  })

  it('updateNote 可写入 confusables', async () => {
    const conf: ConfusableGroup[] = [
      {
        kind: 'form',
        words: [
          { word: 'affect', meaning: '影响' },
          { word: 'effect', meaning: '效果' },
        ],
      },
    ]
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.includes('/notes/n-ext-1') && init && (init as RequestInit).method === 'PATCH') {
        const body = JSON.parse((init as RequestInit).body as string) as { confusables?: ConfusableGroup[] }
        expect(body.confusables).toEqual(conf)
        return Promise.resolve(
          jsonResponse({
            data: {
              id: 'n-ext-1',
              content: 'lead',
              translation: '引导',
              category: '单词',
              phonetic: null,
              synonyms: [],
              antonyms: [],
              confusables: conf,
              example: null,
              memoryTip: null,
              reviewStatus: 'new',
              reviewCount: 0,
              correctCount: 0,
              wrongCount: 0,
              createdAt: new Date().toISOString(),
            },
          }),
        )
      }
      return Promise.resolve(new Response('', { status: 404 }))
    })

    const ok = await useAppStore.getState().updateNote('n-ext-1', { confusables: conf })
    expect(ok).toBe(true)
    expect(fetchMock).toHaveBeenCalled()
    const updated = useAppStore.getState().notes.find((n) => n.id === 'n-ext-1')
    expect(updated?.confusables).toEqual(conf)
  })

  it('updateNote 可写入 wordFamily', async () => {
    const wf: WordFamily = {
      base: { word: 'lead', pos: 'verb', meaning: '引导' },
      derivedByPos: {
        noun: [{ word: 'leader', pos: 'noun', meaning: '领导者', phonetic: '/ˈliːdə/' }],
        verb: [],
        adjective: [],
        adverb: [],
      },
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.includes('/notes/n-ext-1') && init && (init as RequestInit).method === 'PATCH') {
        const body = JSON.parse((init as RequestInit).body as string) as { wordFamily?: WordFamily }
        expect(body.wordFamily).toEqual(wf)
        return Promise.resolve(
          jsonResponse({
            data: {
              id: 'n-ext-1',
              content: 'lead',
              translation: '引导',
              category: '单词',
              phonetic: null,
              synonyms: [],
              antonyms: [],
              wordFamily: wf,
              example: null,
              memoryTip: null,
              reviewStatus: 'new',
              reviewCount: 0,
              correctCount: 0,
              wrongCount: 0,
              createdAt: new Date().toISOString(),
            },
          }),
        )
      }
      return Promise.resolve(new Response('', { status: 404 }))
    })

    const ok = await useAppStore.getState().updateNote('n-ext-1', { wordFamily: wf })
    expect(ok).toBe(true)
    expect(fetchMock).toHaveBeenCalled()
    const updated = useAppStore.getState().notes.find((n) => n.id === 'n-ext-1')
    expect(updated?.wordFamily).toEqual(wf)
  })

  it('loadNotes 遇到脏 wordFamily 也可安全归一', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/notes')) {
        return Promise.resolve(
          jsonResponse({
            data: {
              items: [
                {
                  id: 'n-dirty',
                  content: 'lead',
                  translation: '引导',
                  category: '单词',
                  phonetic: null,
                  synonyms: [],
                  antonyms: [],
                  wordFamily: {
                    base: { word: ' lead ', pos: 'weird-pos', meaning: ' 引导 ' },
                    derivedByPos: {
                      noun: { bad: true },
                      verb: [
                        { word: 'leader', pos: 'noun', meaning: '应被过滤' },
                        { word: 'lead', pos: 'verb', meaning: ' 带领 ' },
                      ],
                      adjective: null,
                    },
                  },
                  example: null,
                  memoryTip: null,
                  reviewStatus: 'new',
                  reviewCount: 0,
                  correctCount: 0,
                  wrongCount: 0,
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          }),
        )
      }
      return Promise.resolve(new Response('', { status: 404 }))
    })

    await expect(useAppStore.getState().loadNotes()).resolves.toBeUndefined()
    const updated = useAppStore.getState().notes.find((n) => n.id === 'n-dirty')
    expect(updated?.wordFamily).toBeDefined()
    expect(updated?.wordFamily?.base).toEqual({
      word: 'lead',
      pos: 'other',
      meaning: '引导',
    })
    expect(updated?.wordFamily?.derivedByPos.noun).toEqual([])
    expect(updated?.wordFamily?.derivedByPos.adjective).toEqual([])
    expect(updated?.wordFamily?.derivedByPos.adverb).toEqual([])
    expect(updated?.wordFamily?.derivedByPos.verb).toEqual([
      { word: 'lead', pos: 'verb', meaning: '带领', phonetic: '' },
    ])
  })

  it('loadNotes 遇到脏 partsOfSpeech/confusables 也可安全归一', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/notes')) {
        return Promise.resolve(
          jsonResponse({
            data: {
              items: [
                {
                  id: 'n-dirty-ext',
                  content: 'hostel',
                  translation: '旅舍',
                  category: '单词',
                  phonetic: null,
                  synonyms: [],
                  antonyms: [],
                  partsOfSpeech: [
                    { pos: ' n. ', label: ' 名 ', meaning: ' 旅舍 ' },
                    { pos: 'n.', label: '', meaning: '空标签应过滤' },
                    null,
                  ],
                  confusables: [
                    {
                      kind: 'meaning',
                      difference: ' 词义区别 ',
                      words: [
                        { word: 'hostel', meaning: '旅舍' },
                        { word: 'hotel', meaning: '酒店' },
                      ],
                    },
                    {
                      kind: 'meaning',
                      difference: '',
                      words: [
                        { word: 'a', meaning: 'a' },
                        { word: 'b', meaning: 'b' },
                      ],
                    },
                    { kind: 'form', words: [{ word: 'x', meaning: 'x' }] },
                  ],
                  example: null,
                  memoryTip: null,
                  reviewStatus: 'new',
                  reviewCount: 0,
                  correctCount: 0,
                  wrongCount: 0,
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          }),
        )
      }
      return Promise.resolve(new Response('', { status: 404 }))
    })

    await expect(useAppStore.getState().loadNotes()).resolves.toBeUndefined()
    const updated = useAppStore.getState().notes.find((n) => n.id === 'n-dirty-ext')
    expect(updated?.partsOfSpeech).toEqual([
      { pos: 'n.', label: '名', meaning: '旅舍' },
    ])
    expect(updated?.confusables).toEqual([
      {
        kind: 'meaning',
        difference: '词义区别',
        words: [
          { word: 'hostel', meaning: '旅舍' },
          { word: 'hotel', meaning: '酒店' },
        ],
      },
    ])
  })
})

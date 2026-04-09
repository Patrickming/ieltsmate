import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store/useAppStore'
import type { ConfusableGroup, PartOfSpeechItem } from '@/types/noteExtensions'

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
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/render'
import ReviewCards from '@/pages/ReviewCards'
import { useAppStore } from '@/store/useAppStore'

type TestCardAIContent = {
  fallback: boolean
  [key: string]: unknown
}

type UpdateNoteFn = ReturnType<typeof useAppStore.getState>['updateNote']

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => routerMocks.navigate,
  }
})

function createFetchResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

type CardCategory = '单词' | '短语' | '拼写'

function seedReviewState(updateNoteMock: ReturnType<typeof vi.fn>, opts?: {
  category?: CardCategory
  content?: string
  aiContent?: TestCardAIContent
}) {
  const category = opts?.category ?? '单词'
  const content = opts?.content ?? (category === '短语' ? 'take off' : category === '拼写' ? 'accommodate' : 'hostel')
  const translation = category === '短语' ? '起飞；脱下' : category === '拼写' ? '容纳' : '旅舍'
  const defaultAI: TestCardAIContent = category === '拼写'
    ? {
      fallback: false,
      phonetic: '/əˈkɒmədeɪt/',
      synonyms: [],
      antonyms: [],
      memoryTip: '双 m 双 c',
      contextExample: { sentence: 'The hotel can accommodate 200 guests.', analysis: '表示容纳' },
      partsOfSpeech: [{ pos: 'v.', label: '动', meaning: '容纳；提供住宿' }],
      confusables: [{ kind: 'form', words: [{ word: 'accommodate', meaning: '容纳' }, { word: 'accomodate', meaning: '常见拼写错误' }] }],
    }
    : category === '短语'
      ? {
        fallback: false,
        phonetic: '/teɪk ɒf/',
        synonyms: [{ word: 'depart', meaning: '离开' }],
        antonyms: [],
        example: 'The plane takes off at six.',
        memoryTip: '短语记忆',
      }
      : {
        fallback: false,
        phonetic: '/ˈhɒstl/',
        synonyms: [],
        antonyms: [],
        example: 'We stayed at a hostel.',
        exampleTranslation: '我们住在旅舍。',
        memoryTip: '联想 hotel',
        partsOfSpeech: [{ pos: 'n.', label: '名', meaning: '青年旅舍', phonetic: '/ˈhɒstl/' }],
        confusables: [
          {
            kind: 'meaning' as const,
            difference: '第一组区别说明完整展示',
            words: [
              { word: 'hostel', meaning: '旅舍', phonetic: '/h/' },
              { word: 'hotel', meaning: '酒店', phonetic: '/hoʊˈtel/' },
            ],
          },
          {
            kind: 'form' as const,
            words: [
              { word: 'affect', meaning: '影响' },
              { word: 'effect', meaning: '效果' },
            ],
          },
        ],
      }

  useAppStore.setState({
    notes: [
      {
        id: 'n-1',
        content,
        translation,
        category,
        subcategory: '杂笔记',
        createdAt: '今天',
        reviewStatus: 'new',
        reviewCount: 0,
        correctCount: 0,
        wrongCount: 0,
        synonyms: [],
        antonyms: [],
      },
    ],
    reviewSession: {
      sessionId: 's-1',
      cards: [
        {
          id: 'n-1',
          content,
          translation,
          category,
          subcategory: '杂笔记',
          createdAt: '今天',
          reviewStatus: 'new',
          reviewCount: 0,
          correctCount: 0,
          wrongCount: 0,
        },
      ],
      current: 0,
      results: [],
      params: { source: 'notes', range: 'all', mode: 'random', order: 'random' },
      aiContent: { 'n-1': opts?.aiContent ?? defaultAI },
      aiLoading: {},
      savedExtensionCount: 0,
      completedOffset: 0,
    },
    rateCard: vi.fn(),
    nextCard: vi.fn(),
    abortReviewSession: vi.fn().mockResolvedValue(undefined),
    incrementSavedExtensions: vi.fn(),
    retryAIContent: vi.fn(),
    updateNote: updateNoteMock as UpdateNoteFn,
    markNoteMastered: vi.fn().mockResolvedValue(true),
  })
}

describe('ReviewCards 词性与易混扩展', () => {
  const updateNoteMock = vi.fn<UpdateNoteFn>().mockResolvedValue(true)

  beforeEach(() => {
    routerMocks.navigate.mockReset()
    updateNoteMock.mockReset()
    updateNoteMock.mockResolvedValue(true)
    vi.restoreAllMocks()
    seedReviewState(updateNoteMock)
  })

  it('翻面后可切换到「易混小词」并全量展示 confusables', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createFetchResponse({ data: { items: [] } }),
    )

    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('hostel'))
    await user.click(screen.getByTestId('review-back-tab-pos-confusable'))

    expect(screen.getByText('第一组区别说明完整展示')).toBeInTheDocument()
    expect(screen.getByText('hotel')).toBeInTheDocument()
    expect(screen.getByText('/hoʊˈtel/')).toBeInTheDocument()
    expect(screen.getByTestId('review-back-tab-pos-confusable')).toHaveTextContent('易混淆词')
    expect(screen.getByText('义近易混')).toBeInTheDocument()
    expect(screen.getByText('形近 / 拼写易混')).toBeInTheDocument()
    expect(screen.getByText('affect')).toBeInTheDocument()
    expect(screen.getByText('effect')).toBeInTheDocument()
  })

  it('词性块从右侧移动到左侧词性派生页', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createFetchResponse({ data: { items: [] } }),
    )
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('hostel'))
    await user.click(screen.getByTestId('review-back-tab-word-family'))
    expect(screen.getByText('词性')).toBeInTheDocument()
    expect(screen.getByTestId('review-pos-save-0')).toBeInTheDocument()

    await user.click(screen.getByTestId('review-back-tab-pos-confusable'))
    expect(screen.queryByText('词性')).not.toBeInTheDocument()
    expect(screen.queryByTestId('review-pos-save-0')).not.toBeInTheDocument()
  })

  it('同词组同时命中形近和义近时，两个分区都显示「形近+义近」标识', async () => {
    seedReviewState(updateNoteMock, {
      aiContent: {
        fallback: false,
        phonetic: '/əˈfekt/',
        synonyms: [],
        antonyms: [],
        example: 'The policy will affect prices.',
        memoryTip: '区分词性和语义',
        partsOfSpeech: [],
        confusables: [
          {
            kind: 'form',
            words: [
              { word: 'affect', meaning: '影响' },
              { word: 'effect', meaning: '效果' },
            ],
          },
          {
            kind: 'meaning',
            difference: 'affect 常作动词；effect 常作名词',
            words: [
              { word: 'affect', meaning: '影响' },
              { word: 'effect', meaning: '效果' },
            ],
          },
        ],
      },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('hostel'))
    await user.click(screen.getByTestId('review-back-tab-pos-confusable'))

    expect(screen.getByText('形近 / 拼写易混')).toBeInTheDocument()
    expect(screen.getByText('义近易混')).toBeInTheDocument()
    expect(screen.getAllByText('形近+义近')).toHaveLength(2)
  })

  it('切换到扩展视图后评分按钮仍可见', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createFetchResponse({ data: { items: [] } }),
    )

    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('hostel'))
    await user.click(screen.getByTestId('review-back-tab-pos-confusable'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '😊 记得' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '😞 不记得' })).toBeInTheDocument()
  })

  it('点击词性派生页中的词性「存入」会调用 updateNote 写入 partsOfSpeech', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createFetchResponse({ data: { items: [] } }),
    )

    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('hostel'))
    await user.click(screen.getByTestId('review-back-tab-word-family'))

    await user.click(screen.getByTestId('review-pos-save-0'))

    await waitFor(() => {
      expect(updateNoteMock).toHaveBeenCalled()
    })
    const call = updateNoteMock.mock.calls.find((c) => c[0] === 'n-1' && c[1]?.partsOfSpeech)
    expect(call).toBeDefined()
    expect(call?.[1].partsOfSpeech).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pos: 'n.', label: '名', meaning: '青年旅舍' }),
      ]),
    )
  })

  it('非 word-speech/spelling（phrase）不显示「词性&易混淆」切换', async () => {
    seedReviewState(updateNoteMock, { category: '短语' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('take off'))
    expect(screen.queryByTestId('review-back-tab-pos-confusable')).not.toBeInTheDocument()
    expect(screen.getByText('💬 例句')).toBeInTheDocument()
  })

  it('新字段为空时仍显示背面三栏切换且默认落在学习内容', async () => {
    seedReviewState(updateNoteMock, {
      aiContent: {
        fallback: false,
        phonetic: '/ˈhɒstl/',
        synonyms: [],
        antonyms: [],
        example: 'We stayed at a hostel.',
        memoryTip: '联想 hotel',
        partsOfSpeech: [],
        confusables: [],
      },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('hostel'))
    expect(screen.getByTestId('review-back-tab-word-family')).toBeInTheDocument()
    expect(screen.getByTestId('review-back-tab-pos-confusable')).toBeInTheDocument()
    expect(screen.getByText('💬 例句')).toBeInTheDocument()
  })

  it('点击易混淆「存入」会调用 updateNote 写入 confusables', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('hostel'))
    await user.click(screen.getByTestId('review-back-tab-pos-confusable'))
    await user.click(screen.getByTestId('review-conf-save-0'))

    await waitFor(() => {
      expect(updateNoteMock).toHaveBeenCalled()
    })
    const call = updateNoteMock.mock.calls.find((c) => c[0] === 'n-1' && c[1]?.confusables)
    expect(call).toBeDefined()
    expect(call?.[1].confusables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'meaning' }),
      ]),
    )
  })

  it('spelling 卡片可显示切换并渲染新视图', async () => {
    seedReviewState(updateNoteMock, { category: '拼写' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('拼写挑战'))
    expect(screen.getByTestId('review-back-tab-pos-confusable')).toBeInTheDocument()
    await user.click(screen.getByTestId('review-back-tab-pos-confusable'))

    expect(screen.queryByText('义近易混')).not.toBeInTheDocument()
    expect(screen.getByText('形近 / 拼写易混')).toBeInTheDocument()
    expect(screen.getByText('accomodate')).toBeInTheDocument()
  })

  it('易混淆保存失败后提示并可重试成功', async () => {
    updateNoteMock
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('hostel'))
    await user.click(screen.getByTestId('review-back-tab-pos-confusable'))
    await user.click(screen.getByTestId('review-conf-save-0'))

    expect(await screen.findByRole('status')).toHaveTextContent('保存失败，可重试')

    await user.click(screen.getByTestId('review-conf-save-0'))
    await waitFor(() => {
      expect(updateNoteMock).toHaveBeenCalledTimes(2)
    })
  })

  it('短语：点击同义词「存入」后 updateNote 的 synonyms 含 word (meaning) 格式', async () => {
    seedReviewState(updateNoteMock, {
      category: '短语',
      aiContent: {
        fallback: false,
        phonetic: '/teɪk ɒf/',
        synonyms: [{ word: 'depart', meaning: '离开' }],
        antonyms: [],
        example: 'The plane takes off at six.',
        memoryTip: '短语记忆',
      },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('take off'))
    await user.click(screen.getByRole('button', { name: '存入' }))

    await waitFor(() => {
      expect(updateNoteMock).toHaveBeenCalled()
    })
    const call = updateNoteMock.mock.calls.find((c) => c[0] === 'n-1' && c[1]?.synonyms)
    expect(call?.[1].synonyms).toEqual(expect.arrayContaining(['depart (离开)']))
  })

  it('单词：点击反义词「存入」后 updateNote 的 antonyms 含 word (meaning) 格式', async () => {
    seedReviewState(updateNoteMock, {
      aiContent: {
        fallback: false,
        phonetic: '/ˈhɒstl/',
        synonyms: [],
        antonyms: [{ word: 'hotel', meaning: '酒店' }],
        example: 'We stayed at a hostel.',
        exampleTranslation: '我们住在旅舍。',
        memoryTip: '联想 hotel',
        partsOfSpeech: [{ pos: 'n.', label: '名', meaning: '青年旅舍', phonetic: '/ˈhɒstl/' }],
        confusables: [
          {
            kind: 'meaning' as const,
            difference: '第一组区别说明完整展示',
            words: [
              { word: 'hostel', meaning: '旅舍', phonetic: '/h/' },
              { word: 'hotel', meaning: '酒店', phonetic: '/hoʊˈtel/' },
            ],
          },
        ],
      },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('hostel'))
    const saveButtons = screen.getAllByRole('button', { name: '存入' })
    await user.click(saveButtons[saveButtons.length - 1])

    await waitFor(() => {
      expect(updateNoteMock).toHaveBeenCalled()
    })
    const call = updateNoteMock.mock.calls.find((c) => c[0] === 'n-1' && c[1]?.antonyms)
    expect(call?.[1].antonyms).toEqual(expect.arrayContaining(['hotel (酒店)']))
  })
})

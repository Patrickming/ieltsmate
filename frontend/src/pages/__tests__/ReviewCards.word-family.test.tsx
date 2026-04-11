import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/render'
import ReviewCards from '@/pages/ReviewCards'
import { useAppStore } from '@/store/useAppStore'
import { emptyDerivedByPos } from '@/lib/wordFamilyDedup'
import type { WordFamily } from '@/types/wordFamily'

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

function seedWordFamilyReview(updateNoteMock: ReturnType<typeof vi.fn>, opts?: { category?: '单词' | '拼写' | '口语' }) {
  const category = opts?.category ?? '单词'
  const content = category === '拼写' ? 'popular' : 'popular'
  const translation = '受欢迎的'
  const wf: WordFamily = {
    base: { word: 'popular', pos: 'adjective', meaning: '受欢迎的', phonetic: '/ˈpɒpjələ(r)/' },
    derivedByPos: {
      ...emptyDerivedByPos(),
      noun: [{ word: 'popularity', pos: 'noun', meaning: '普及', phonetic: '/ˌpɒpjuˈlærəti/' }],
      verb: [{ word: 'popularize', pos: 'verb', meaning: '使普及', phonetic: '' }],
    },
    rootDerived: [
      { word: 'populace', pos: 'noun', meaning: '民众，平民', phonetic: '/popjelas/' },
    ],
  }
  const defaultAI =
    category === '拼写'
      ? {
          fallback: false,
          phonetic: '/ˈpɒpjələ(r)/',
          synonyms: [],
          antonyms: [],
          memoryTip: 'tip',
          contextExample: { sentence: 'It is popular.', analysis: '分析' },
          wordFamily: wf,
        }
      : {
          fallback: false,
          phonetic: '/ˈpɒpjələ(r)/',
          synonyms: [],
          antonyms: [],
          example: 'ex',
          memoryTip: 'tip',
          wordFamily: wf,
        }

  useAppStore.setState({
    notes: [
      {
        id: 'n-wf',
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
      sessionId: 's-wf',
      cards: [
        {
          id: 'n-wf',
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
      aiContent: { 'n-wf': defaultAI },
      aiLoading: {},
      savedExtensionCount: 0,
      completedOffset: 0,
    },
    rateCard: vi.fn(),
    nextCard: vi.fn(),
    abortReviewSession: vi.fn().mockResolvedValue(undefined),
    incrementSavedExtensions: vi.fn(),
    retryAIContent: vi.fn(),
    updateNote: updateNoteMock,
    markNoteMastered: vi.fn().mockResolvedValue(true),
  })
}

describe('ReviewCards 词性派生', () => {
  const updateNoteMock = vi.fn().mockResolvedValue(true)

  beforeEach(() => {
    routerMocks.navigate.mockReset()
    updateNoteMock.mockReset()
    updateNoteMock.mockResolvedValue(true)
    vi.restoreAllMocks()
    seedWordFamilyReview(updateNoteMock)
  })

  it('word-speech 可见「词性派生」tab', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('popular'))
    expect(screen.getByTestId('review-back-tab-word-family')).toBeInTheDocument()
    expect(screen.getByTestId('review-back-tab-word-family')).toHaveTextContent('词性&词根派生')
  })

  it('spelling 可见「词性派生」tab', async () => {
    seedWordFamilyReview(updateNoteMock, { category: '拼写' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('拼写挑战'))
    expect(screen.getByTestId('review-back-tab-word-family')).toBeInTheDocument()
    expect(screen.getByTestId('review-back-tab-word-family')).toHaveTextContent('词性&词根派生')
  })

  it('口语卡不显示词性派生 tab', async () => {
    seedWordFamilyReview(updateNoteMock, { category: '口语' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('popular'))
    expect(screen.queryByTestId('review-back-tab-word-family')).not.toBeInTheDocument()
    expect(screen.getByTestId('review-back-tab-pos-confusable')).toBeInTheDocument()
  })

  it('phrase 不显示词性派生 tab', async () => {
    useAppStore.setState({
      notes: [
        {
          id: 'n-ph',
          content: 'take off',
          translation: '起飞',
          category: '短语',
          subcategory: '杂笔记',
          createdAt: '今天',
          reviewStatus: 'new',
          reviewCount: 0,
          correctCount: 0,
          wrongCount: 0,
        },
      ],
      reviewSession: {
        sessionId: 's-ph',
        cards: [
          {
            id: 'n-ph',
            content: 'take off',
            translation: '起飞',
            category: '短语',
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
        aiContent: {
          'n-ph': {
            fallback: false,
            phonetic: '/t/',
            synonyms: [],
            antonyms: [],
            example: 'x',
            memoryTip: 't',
          },
        },
        aiLoading: {},
        savedExtensionCount: 0,
        completedOffset: 0,
      },
      rateCard: vi.fn(),
      nextCard: vi.fn(),
      abortReviewSession: vi.fn().mockResolvedValue(undefined),
      incrementSavedExtensions: vi.fn(),
      retryAIContent: vi.fn(),
      updateNote: updateNoteMock,
      markNoteMastered: vi.fn().mockResolvedValue(true),
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)
    await user.click(screen.getByText('take off'))
    expect(screen.queryByTestId('review-back-tab-word-family')).not.toBeInTheDocument()
  })

  it('空分区显示「无」', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('popular'))
    await user.click(screen.getByTestId('review-back-tab-word-family'))

    expect(screen.queryByText('原始词')).not.toBeInTheDocument()
    expect(screen.queryByText('当前词')).not.toBeInTheDocument()
    expect(screen.getByTestId('review-wf-empty-adjective')).toHaveTextContent('无')
    expect(screen.getByTestId('review-wf-empty-adverb')).toHaveTextContent('无')
  })

  it('词根派生区块渲染 rootDerived 项', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('popular'))
    await user.click(screen.getByTestId('review-back-tab-word-family'))

    expect(screen.getByText('词根派生')).toBeInTheDocument()
    expect(screen.getByText('populace')).toBeInTheDocument()
    expect(screen.getByText('民众，平民')).toBeInTheDocument()
  })

  it('rootDerived 为空时显示无', async () => {
    seedWordFamilyReview(updateNoteMock)
    useAppStore.setState((s) => {
      const session = s.reviewSession
      if (session?.aiContent?.['n-wf']) {
        const ai = session.aiContent['n-wf'] as Record<string, unknown>
        if (ai.wordFamily) {
          (ai.wordFamily as Record<string, unknown>).rootDerived = []
        }
      }
      return { ...s }
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('popular'))
    await user.click(screen.getByTestId('review-back-tab-word-family'))

    expect(screen.getByTestId('review-root-derived-empty')).toHaveTextContent('无')
  })

  it('单条存入触发 updateNote(wordFamily)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('popular'))
    await user.click(screen.getByTestId('review-back-tab-word-family'))
    await user.click(screen.getByTestId('review-wf-save-noun-0'))

    await waitFor(() => {
      expect(updateNoteMock).toHaveBeenCalled()
    })
    const call = updateNoteMock.mock.calls.find((c) => c[0] === 'n-wf' && c[1]?.wordFamily)
    expect(call).toBeDefined()
    expect(call?.[1].wordFamily.derivedByPos.noun).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ word: 'popularity' }),
      ]),
    )
    expect(call?.[1].wordFamily.derivedByPos.verb ?? []).toHaveLength(0)
  })

  it('与当前词同词面的项不显示在派生列表', async () => {
    const wfWithSameSurface: WordFamily = {
      base: { word: 'disperse', pos: 'verb', meaning: '分散', phonetic: '/dɪˈspɜːs/' },
      derivedByPos: {
        ...emptyDerivedByPos(),
        noun: [{ word: 'disperse', pos: 'noun', meaning: '分散', phonetic: '/dɪˈspɜːs/' }],
        adjective: [{ word: 'dispersive', pos: 'adjective', meaning: '分散的', phonetic: '' }],
      },
      rootDerived: [],
    }
    useAppStore.setState((s) => ({
      ...s,
      notes: [
        {
          id: 'n-wf',
          content: 'disperse',
          translation: '分散',
          category: '单词',
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
      reviewSession: s.reviewSession
        ? {
            ...s.reviewSession,
            cards: [{ ...s.reviewSession.cards[0], content: 'disperse', translation: '分散', category: '单词' }],
            aiContent: {
              'n-wf': {
                fallback: false,
                phonetic: '/dɪˈspɜːs/',
                synonyms: [],
                antonyms: [],
                example: 'Particles disperse quickly.',
                memoryTip: 'tip',
                wordFamily: wfWithSameSurface,
              },
            },
          }
        : s.reviewSession,
    }))
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('disperse'))
    await user.click(screen.getByTestId('review-back-tab-word-family'))

    expect(screen.getByTestId('review-wf-empty-noun')).toHaveTextContent('无')
    expect(screen.getByText('dispersive')).toBeInTheDocument()
  })

  it('单条重复项点击会出现“已存在”提示', async () => {
    useAppStore.setState((s) => ({
      ...s,
      notes: [
        {
          id: 'n-wf',
          content: 'popular',
          translation: '受欢迎的',
          category: '单词',
          subcategory: '杂笔记',
          createdAt: '今天',
          reviewStatus: 'new',
          reviewCount: 0,
          correctCount: 0,
          wrongCount: 0,
          synonyms: [],
          antonyms: [],
          wordFamily: {
            base: { word: 'popular', pos: 'other', meaning: '受欢迎的' },
            derivedByPos: {
              ...emptyDerivedByPos(),
              noun: [{ word: 'popularity', pos: 'noun', meaning: '普及', phonetic: '/x/' }],
            },
            rootDerived: [],
          },
        },
      ],
    }))
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('popular'))
    await user.click(screen.getByTestId('review-back-tab-word-family'))
    await user.click(screen.getByTestId('review-wf-save-noun-0'))

    expect(await screen.findByRole('status')).toHaveTextContent('已存在')
  })

  it('一键存入统计新增与重复', async () => {
    useAppStore.setState((s) => ({
      ...s,
      notes: [
        {
          id: 'n-wf',
          content: 'popular',
          translation: '受欢迎的',
          category: '单词',
          subcategory: '杂笔记',
          createdAt: '今天',
          reviewStatus: 'new',
          reviewCount: 0,
          correctCount: 0,
          wrongCount: 0,
          synonyms: [],
          antonyms: [],
          wordFamily: {
            base: { word: 'popular', pos: 'other', meaning: '受欢迎的' },
            derivedByPos: {
              ...emptyDerivedByPos(),
              noun: [{ word: 'popularity', pos: 'noun', meaning: '普及', phonetic: '/x/' }],
            },
            rootDerived: [],
          },
        },
      ],
    }))
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('popular'))
    await user.click(screen.getByTestId('review-back-tab-word-family'))
    await user.click(screen.getByTestId('review-wf-save-all'))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/跳过重复/)
    })
  })

  it('一键失败提示包含失败数量', async () => {
    updateNoteMock.mockResolvedValueOnce(false)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('popular'))
    await user.click(screen.getByTestId('review-back-tab-word-family'))
    await user.click(screen.getByTestId('review-wf-save-all'))

    expect(await screen.findByRole('status')).toHaveTextContent(/失败 \d+ 条/)
  })

  it('学习内容里已存在的同义词应显示为已存入，点击有已存在提示', async () => {
    useAppStore.setState({
      notes: [
        {
          id: 'n-syn',
          content: 'prevalent',
          translation: '普遍的',
          category: '单词',
          subcategory: '杂笔记',
          createdAt: '今天',
          reviewStatus: 'new',
          reviewCount: 0,
          correctCount: 0,
          wrongCount: 0,
          synonyms: ['widespread'],
          antonyms: [],
        },
      ],
      reviewSession: {
        sessionId: 's-syn',
        cards: [
          {
            id: 'n-syn',
            content: 'prevalent',
            translation: '普遍的',
            category: '单词',
            subcategory: '杂笔记',
            createdAt: '今天',
            reviewStatus: 'new',
            reviewCount: 0,
            correctCount: 0,
            wrongCount: 0,
            synonyms: ['widespread'],
            antonyms: [],
          },
        ],
        current: 0,
        results: [],
        params: { source: 'notes', range: 'all', mode: 'random', order: 'random' },
        aiContent: {
          'n-syn': {
            fallback: false,
            phonetic: '/ˈprevələnt/',
            synonyms: [{ word: 'widespread', meaning: '广泛的' }],
            antonyms: [],
            example: 'A prevalent issue in cities.',
            memoryTip: 'tip',
          },
        },
        aiLoading: {},
        savedExtensionCount: 0,
        completedOffset: 0,
      },
      rateCard: vi.fn(),
      nextCard: vi.fn(),
      abortReviewSession: vi.fn().mockResolvedValue(undefined),
      incrementSavedExtensions: vi.fn(),
      retryAIContent: vi.fn(),
      updateNote: updateNoteMock,
      markNoteMastered: vi.fn().mockResolvedValue(true),
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('prevalent'))

    expect(screen.getByText('✓ 已存入')).toBeInTheDocument()
    await user.click(screen.getByText('✓ 已存入'))
    expect(await screen.findByRole('status')).toHaveTextContent('已存在')
  })
})

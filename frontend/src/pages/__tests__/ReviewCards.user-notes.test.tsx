import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/render'
import ReviewCards from '@/pages/ReviewCards'
import { useAppStore } from '@/store/useAppStore'

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

describe('ReviewCards user notes on card back', () => {
  beforeEach(() => {
    routerMocks.navigate.mockReset()
    vi.restoreAllMocks()

    useAppStore.setState({
      reviewSession: {
        sessionId: 's-1',
        cards: [{
          id: 'n-1',
          content: 'hostel',
          translation: '旅舍',
          category: '单词',
          subcategory: '杂笔记',
          createdAt: '今天',
          reviewStatus: 'new',
          reviewCount: 0,
          correctCount: 0,
          wrongCount: 0,
        }],
        current: 0,
        results: [],
        params: { source: 'notes', range: 'all', mode: 'random', order: 'random' },
        skipAi: false,
        aiContent: { 'n-1': { fallback: true } },
        aiLoading: {},
        savedExtensionCount: 0,
        completedOffset: 0,
      },
      rateCard: vi.fn(),
      nextCard: vi.fn(),
      abortReviewSession: vi.fn().mockResolvedValue(undefined),
      incrementSavedExtensions: vi.fn(),
      retryAIContent: vi.fn(),
      updateNote: vi.fn().mockResolvedValue(true),
      markNoteMastered: vi.fn().mockResolvedValue(true),
    })
  })

  it('显示当前卡片的备注', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createFetchResponse({
        data: { items: [{ id: 'u-1', content: '易混词：hotel' }] },
      }),
    )

    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByRole('heading', { name: 'hostel' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    expect(await screen.findByText('我的备注')).toBeInTheDocument()
    expect(screen.getByText('易混词：hotel')).toBeInTheDocument()
  })

  it('无备注时不显示备注区块', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createFetchResponse({
        data: { items: [] },
      }),
    )

    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByRole('heading', { name: 'hostel' }))
    await waitFor(() => {
      expect(screen.queryByText('我的备注')).not.toBeInTheDocument()
    })
  })

  it('备注请求失败时不影响翻卡与评分按钮', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network failed'))

    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByRole('heading', { name: 'hostel' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '😊 记得' })).toBeInTheDocument()
    })
    expect(screen.queryByText('我的备注')).not.toBeInTheDocument()
  })
})

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

describe('ReviewCards slash action', () => {
  beforeEach(() => {
    routerMocks.navigate.mockReset()
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
        aiContent: {},
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

  it('clicking 斩 triggers mastered + easy flow', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('hostel'))
    await user.click(screen.getByRole('button', { name: /斩！/ }))

    await waitFor(() => {
      expect(useAppStore.getState().markNoteMastered).toHaveBeenCalledWith('n-1')
      expect(useAppStore.getState().rateCard).toHaveBeenCalledWith('n-1', 'easy', undefined)
      expect(routerMocks.navigate).toHaveBeenCalledWith('/review/summary')
    }, { timeout: 4000 })
  })
})

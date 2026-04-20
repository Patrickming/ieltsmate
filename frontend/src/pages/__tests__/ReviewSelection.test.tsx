import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithRouter } from '@/test/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReviewSelection from '@/pages/ReviewSelection'
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

describe('ReviewSelection', () => {
  beforeEach(() => {
    routerMocks.navigate.mockReset()
    useAppStore.setState({
      notes: [
        {
          id: 'n-1',
          content: 'abandon',
          translation: '放弃',
          category: '单词',
          subcategory: '杂笔记',
          createdAt: '今天',
          reviewStatus: 'new',
          reviewCount: 0,
          correctCount: 0,
          wrongCount: 0,
        },
      ],
      favorites: [],
      reviewPreparing: false,
      reviewPreparingProgress: { done: 0, total: 0 },
    })
    localStorage.removeItem('ielts_review_progress')
  })

  it('等待首批 AI 完成后再跳转到复习卡片页', async () => {
    const user = userEvent.setup()
    let resolvePrepare!: (value: { timedOut: boolean; done: number; total: number }) => void
    const preparePromise = new Promise<{ timedOut: boolean; done: number; total: number }>((resolve) => {
      resolvePrepare = resolve
    })

    const startReviewSession = vi.fn().mockResolvedValue(true)
    // mock 需同步真实 store 行为，否则 reviewPreparing 不会为 true，按钮会显示「正在进入...」而非「AI 生成中...」
    const prepareInitialAIBatch = vi.fn().mockImplementation(async () => {
      useAppStore.setState({
        reviewPreparing: true,
        reviewPreparingProgress: { done: 0, total: 3 },
      })
      const result = await preparePromise
      useAppStore.setState({
        reviewPreparing: false,
        reviewPreparingProgress: { done: result.done, total: result.total },
      })
      return result
    })
    useAppStore.setState({
      startReviewSession,
      prepareInitialAIBatch,
      resetReviewPreparing: vi.fn(),
    })

    renderWithRouter(<ReviewSelection />)

    await user.click(screen.getByRole('button', { name: '开始复习' }))

    expect(startReviewSession).toHaveBeenCalledTimes(1)
    expect(prepareInitialAIBatch).toHaveBeenCalledTimes(1)
    expect(routerMocks.navigate).not.toHaveBeenCalled()
    expect(screen.getByText('AI 生成中...')).toBeInTheDocument()

    resolvePrepare({ timedOut: false, done: 3, total: 3 })

    await waitFor(() => {
      expect(routerMocks.navigate).toHaveBeenCalledWith('/review/cards')
    })
  })

  it('预热超时时仍会跳转并展示轻提示', async () => {
    const user = userEvent.setup()
    const startReviewSession = vi.fn().mockResolvedValue(true)
    const prepareInitialAIBatch = vi.fn().mockResolvedValue({ timedOut: true, done: 1, total: 3 })
    useAppStore.setState({
      startReviewSession,
      prepareInitialAIBatch,
      resetReviewPreparing: vi.fn(),
    })

    renderWithRouter(<ReviewSelection />)

    await user.click(screen.getByRole('button', { name: '开始复习' }))

    await waitFor(() => {
      expect(routerMocks.navigate).toHaveBeenCalledWith('/review/cards')
    })

    expect(screen.getByText('AI 生成较慢，已进入复习页，联想内容会在卡片内继续补全')).toBeInTheDocument()
  })
})

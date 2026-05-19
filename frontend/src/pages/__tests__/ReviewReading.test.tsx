import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/render'
import ReviewReading from '@/pages/ReviewReading'
import { useAppStore } from '@/store/useAppStore'

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => routerMocks.navigate,
    useSearchParams: () => [new URLSearchParams('source=notes&range=all')],
  }
})

describe('ReviewReading', () => {
  beforeEach(() => {
    routerMocks.navigate.mockReset()
    useAppStore.setState({
      notes: [{
        id: 'n1',
        content: 'fellow',
        translation: '同伴',
        category: '单词',
        subcategory: '杂笔记',
        createdAt: '今天',
        reviewStatus: 'new',
        reviewCount: 0,
        correctCount: 0,
        wrongCount: 0,
      }],
      favorites: [],
      currentReadingReviewBatch: null,
      readingReviewBatches: [],
      readingReviewLoading: false,
      loadReadingReviewBatches: vi.fn().mockResolvedValue(undefined),
      loadReadingReviewBatch: vi.fn().mockResolvedValue(null),
      cancelReadingReviewBatch: vi.fn().mockResolvedValue(null),
      createReadingReviewBatch: vi.fn().mockResolvedValue({
        id: 'batch-1',
        status: 'pending',
        sourceType: 'notes',
        rangeType: 'all',
        categoryFilter: [],
        targetArticles: 5,
        generateAll: false,
        timeoutSeconds: 1800,
        totalNotes: 1,
        usedNotes: 0,
        generatedArticles: 0,
        failedArticles: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        articles: [],
      }),
    })
  })

  it('creates a reading batch from the selected note pool', async () => {
    const user = userEvent.setup()
    const createReadingReviewBatch = useAppStore.getState().createReadingReviewBatch

    renderWithRouter(<ReviewReading />)

    expect(screen.getByText(/当前笔记池 1 条/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /开始生成/ }))

    expect(createReadingReviewBatch).toHaveBeenCalledWith({
      source: 'notes',
      range: 'all',
      articleTarget: 5,
      timeoutSeconds: 1800,
    })
  })

  it('shows the actual model used by the current batch', () => {
    useAppStore.setState({
      currentReadingReviewBatch: {
        id: 'batch-model',
        status: 'running',
        sourceType: 'notes',
        rangeType: 'all',
        categoryFilter: [],
        targetArticles: null,
        generateAll: true,
        timeoutSeconds: 3600,
        modelProvider: 'ZenMux',
        modelId: 'deepseek/deepseek-v4-pro',
        totalNotes: 1,
        usedNotes: 0,
        generatedArticles: 0,
        failedArticles: 0,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        articles: [],
      },
    })

    renderWithRouter(<ReviewReading />)

    expect(screen.getByText(/模型 ZenMux · deepseek\/deepseek-v4-pro/)).toBeInTheDocument()
  })

  it('shows session-only failure logs for the current batch', () => {
    useAppStore.setState({
      currentReadingReviewBatch: {
        id: 'batch-failed',
        status: 'failed',
        sourceType: 'notes',
        rangeType: 'all',
        categoryFilter: [],
        targetArticles: null,
        generateAll: true,
        timeoutSeconds: 3600,
        modelProvider: 'ZenMux',
        modelId: 'deepseek/deepseek-v4-pro',
        totalNotes: 1,
        usedNotes: 0,
        generatedArticles: 0,
        failedArticles: 3,
        errorMessage: 'Stream error: TypeError: terminated | cause: other side closed',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        articles: [],
      },
    })

    renderWithRouter(<ReviewReading />)

    expect(screen.getByText('失败日志')).toBeInTheDocument()
    expect(screen.getByText(/仅本次会话，刷新后清除/)).toBeInTheDocument()
    expect(screen.getByText(/Stream error: TypeError: terminated/)).toBeInTheDocument()
    expect(screen.queryByText(/任务失败/)).not.toBeInTheDocument()
  })
})

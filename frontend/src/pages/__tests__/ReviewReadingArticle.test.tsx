import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/render'
import ReviewReadingArticle from '@/pages/ReviewReadingArticle'
import { useAppStore } from '@/store/useAppStore'

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => routerMocks.navigate,
    useParams: () => ({ id: 'article-1' }),
  }
})

describe('ReviewReadingArticle', () => {
  beforeEach(() => {
    routerMocks.navigate.mockReset()
    useAppStore.setState({
      readingReviewLoading: false,
      selectedReadingArticle: {
        id: 'article-1',
        batchId: 'batch-1',
        title: 'Academic Mobility',
        article: 'Academic mobility shapes research communities through companion networks.',
        paragraphTranslations: ['学术流动通过同伴网络塑造研究共同体。'],
        wordCount: 920,
        status: 'completed',
        generationMs: 12_000,
        qualityWarnings: [],
        createdAt: new Date().toISOString(),
        questions: [{ id: 'q1', type: 'short-answer', prompt: 'What is shaped by mobility?' }],
        answers: [{ id: 'q1', answer: 'research communities' }],
        explanations: [{ id: 'q1', explanation: '中文解析说明答案来自文章第一句。' }],
        notes: [{
          id: 'map-1',
          noteId: 'n1',
          noteContent: 'fellow',
          noteTranslation: '同伴',
          noteCategory: '单词',
          expression: 'companion',
          isVariant: true,
          explanation: '用 companion 自然替换 fellow。',
        }],
        _count: { notes: 1 },
      },
      loadReadingArticle: vi.fn().mockResolvedValue(null),
      deleteReadingArticle: vi.fn().mockResolvedValue(true),
    })
  })

  it('renders article translations and opens the mapped note from highlighted text', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ReviewReadingArticle />)

    expect(screen.getByRole('heading', { name: 'Academic Mobility' })).toBeInTheDocument()
    expect(screen.queryByText(/题目、答案与中文解析/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '译文' }))
    expect(screen.getByText('学术流动通过同伴网络塑造研究共同体。')).toBeInTheDocument()

    const mappedButtons = screen.getAllByRole('button', { name: /companion/ })
    await user.click(mappedButtons[0]!)

    expect(routerMocks.navigate).toHaveBeenCalledWith('/kb/n1')
    expect(screen.getAllByText('原笔记：fellow · 文中使用：companion（变体）').length).toBeGreaterThan(0)
  })

  it('does not highlight substring matches inside other words', () => {
    useAppStore.setState({
      selectedReadingArticle: {
        id: 'article-2',
        batchId: 'batch-1',
        title: 'Boundary Test',
        article: 'It was a vast landscape as far as the eye could see.',
        paragraphTranslations: [],
        wordCount: 12,
        status: 'completed',
        generationMs: 1000,
        qualityWarnings: [],
        createdAt: new Date().toISOString(),
        questions: [],
        answers: [],
        explanations: [],
        notes: [{
          id: 'map-2',
          noteId: 'n2',
          noteContent: 'as',
          noteTranslation: '作为',
          noteCategory: '单词',
          expression: 'as',
          isVariant: false,
        }],
        _count: { notes: 1 },
      },
    })

    renderWithRouter(<ReviewReadingArticle />)

    const articleRegion = screen.getByRole('article')
    const highlights = within(articleRegion).getAllByRole('button')
    expect(highlights.filter((button) => button.textContent?.startsWith('as'))).toHaveLength(2)
    expect(highlights.some((button) => /was|vast/i.test(button.textContent ?? ''))).toBe(false)
  })

  it('returns to AI reading page from article detail', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ReviewReadingArticle />)

    await user.click(screen.getByRole('button', { name: /返回 AI 阅读/ }))

    expect(routerMocks.navigate).toHaveBeenCalledWith('/review/reading')
  })
})

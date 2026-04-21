import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SearchModal } from '@/components/modals/SearchModal'
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

describe('SearchModal association search', () => {
  beforeEach(() => {
    routerMocks.navigate.mockReset()
    useAppStore.setState({
      showSearch: true,
      closeSearch: vi.fn(),
      setSelectedNote: vi.fn(),
      notes: [
        {
          id: 'n-1',
          content: 'strip basics',
          translation: '基础',
          category: '单词',
          subcategory: '杂笔记',
          createdAt: '今天',
          reviewStatus: 'new',
          reviewCount: 0,
          correctCount: 0,
          wrongCount: 0,
          userNotes: ['striped-stripe注意e'],
        },
      ],
    })
  })

  it('全局搜索弹窗先显示笔记结果，再显示关联内容结果，点击关联项跳详情', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <SearchModal />
      </MemoryRouter>,
    )

    await user.type(screen.getByPlaceholderText('搜索笔记...'), 'strip')

    const noteButton = screen.getByRole('button', { name: /strip basics 基础/ })
    const associationButton = screen.getByRole('button', { name: 'stripe 关联内容' })

    expect(noteButton).toBeInTheDocument()
    expect(associationButton).toBeInTheDocument()
    expect(
      noteButton.compareDocumentPosition(associationButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await user.click(associationButton)

    expect(routerMocks.navigate).toHaveBeenCalledWith('/kb/n-1')
    expect(useAppStore.getState().setSelectedNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n-1' }),
    )
  })
})

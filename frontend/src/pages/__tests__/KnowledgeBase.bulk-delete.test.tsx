import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import KnowledgeBase from '@/pages/KnowledgeBase'
import { useAppStore } from '@/store/useAppStore'

describe('KnowledgeBase batch delete', () => {
  const deleteNote = vi.fn(async () => true)

  beforeEach(() => {
    deleteNote.mockClear()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    useAppStore.setState({
      notes: [
        {
          id: 'n-1',
          content: 'abandon',
          translation: '放弃',
          category: '口语',
          subcategory: '杂笔记',
          createdAt: '今天',
          reviewStatus: 'mastered',
          reviewCount: 6,
          correctCount: 5,
          wrongCount: 1,
        },
        {
          id: 'n-2',
          content: 'sugar',
          translation: '糖',
          category: '口语',
          subcategory: '杂笔记',
          createdAt: '今天',
          reviewStatus: 'learning',
          reviewCount: 2,
          correctCount: 1,
          wrongCount: 1,
        },
      ],
      writingNotes: [],
      writingNotesLoading: false,
      favorites: [],
      openQuickNote: () => {},
      clearLastAddedNoteId: () => {},
      lastAddedNoteId: null,
      deleteNote,
    })
  })

  it('supports multi-select and confirm batch delete', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/kb?group=杂笔记']}>
        <Routes>
          <Route path="/kb" element={<KnowledgeBase />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '批量删除' }))
    await user.click(screen.getByRole('button', { name: '选择笔记 abandon' }))
    await user.click(screen.getByRole('button', { name: '选择笔记 sugar' }))
    await user.click(screen.getByRole('button', { name: '确认删除 2 条笔记' }))

    expect(window.confirm).toHaveBeenCalled()
    expect(deleteNote).toHaveBeenCalledTimes(2)
    expect(deleteNote).toHaveBeenCalledWith('n-1')
    expect(deleteNote).toHaveBeenCalledWith('n-2')
  })
})

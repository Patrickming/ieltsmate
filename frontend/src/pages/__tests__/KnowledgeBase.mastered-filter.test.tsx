import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import KnowledgeBase from '@/pages/KnowledgeBase'
import { useAppStore } from '@/store/useAppStore'

describe('KnowledgeBase mastered filters', () => {
  beforeEach(() => {
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
        {
          id: 'n-dup-a',
          content: 'girl',
          translation: '女孩',
          category: '单词',
          subcategory: '杂笔记',
          createdAt: '今天',
          reviewStatus: 'new',
        },
        {
          id: 'n-dup-b',
          content: 'girl',
          translation: '女孩儿',
          category: '短语',
          subcategory: '杂笔记',
          createdAt: '今天',
          reviewStatus: 'learning',
        },
      ],
      writingNotes: [],
      writingNotesLoading: false,
      favorites: [],
      openQuickNote: () => {},
      deleteNote: async () => true,
      clearLastAddedNoteId: () => {},
      lastAddedNoteId: null,
    })
  })

  it('top-level 已掌握 route filter shows only mastered notes', () => {
    render(
      <MemoryRouter initialEntries={['/kb?group=已掌握&status=mastered']}>
        <Routes>
          <Route path="/kb" element={<KnowledgeBase />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('abandon')).toBeInTheDocument()
    expect(screen.queryByText('sugar')).not.toBeInTheDocument()
  })

  it('category + 未掌握 sub-filter route works in 杂笔记', () => {
    render(
      <MemoryRouter initialEntries={['/kb?group=杂笔记&cat=口语&status=unmastered']}>
        <Routes>
          <Route path="/kb" element={<KnowledgeBase />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('sugar')).toBeInTheDocument()
    expect(screen.queryByText('abandon')).not.toBeInTheDocument()
  })

  it('重复笔记 lists every note whose english matches another note', () => {
    render(
      <MemoryRouter initialEntries={['/kb?group=重复笔记']}>
        <Routes>
          <Route path="/kb" element={<KnowledgeBase />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getAllByText('girl')).toHaveLength(2)
    expect(screen.queryByText('sugar')).not.toBeInTheDocument()
    expect(screen.queryByText('abandon')).not.toBeInTheDocument()
  })
})

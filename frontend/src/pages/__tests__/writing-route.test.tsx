import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import WritingNoteDetail from '@/pages/WritingNoteDetail'

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    useReducedMotion: vi.fn(() => true),
  }
})

describe('/kb/w/:id', () => {
  it('renders writing detail for w1 without hitting generic /kb/:id', () => {
    render(
      <MemoryRouter initialEntries={['/kb/w/1']}>
        <Routes>
          <Route path="/kb/w/:id" element={<WritingNoteDetail />} />
          <Route path="/kb/:id" element={<div>NOTE_DETAIL_FALLBACK</div>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByText('NOTE_DETAIL_FALLBACK')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /雅思写作Task 2模板/ })).toBeInTheDocument()
  })
})

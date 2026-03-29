import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithRouter } from '@/test/render'

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  }
})

import * as framerMotion from 'framer-motion'
import Dashboard from '@/pages/Dashboard'

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(framerMotion.useReducedMotion).mockReturnValue(false)
  })

  it('renders 仪表盘 heading', () => {
    renderWithRouter(<Dashboard />)
    expect(screen.getByRole('heading', { level: 1, name: '仪表盘' })).toBeInTheDocument()
  })
})

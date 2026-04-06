import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
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
  function getCSTDateString(offset = 0): string {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  }

  beforeEach(() => {
    vi.mocked(framerMotion.useReducedMotion).mockReturnValue(false)
  })

  it('renders 仪表盘 heading', () => {
    renderWithRouter(<Dashboard />)
    expect(screen.getByRole('heading', { level: 1, name: '仪表盘' })).toBeInTheDocument()
  })

  it('点击热力图日期后，会联动加载该日期的每日任务', async () => {
    const today = getCSTDateString(0)
    const yesterday = getCSTDateString(-1)

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.url

      if (url.startsWith('/todos?date=')) {
        const date = new URL(url, 'http://localhost').searchParams.get('date')
        const data = date === yesterday
          ? [{ id: 'y-1', text: '昨天任务', done: false, sortOrder: 0, taskDate: yesterday }]
          : [{ id: 't-1', text: '今天任务', done: false, sortOrder: 0, taskDate: today }]

        return new Response(JSON.stringify({ data }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    const { container } = renderWithRouter(<Dashboard />)

    await waitFor(() => expect(screen.getByText('今天任务')).toBeInTheDocument())

    const yesterdayCell = container.querySelector(`rect[data-date="${yesterday}"]`)
    expect(yesterdayCell).toBeTruthy()

    fireEvent.click(yesterdayCell!)

    await waitFor(() => expect(screen.getByText('昨天任务')).toBeInTheDocument())
    expect(screen.queryByText('今天任务')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /昨天/ })).toBeInTheDocument()
  })
})

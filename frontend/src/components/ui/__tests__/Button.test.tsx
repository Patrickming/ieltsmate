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
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  beforeEach(() => {
    vi.mocked(framerMotion.useReducedMotion).mockReturnValue(false)
  })

  it('renders label 保存', () => {
    renderWithRouter(<Button>保存</Button>)
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })

  it('applies primary variant classes', () => {
    renderWithRouter(<Button variant="primary">提交</Button>)
    const btn = screen.getByRole('button', { name: '提交' })
    expect(btn).toHaveClass('bg-primary-btn', 'hover:bg-primary-btn-hover')
    expect(btn).toHaveAttribute('data-variant', 'primary')
  })

  it('applies outline variant border classes', () => {
    renderWithRouter(<Button variant="outline">取消</Button>)
    const btn = screen.getByRole('button', { name: '取消' })
    expect(btn).toHaveClass('border', 'border-border', 'bg-transparent')
    expect(btn).toHaveAttribute('data-variant', 'outline')
  })

  it('marks reduced-motion path and skips scale gestures when useReducedMotion is true', () => {
    vi.mocked(framerMotion.useReducedMotion).mockReturnValue(true)
    renderWithRouter(<Button>减少动效</Button>)
    const btn = screen.getByRole('button', { name: '减少动效' })
    expect(btn).toHaveAttribute('data-reduced-motion', 'true')
  })
})

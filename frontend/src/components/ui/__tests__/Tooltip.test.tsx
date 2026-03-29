import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/render'

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  }
})

import * as framerMotion from 'framer-motion'
import { Tooltip } from '@/components/ui/Tooltip'

describe('Tooltip', () => {
  beforeEach(() => {
    vi.mocked(framerMotion.useReducedMotion).mockReturnValue(false)
  })

  it('包裹可聚焦子元素时展示 tooltip 并关联 aria-describedby', async () => {
    const user = userEvent.setup()
    renderWithRouter(
      <Tooltip content="提示文案">
        <button type="button">目标</button>
      </Tooltip>
    )

    const btn = screen.getByRole('button', { name: '目标' })
    await user.hover(btn)

    expect(await screen.findByRole('tooltip', { name: '提示文案' })).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-describedby')
  })

  it('合并已有 aria-describedby，关闭后恢复原值', async () => {
    const user = userEvent.setup()
    renderWithRouter(
      <Tooltip content="补充说明">
        <button type="button" aria-describedby="existing-help">
          带描述按钮
        </button>
      </Tooltip>
    )

    const btn = screen.getByRole('button', { name: '带描述按钮' })
    expect(btn).toHaveAttribute('aria-describedby', 'existing-help')

    await user.hover(btn)
    const tip = await screen.findByRole('tooltip', { name: '补充说明' })
    const merged = btn.getAttribute('aria-describedby') ?? ''
    expect(merged).toContain('existing-help')
    expect(merged).toContain(tip.id)

    await user.unhover(btn)
    expect(btn.getAttribute('aria-describedby')).toBe('existing-help')
  })
})

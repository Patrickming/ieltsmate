import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/render'
import { ModalShell } from '@/components/ui/ModalShell'

describe('ModalShell', () => {
  it('点击 overlay 时调用 onClose 一次', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderWithRouter(
      <ModalShell open onClose={onClose}>
        <div>面板内容</div>
      </ModalShell>
    )

    await user.click(screen.getByTestId('modal-overlay'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('按下 Escape 时调用 onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderWithRouter(
      <ModalShell open onClose={onClose}>
        <div>面板内容</div>
      </ModalShell>
    )

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

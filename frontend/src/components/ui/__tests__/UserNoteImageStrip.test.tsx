import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/render'
import { UserNoteImageStrip } from '@/components/ui/UserNoteImageStrip'

describe('UserNoteImageStrip', () => {
  it('为缩略图提供可区分名称，并在 maxVisible 截断时保留总数', () => {
    renderWithRouter(
      <UserNoteImageStrip
        images={[
          '/note-user-images/2026/05/a.png',
          '/note-user-images/2026/05/b.png',
          '/note-user-images/2026/05/c.png',
          '/note-user-images/2026/05/d.png',
        ]}
        thumbnailClassName="h-10 w-10"
        maxVisible={2}
      />,
    )

    expect(screen.getByRole('button', { name: '查看备注图片 1/4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看备注图片 2/4' })).toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('打开灯箱后管理焦点并在关闭后恢复到触发按钮', async () => {
    const user = userEvent.setup()

    renderWithRouter(
      <UserNoteImageStrip
        images={[
          '/note-user-images/2026/05/a.png',
          '/note-user-images/2026/05/b.png',
        ]}
        thumbnailClassName="h-10 w-10"
      />,
    )

    const firstThumbnail = screen.getByRole('button', { name: '查看备注图片 1/2' })

    await user.click(firstThumbnail)

    const dialog = screen.getByRole('dialog', { name: '备注图片预览' })
    const closeButton = within(dialog).getByRole('button', { name: '关闭备注图片预览' })
    const previousButton = within(dialog).getByRole('button', { name: '上一张备注图片' })
    const nextButton = within(dialog).getByRole('button', { name: '下一张备注图片' })

    expect(closeButton).toHaveTextContent('关闭')
    expect(closeButton).toHaveFocus()

    await user.tab()
    expect(previousButton).toHaveFocus()
    await user.tab()
    expect(nextButton).toHaveFocus()
    await user.tab()
    expect(closeButton).toHaveFocus()

    await user.click(closeButton)

    await waitFor(() => expect(firstThumbnail).toHaveFocus())
  })
})

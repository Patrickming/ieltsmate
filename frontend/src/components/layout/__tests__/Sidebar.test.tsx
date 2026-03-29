import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { renderWithRouter } from '@/test/render'
import { Sidebar } from '../Sidebar'

function RouteProbe() {
  const loc = useLocation()
  return <span data-testid="route">{`${loc.pathname}${loc.search}`}</span>
}

describe('Sidebar', () => {
  it('renders main nav links 首页, 知识库, 复习', () => {
    renderWithRouter(<Sidebar />)
    expect(screen.getByRole('link', { name: '首页' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '知识库' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '复习' })).toBeInTheDocument()
  })

  it('renders import and settings entry points', () => {
    renderWithRouter(<Sidebar />)
    expect(screen.getByRole('button', { name: '导入数据' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '设置' })).toBeInTheDocument()
  })

  it('toggles aria-expanded on group buttons when clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Sidebar />)

    const miscBtn = screen.getByRole('button', { name: /杂笔记/ })
    const writingBtn = screen.getByRole('button', { name: /写作/ })

    expect(miscBtn).toHaveAttribute('aria-expanded', 'true')
    expect(writingBtn).toHaveAttribute('aria-expanded', 'false')
    expect(miscBtn).toHaveAttribute('aria-controls', 'sidebar-group-panel-misc')
    expect(writingBtn).toHaveAttribute('aria-controls', 'sidebar-group-panel-writing')

    await user.click(miscBtn)
    expect(miscBtn).toHaveAttribute('aria-expanded', 'false')

    await user.click(miscBtn)
    expect(miscBtn).toHaveAttribute('aria-expanded', 'true')

    await user.click(writingBtn)
    expect(writingBtn).toHaveAttribute('aria-expanded', 'true')
  })

  it('navigates to kb with expected query when a 杂笔记 category is clicked', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <Sidebar />
        <RouteProbe />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('route')).toHaveTextContent('/')

    await user.click(screen.getByRole('button', { name: '口语' }))
    expect(screen.getByTestId('route')).toHaveTextContent(
      `/kb?group=杂笔记&cat=${encodeURIComponent('口语')}`,
    )
  })
})

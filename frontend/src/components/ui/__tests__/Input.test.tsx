import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { Input } from '@/components/ui/Input'
import { renderWithRouter } from '@/test/render'

describe('Input', () => {
  it('shows placeholder text', () => {
    renderWithRouter(<Input placeholder="请输入内容" />)
    expect(screen.getByPlaceholderText('请输入内容')).toBeInTheDocument()
  })

  it('applies invalid styling when aria-invalid is true', () => {
    renderWithRouter(<Input placeholder="x" aria-invalid />)
    const input = screen.getByPlaceholderText('x')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveClass('border-cat-sentence', 'ring-cat-sentence/35')
    expect(input).toHaveAttribute('data-invalid', 'true')
  })

  it('applies invalid styling when aria-invalid is string "true"', () => {
    renderWithRouter(<Input placeholder="y" aria-invalid="true" />)
    const input = screen.getByPlaceholderText('y')
    expect(input).toHaveClass('border-cat-sentence')
    expect(input).toHaveAttribute('data-invalid', 'true')
  })

  it('applies md size height by default', () => {
    renderWithRouter(<Input placeholder="z" />)
    expect(screen.getByPlaceholderText('z')).toHaveClass('h-10', 'min-h-10')
  })
})

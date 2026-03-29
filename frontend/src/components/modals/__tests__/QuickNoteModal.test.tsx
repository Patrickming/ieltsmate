import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickNoteModal } from '../QuickNoteModal'
import { mockNotes } from '../../../data/mockData'
import { useAppStore } from '../../../store/useAppStore'

describe('QuickNoteModal', () => {
  beforeEach(() => {
    useAppStore.setState({
      showQuickNote: true,
      notes: [...mockNotes],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('点击保存后会新增一条笔记到 store', async () => {
    const user = userEvent.setup()
    render(<QuickNoteModal />)

    const input = screen.getByPlaceholderText('get out of — 避免')
    await user.type(input, 'brand new note — 全新释义')
    await user.click(screen.getByRole('button', { name: '保存笔记' }))

    await waitFor(
      () => {
        expect(useAppStore.getState().notes.length).toBe(mockNotes.length + 1)
      },
      { timeout: 1500 }
    )
  })

  it('后端保存成功时显示后端成功提示', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'r-1',
          content: 'remote note',
          translation: '远端成功',
          category: '短语',
        },
      }),
    } as Response)

    render(<QuickNoteModal />)
    await user.type(screen.getByPlaceholderText('get out of — 避免'), 'remote note — 远端成功')
    await user.click(screen.getByRole('button', { name: '保存笔记' }))

    expect(await screen.findByText('已保存到后端，并更新到当前列表')).toBeInTheDocument()
  })

  it('后端失败时显示本地兜底提示', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response)

    render(<QuickNoteModal />)
    await user.type(screen.getByPlaceholderText('get out of — 避免'), 'local fallback — 本地兜底')
    await user.click(screen.getByRole('button', { name: '保存笔记' }))

    expect(await screen.findByText('后端不可用，已本地保存（联调兜底）')).toBeInTheDocument()
  })

  it('后端请求挂起时不会一直卡在保存中，会超时回退本地', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_, init) => {
      const signal = init?.signal
      return new Promise<Response>((_, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    })

    render(<QuickNoteModal />)
    fireEvent.change(screen.getByPlaceholderText('get out of — 避免'), {
      target: { value: 'hang case — 超时回退' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存笔记' }))

    expect(screen.getByRole('button', { name: '保存中...' })).toBeInTheDocument()

    await waitFor(() => {
      expect(useAppStore.getState().notes.length).toBe(mockNotes.length + 1)
    }, { timeout: 7000 })
  }, 12000)
})

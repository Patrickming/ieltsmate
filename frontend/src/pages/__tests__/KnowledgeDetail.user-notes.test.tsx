import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/render'
import KnowledgeDetail from '@/pages/KnowledgeDetail'
import { useAppStore } from '@/store/useAppStore'

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => routerMocks.navigate,
    useParams: () => ({ id: 'n-1' }),
  }
})

function createJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getLastFormData(fetchMock: ReturnType<typeof vi.spyOn>) {
  const requestInit = fetchMock.mock.calls.at(-1)?.[1] as RequestInit | undefined
  expect(requestInit?.body).toBeInstanceOf(FormData)
  return requestInit?.body as FormData
}

function pasteFiles(target: HTMLElement, files: File[]) {
  fireEvent.paste(target, {
    clipboardData: {
      items: files.map((file) => ({
        kind: 'file',
        type: file.type,
        getAsFile: () => file,
      })),
    },
  })
}

describe('KnowledgeDetail user notes', () => {
  beforeEach(() => {
    routerMocks.navigate.mockReset()
    vi.restoreAllMocks()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview-note-image')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    useAppStore.setState({
      notes: [{
        id: 'n-1',
        content: 'hostel',
        translation: '旅舍',
        category: '单词',
        subcategory: '杂笔记',
        createdAt: '今天',
        reviewStatus: 'new',
        reviewCount: 0,
        correctCount: 0,
        wrongCount: 0,
      }],
    })
  })

  it('支持粘贴图片后保存备注并显示缩略图', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createJsonResponse({ data: { items: [] } }))
      .mockResolvedValueOnce(createJsonResponse({
        data: {
          id: 'u-1',
          content: '图文备注',
          images: ['/note-user-images/2026/05/a.png'],
        },
      }, 201))

    const user = userEvent.setup()
    renderWithRouter(<KnowledgeDetail />)

    await user.click(await screen.findByRole('button', { name: '添加备注' }))
    const textarea = screen.getByPlaceholderText('添加备注...')

    const file = new File(['image-bits'], 'clip.png', { type: 'image/png' })
    fireEvent.paste(textarea, {
      clipboardData: {
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
      },
    })

    expect(await screen.findByRole('button', { name: /查看备注图片/ })).toBeInTheDocument()

    await user.type(textarea, '图文备注')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/user-notes'),
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    )
    const formData = getLastFormData(fetchMock)
    expect(formData.get('content')).toBe('图文备注')
    expect(formData.getAll('images')).toContain(file)
    expect(await screen.findByText('图文备注')).toBeInTheDocument()
  })

  it('编辑备注时可删除旧图并追加新图', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createJsonResponse({
        data: {
          items: [{
            id: 'u-1',
            content: '旧备注',
            images: [
              '/note-user-images/2026/05/old-a.png',
              '/note-user-images/2026/05/old-b.png',
            ],
          }],
        },
      }))
      .mockResolvedValueOnce(createJsonResponse({
        data: {
          id: 'u-1',
          content: '更新后的备注',
          images: [
            '/note-user-images/2026/05/old-b.png',
            '/note-user-images/2026/05/new-c.png',
          ],
        },
      }))

    const user = userEvent.setup()
    renderWithRouter(<KnowledgeDetail />)

    expect(await screen.findByText('旧备注')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '编辑备注 u-1' }))

    await user.clear(screen.getByDisplayValue('旧备注'))
    await user.type(screen.getByRole('textbox', { name: '编辑备注内容' }), '更新后的备注')
    await user.click(screen.getByRole('button', { name: '移除已保存图片 old-a.png' }))

    const editBox = screen.getByRole('textbox', { name: '编辑备注内容' })
    const file = new File(['next-image'], 'new-c.png', { type: 'image/png' })
    fireEvent.paste(editBox, {
      clipboardData: {
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
      },
    })

    await user.click(screen.getByRole('button', { name: '保存备注修改' }))

    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/notes/n-1/user-notes/u-1'),
      expect.objectContaining({ method: 'PATCH', body: expect.any(FormData) }),
    )
    const formData = getLastFormData(fetchMock)
    expect(formData.get('content')).toBe('更新后的备注')
    expect(JSON.parse(String(formData.get('keepImages')))).toEqual([
      '/note-user-images/2026/05/old-b.png',
    ])
    expect(formData.getAll('images')).toContain(file)
    expect(await screen.findByText('更新后的备注')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /查看备注图片/ })).toHaveLength(2)
  })

  it('编辑备注时按最终总数限制图片，超量时保留有效新增并提示反馈', async () => {
    const existingImages = Array.from({ length: 9 }, (_, index) => (
      `/note-user-images/2026/05/existing-${index}.png`
    ))
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createJsonResponse({
        data: {
          items: [{
            id: 'u-1',
            content: '旧备注',
            images: existingImages,
          }],
        },
      }))
      .mockResolvedValueOnce(createJsonResponse({
        data: {
          id: 'u-1',
          content: '编辑后备注',
          images: [...existingImages, '/note-user-images/2026/05/new-accepted.png'],
        },
      }))

    const user = userEvent.setup()
    renderWithRouter(<KnowledgeDetail />)

    expect(await screen.findByText('旧备注')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '编辑备注 u-1' }))

    const editBox = screen.getByRole('textbox', { name: '编辑备注内容' })
    await user.clear(editBox)
    await user.type(editBox, '编辑后备注')

    const accepted = new File(['accepted'], 'accepted.png', { type: 'image/png' })
    const overflow = new File(['overflow'], 'overflow.png', { type: 'image/png' })
    pasteFiles(editBox, [accepted, overflow])

    expect(screen.getByRole('alert')).toHaveTextContent('最多只能添加 10 张图片')
    expect(screen.getAllByRole('button', { name: /查看备注图片/ })).toHaveLength(10)

    await user.click(screen.getByRole('button', { name: '保存备注修改' }))

    const formData = getLastFormData(fetchMock)
    expect(formData.getAll('images')).toEqual([accepted])
    expect(await screen.findByText('编辑后备注')).toBeInTheDocument()
  })

  it('创建备注失败时保留编辑内容和已粘贴图片预览', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createJsonResponse({ data: { items: [] } }))
      .mockResolvedValueOnce(createJsonResponse({ error: 'save failed' }, 500))

    const user = userEvent.setup()
    renderWithRouter(<KnowledgeDetail />)

    await user.click(await screen.findByRole('button', { name: '添加备注' }))
    const textarea = screen.getByPlaceholderText('添加备注...')

    const file = new File(['failed-image'], 'failed.png', { type: 'image/png' })
    fireEvent.paste(textarea, {
      clipboardData: {
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
      },
    })

    await user.type(textarea, '失败后仍保留')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
    })

    expect(screen.getByRole('alert')).toHaveTextContent('保存备注失败，请重试。')
    expect(screen.getByPlaceholderText('添加备注...')).toHaveValue('失败后仍保留')
    expect(screen.getByRole('button', { name: '查看备注图片 1/1' })).toBeInTheDocument()
  })

  it('粘贴非法或超量图片时会保留有效图片并显示校验提示', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(createJsonResponse({ data: { items: [] } }))

    const user = userEvent.setup()
    renderWithRouter(<KnowledgeDetail />)

    await user.click(await screen.findByRole('button', { name: '添加备注' }))
    const textarea = screen.getByPlaceholderText('添加备注...')

    const firstBatch = Array.from({ length: 9 }, (_, index) => (
      new File([`image-${index}`], `valid-${index}.png`, { type: 'image/png' })
    ))
    pasteFiles(textarea, firstBatch)
    expect(screen.getAllByRole('button', { name: /查看备注图片/ })).toHaveLength(9)

    const acceptedTenth = new File(['accepted'], 'accepted.webp', { type: 'image/webp' })
    const overflowEleventh = new File(['overflow'], 'overflow.gif', { type: 'image/gif' })
    const invalidType = new File(['bad'], 'bad.bmp', { type: 'image/bmp' })
    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.png', {
      type: 'image/png',
    })

    pasteFiles(textarea, [acceptedTenth, overflowEleventh, invalidType, oversized])

    expect(screen.getAllByRole('button', { name: /查看备注图片/ })).toHaveLength(10)
    expect(screen.getByRole('alert')).toHaveTextContent('仅支持 PNG、JPEG、WebP、GIF')
    expect(screen.getByRole('alert')).toHaveTextContent('单张图片不能超过 5MB')
    expect(screen.getByRole('alert')).toHaveTextContent('最多只能添加 10 张图片')
  })

  it('新增备注支持移除单张新图片，Escape 会走同一取消路径清空草稿', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(createJsonResponse({ data: { items: [] } }))

    const user = userEvent.setup()
    renderWithRouter(<KnowledgeDetail />)

    await user.click(await screen.findByRole('button', { name: '添加备注' }))
    const textarea = screen.getByPlaceholderText('添加备注...')

    const first = new File(['first'], 'first.png', { type: 'image/png' })
    const second = new File(['second'], 'second.png', { type: 'image/png' })
    pasteFiles(textarea, [first, second])

    expect(screen.getAllByRole('button', { name: /查看备注图片/ })).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: '移除新图片 first.png' }))
    expect(screen.getAllByRole('button', { name: /查看备注图片/ })).toHaveLength(1)

    textarea.focus()
    await user.keyboard('[Escape]')

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('添加备注...')).not.toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: '添加备注' }))
    expect(screen.queryByRole('button', { name: /查看备注图片/ })).not.toBeInTheDocument()
  })

  it('编辑备注保存失败时保留草稿并显示错误提示', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createJsonResponse({
        data: {
          items: [{
            id: 'u-1',
            content: '旧备注',
            images: ['/note-user-images/2026/05/old-a.png'],
          }],
        },
      }))
      .mockResolvedValueOnce(createJsonResponse({ error: 'save failed' }, 500))

    const user = userEvent.setup()
    renderWithRouter(<KnowledgeDetail />)

    expect(await screen.findByText('旧备注')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '编辑备注 u-1' }))

    const editBox = screen.getByRole('textbox', { name: '编辑备注内容' })
    await user.clear(editBox)
    await user.type(editBox, '失败后仍保留的编辑内容')

    const file = new File(['next-image'], 'edit-failed.png', { type: 'image/png' })
    pasteFiles(editBox, [file])

    await user.click(screen.getByRole('button', { name: '保存备注修改' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    expect(screen.getByRole('alert')).toHaveTextContent('保存备注修改失败，请重试。')
    expect(screen.getByRole('textbox', { name: '编辑备注内容' })).toHaveValue('失败后仍保留的编辑内容')
    expect(screen.getAllByRole('button', { name: /查看备注图片/ })).toHaveLength(2)
  })

  it('删除备注失败时保留原内容并显示错误提示', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createJsonResponse({
        data: {
          items: [{
            id: 'u-1',
            content: '删除失败仍应保留',
            images: [],
          }],
        },
      }))
      .mockResolvedValueOnce(createJsonResponse({ error: 'delete failed' }, 500))

    const user = userEvent.setup()
    renderWithRouter(<KnowledgeDetail />)

    expect(await screen.findByText('删除失败仍应保留')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '删除备注 u-1' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    expect(screen.getByText('删除失败仍应保留')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('删除备注失败，请重试。')
  })
})

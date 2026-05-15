import { afterEach, describe, expect, it, vi } from 'vitest'
import { backendAssetUrl } from '../apiBase'

describe('backendAssetUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('在配置了 VITE_API_BASE_URL 时为后端静态资源补全基地址', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.example.com/')

    expect(backendAssetUrl('/note-user-images/2026/05/a.png')).toBe(
      'http://api.example.com/note-user-images/2026/05/a.png',
    )
  })

  it('保留 blob/data/绝对地址不变', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.example.com')

    expect(backendAssetUrl('blob:preview-image')).toBe('blob:preview-image')
    expect(backendAssetUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
    expect(backendAssetUrl('https://cdn.example.com/image.png')).toBe('https://cdn.example.com/image.png')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderWithRouter } from '@/test/render'
import { ActivityHeatmap } from '@/components/ui/ActivityHeatmap'
import { useAppStore } from '@/store/useAppStore'

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    useAppStore.setState({ activity: {}, activityLoading: false })

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  it('clientWidth 为 0 时仍能通过 rect 宽度计算出正常热力图尺寸', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      width: 620,
      height: 80,
      top: 0,
      left: 0,
      bottom: 80,
      right: 620,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }))

    const { container } = renderWithRouter(<ActivityHeatmap />)

    await waitFor(() => {
      const svg = container.querySelector('svg')
      expect(svg).toBeTruthy()
      const viewBox = svg!.getAttribute('viewBox')
      expect(viewBox).toBeTruthy()
      const parts = (viewBox ?? '').split(' ')
      const svgWidth = Number(parts[2] ?? 0)
      expect(svgWidth).toBeGreaterThan(550)
    })
  })
})

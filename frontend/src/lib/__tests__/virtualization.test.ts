import { describe, expect, it } from 'vitest'
import { getVirtualGridRange, getVirtualRange } from '@/lib/virtualization'

describe('virtualization helpers', () => {
  it('getVirtualRange 在可视区只覆盖中间一段时返回带 overscan 的线性窗口', () => {
    expect(
      getVirtualRange({
        itemCount: 100,
        itemSize: 40,
        viewportSize: 120,
        scrollOffset: 200,
        overscan: 1,
      }),
    ).toEqual({
      startIndex: 4,
      endIndex: 9,
      offsetTop: 160,
      offsetBottom: 3640,
    })
  })

  it('getVirtualRange 在总量很小时直接返回完整范围', () => {
    expect(
      getVirtualRange({
        itemCount: 3,
        itemSize: 48,
        viewportSize: 500,
        scrollOffset: 0,
      }),
    ).toEqual({
      startIndex: 0,
      endIndex: 3,
      offsetTop: 0,
      offsetBottom: 0,
    })
  })

  it('getVirtualGridRange 依据滚动位置裁切网格行并处理不完整末行', () => {
    expect(
      getVirtualGridRange({
        itemCount: 10,
        columnCount: 3,
        rowHeight: 100,
        viewportHeight: 220,
        scrollTop: 120,
        overscanRows: 1,
      }),
    ).toEqual({
      startRow: 0,
      endRow: 4,
      startIndex: 0,
      endIndex: 10,
      offsetTop: 0,
      offsetBottom: 0,
      totalRows: 4,
      totalHeight: 400,
    })
  })

  it('getVirtualGridRange 会在大列表里只保留可视附近的若干行', () => {
    expect(
      getVirtualGridRange({
        itemCount: 60,
        columnCount: 3,
        rowHeight: 100,
        viewportHeight: 220,
        scrollTop: 520,
        overscanRows: 1,
      }),
    ).toEqual({
      startRow: 4,
      endRow: 9,
      startIndex: 12,
      endIndex: 27,
      offsetTop: 400,
      offsetBottom: 1100,
      totalRows: 20,
      totalHeight: 2000,
    })
  })
})

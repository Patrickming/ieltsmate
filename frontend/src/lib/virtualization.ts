interface VirtualRangeOptions {
  itemCount: number
  itemSize: number
  viewportSize: number
  scrollOffset: number
  overscan?: number
}

interface VirtualRangeResult {
  startIndex: number
  endIndex: number
  offsetTop: number
  offsetBottom: number
}

interface VirtualGridRangeOptions {
  itemCount: number
  columnCount: number
  rowHeight: number
  viewportHeight: number
  scrollTop: number
  overscanRows?: number
}

interface VirtualGridRangeResult {
  startRow: number
  endRow: number
  startIndex: number
  endIndex: number
  offsetTop: number
  offsetBottom: number
  totalRows: number
  totalHeight: number
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

export function getVirtualRange({
  itemCount,
  itemSize,
  viewportSize,
  scrollOffset,
  overscan = 0,
}: VirtualRangeOptions): VirtualRangeResult {
  if (itemCount <= 0 || itemSize <= 0 || viewportSize <= 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      offsetTop: 0,
      offsetBottom: 0,
    }
  }

  const visibleStart = Math.floor(Math.max(scrollOffset, 0) / itemSize)
  const visibleEnd = Math.ceil((Math.max(scrollOffset, 0) + viewportSize) / itemSize)
  const startIndex = clamp(visibleStart - overscan, 0, itemCount)
  const endIndex = clamp(visibleEnd + overscan, startIndex, itemCount)
  const offsetTop = startIndex * itemSize
  const offsetBottom = Math.max(0, (itemCount - endIndex) * itemSize)

  return {
    startIndex,
    endIndex,
    offsetTop,
    offsetBottom,
  }
}

export function getVirtualGridRange({
  itemCount,
  columnCount,
  rowHeight,
  viewportHeight,
  scrollTop,
  overscanRows = 0,
}: VirtualGridRangeOptions): VirtualGridRangeResult {
  const safeColumnCount = Math.max(1, columnCount)
  const totalRows = Math.ceil(Math.max(itemCount, 0) / safeColumnCount)
  const totalHeight = totalRows * Math.max(rowHeight, 0)

  if (itemCount <= 0 || rowHeight <= 0 || viewportHeight <= 0) {
    return {
      startRow: 0,
      endRow: 0,
      startIndex: 0,
      endIndex: 0,
      offsetTop: 0,
      offsetBottom: 0,
      totalRows,
      totalHeight,
    }
  }

  const visibleStartRow = Math.floor(Math.max(scrollTop, 0) / rowHeight)
  const visibleEndRow = Math.ceil((Math.max(scrollTop, 0) + viewportHeight) / rowHeight)
  const startRow = clamp(visibleStartRow - overscanRows, 0, totalRows)
  const endRow = clamp(visibleEndRow + overscanRows, startRow, totalRows)
  const startIndex = Math.min(itemCount, startRow * safeColumnCount)
  const endIndex = Math.min(itemCount, endRow * safeColumnCount)
  const offsetTop = startRow * rowHeight
  const offsetBottom = Math.max(0, totalHeight - endRow * rowHeight)

  return {
    startRow,
    endRow,
    startIndex,
    endIndex,
    offsetTop,
    offsetBottom,
    totalRows,
    totalHeight,
  }
}

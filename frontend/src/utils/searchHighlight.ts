/** 搜索列表键盘高亮；无结果时索引恒为 0，避免 `length - 1 === -1` 越界 */
export function adjustSearchHighlight(prev: number, delta: 1 | -1, resultCount: number): number {
  if (resultCount <= 0) return 0
  return Math.min(Math.max(prev + delta, 0), resultCount - 1)
}

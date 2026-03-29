import { describe, expect, it } from 'vitest'
import { adjustSearchHighlight } from '../../../utils/searchHighlight'

describe('SearchModal', () => {
  describe('adjustSearchHighlight', () => {
    it('无结果时按方向键高亮保持为 0（不落到 -1）', () => {
      expect(adjustSearchHighlight(0, 1, 0)).toBe(0)
      expect(adjustSearchHighlight(0, -1, 0)).toBe(0)
      let h = 0
      for (let i = 0; i < 5; i++) {
        h = adjustSearchHighlight(h, 1, 0)
        expect(h).toBe(0)
      }
    })
  })
})

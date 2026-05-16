import { describe, expect, it } from 'vitest'
import {
  applyBatchCategoryToRows,
  deriveImportCategoryOptions,
  normalizePasteForImport,
} from '@/lib/importHelpers'

describe('normalizePasteForImport', () => {
  it('wraps lemma - gloss lines as markdown bold entries', () => {
    const raw = 'confuse - v. 使困惑\npuzzle - v. 使迷惑'
    expect(normalizePasteForImport(raw)).toBe(
      '- **confuse** - v. 使困惑\n- **puzzle** - v. 使迷惑',
    )
  })

  it('preserves markdown headings', () => {
    expect(normalizePasteForImport('## 单词\nfoo - v. 条')).toBe('## 单词\n- **foo** - v. 条')
  })

  it('preserves lines that already use bold lemma', () => {
    expect(normalizePasteForImport('- **x** - v. y')).toBe('- **x** - v. y')
  })
})

describe('ImportModal category helpers', () => {
  it('keeps built-in categories and merges parsed custom categories', () => {
    const options = deriveImportCategoryOptions([
      { category: '未分类' },
      { category: '月份' },
      { category: '口语' },
    ])

    expect(options[0]).toBe('未分类')
    expect(options).toContain('口语')
    expect(options).toContain('月份')
  })

  it('applies selected category only to provided indexes', () => {
    const rows = [
      { content: 'january', translation: '一月', category: '月份' },
      { content: 'sugar', translation: '糖', category: '未分类' },
      { content: 'theater', translation: '剧场', category: '未分类' },
    ]

    const next = applyBatchCategoryToRows(rows, [1, 2], '单词')

    expect(next[0]?.category).toBe('月份')
    expect(next[1]?.category).toBe('单词')
    expect(next[2]?.category).toBe('单词')
  })
})

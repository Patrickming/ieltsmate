import { parseMarkdown } from '../src/import/import.parser'

describe('Import parser category detection', () => {
  it('uses ## heading as category for following entries', () => {
    const md = [
      '# 我的笔记',
      '## 月份',
      'January 一月',
      'February 二月',
    ].join('\n')

    const parsed = parseMarkdown(md)

    expect(parsed).toHaveLength(2)
    expect(parsed[0]?.category).toBe('月份')
    expect(parsed[1]?.category).toBe('月份')
  })
})

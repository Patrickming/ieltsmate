import type { Category } from '../data/mockData'

const IMPORT_BUILTIN_CATEGORIES: Array<Category | '未分类'> = [
  '未分类',
  '口语',
  '短语',
  '句子',
  '同义替换',
  '拼写',
  '单词',
  '写作',
]

export function deriveImportCategoryOptions(rows: Array<{ category: string }>): string[] {
  const customCategories = rows
    .map((row) => row.category?.trim())
    .filter((category): category is string => Boolean(category))

  return Array.from(new Set([...IMPORT_BUILTIN_CATEGORIES, ...customCategories]))
}

export function applyBatchCategoryToRows<T extends { category: string }>(
  rows: T[],
  targetIndexes: number[],
  category: string,
): T[] {
  if (!category.trim()) return rows
  const target = new Set(targetIndexes)
  return rows.map((row, idx) => (target.has(idx) ? { ...row, category } : row))
}

/**
 * 将「lemma - gloss」纯文本行转为解析器友好的 `- **lemma** - gloss`，便于保留词性与括号注释。
 */
export function normalizePasteForImport(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      if (/^#{1,6}\s/.test(trimmed)) return trimmed
      const prefixedBullet = /^[-*+]\s+/.test(trimmed)
      const body = prefixedBullet ? trimmed.replace(/^[-*+]\s+/, '').trim() : trimmed
      if (/^\*\*.+\*\*/.test(body)) {
        return prefixedBullet ? trimmed : `- ${body}`
      }
      const match = body.match(/^(.+?)\s+-\s+(.+)$/)
      if (match) {
        const lemma = match[1].trim()
        const gloss = match[2].trim()
        return `- **${lemma}** - ${gloss}`
      }
      return prefixedBullet ? trimmed : `- ${body}`
    })
    .join('\n')
}

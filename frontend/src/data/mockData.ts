// ── 类型定义 ──────────────────────────────────────────────────────
export type Category = '口语' | '短语' | '句子' | '同义替换' | '拼写' | '单词' | '写作'

export interface Note {
  id: string
  content: string
  translation: string
  category: Category
  subcategory: string
  phonetic?: string
  synonyms?: string[]
  antonyms?: string[]
  example?: string
  memoryTip?: string
  tags?: string[]
  createdAt: string
  reviewStatus: 'new' | 'learning' | 'mastered'
  nextReview?: string
  dueToday?: boolean
  reviewCount?: number
  correctCount?: number
  wrongCount?: number
  lastReview?: string
  userNotes?: string[]
}

// ── UI 配色常量 ────────────────────────────────────────────────────
export const CATEGORY_COLORS: Record<Category | string, { color: string; bg: string; border: string }> = {
  '口语':   { color: '#60a5fa', bg: '#0c2040', border: '#1e40af' },
  '短语':   { color: '#34d399', bg: '#0a2e1e', border: '#065f46' },
  '句子':   { color: '#fb7185', bg: '#2d0f18', border: '#9f1239' },
  '同义替换': { color: '#fbbf24', bg: '#2a1f0a', border: '#92400e' },
  '拼写':   { color: '#a78bfa', bg: '#1e1030', border: '#5b21b6' },
  '单词':   { color: '#22d3ee', bg: '#0a2530', border: '#0e7490' },
  '写作':   { color: '#f97316', bg: '#2a160a', border: '#9a3412' },
}

export const CATEGORY_BAR: Record<Category | string, string> = {
  '口语':   '#60a5fa',
  '短语':   '#34d399',
  '句子':   '#fb7185',
  '同义替换': '#fbbf24',
  '拼写':   '#a78bfa',
  '单词':   '#22d3ee',
  '写作':   '#f97316',
}

export const CATEGORIES: { name: Category; group: string }[] = [
  { name: '口语',   group: '杂笔记' },
  { name: '短语',   group: '杂笔记' },
  { name: '句子',   group: '杂笔记' },
  { name: '同义替换', group: '杂笔记' },
  { name: '拼写',   group: '杂笔记' },
  { name: '单词',   group: '杂笔记' },
  { name: '写作',   group: '写作'   },
]

// 保留空导出供测试文件引用，实际数据全部来自后端
export const mockNotes: Note[] = []

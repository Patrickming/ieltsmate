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
  tags?: string[]
  createdAt: string
  reviewStatus: 'new' | 'learning' | 'mastered'
  nextReview?: string
  dueToday?: boolean
}

export interface Provider {
  id: string
  name: string
  icon: string
  color: string
  connected: boolean
  apiKey?: string
  models: string[]
  selectedModel?: string
}

export const CATEGORY_COLORS: Record<Category | string, { color: string; bg: string; border: string }> = {
  '口语': { color: '#60a5fa', bg: '#0c2040', border: '#1e40af' },
  '短语': { color: '#34d399', bg: '#0a2e1e', border: '#065f46' },
  '句子': { color: '#fb7185', bg: '#2d0f18', border: '#9f1239' },
  '同义替换': { color: '#fbbf24', bg: '#2a1f0a', border: '#92400e' },
  '拼写': { color: '#a78bfa', bg: '#1e1030', border: '#5b21b6' },
  '单词': { color: '#22d3ee', bg: '#0a2530', border: '#0e7490' },
  '写作': { color: '#f97316', bg: '#2a160a', border: '#9a3412' },
}

export const CATEGORY_BAR: Record<Category | string, string> = {
  '口语': '#60a5fa',
  '短语': '#34d399',
  '句子': '#fb7185',
  '同义替换': '#fbbf24',
  '拼写': '#a78bfa',
  '单词': '#22d3ee',
  '写作': '#f97316',
}

export const CATEGORIES: { name: Category; group: string }[] = [
  { name: '口语', group: '杂笔记' },
  { name: '短语', group: '杂笔记' },
  { name: '句子', group: '杂笔记' },
  { name: '同义替换', group: '杂笔记' },
  { name: '拼写', group: '杂笔记' },
  { name: '单词', group: '杂笔记' },
  { name: '写作', group: '写作' },
]

export const mockNotes: Note[] = [
  {
    id: '1',
    content: 'get out of',
    translation: '避免；逃避（做某事）',
    category: '短语',
    subcategory: '杂笔记',
    phonetic: '/ɡet aʊt ɒv/',
    synonyms: ['avoid doing sth', 'escape from', 'refrain from'],
    antonyms: ['get into', 'engage in'],
    example: 'He tried to get out of doing the dishes.',
    createdAt: '今天',
    reviewStatus: 'new',
    dueToday: true,
  },
  {
    id: '2',
    content: 'absolutely',
    translation: '绝对地（置于句末加强语气）',
    category: '口语',
    subcategory: '杂笔记',
    phonetic: '/ˌæbsəˈluːtli/',
    synonyms: ['certainly', 'definitely', 'of course'],
    example: '"Did you enjoy it?" "Absolutely!"',
    createdAt: '今天',
    reviewStatus: 'learning',
    dueToday: true,
  },
  {
    id: '3',
    content: 'convincing = persuasive',
    translation: '令人信服的',
    category: '同义替换',
    subcategory: '杂笔记',
    synonyms: ['compelling', 'credible', 'believable'],
    example: 'She made a convincing argument for the proposal.',
    createdAt: '昨天',
    reviewStatus: 'learning',
    dueToday: false,
  },
  {
    id: '4',
    content: 'assumption',
    translation: '假设；假定；担任',
    category: '拼写',
    subcategory: '杂笔记',
    phonetic: '/əˈsʌmpʃən/',
    example: 'Do not make assumptions about people.',
    createdAt: '昨天',
    reviewStatus: 'mastered',
    dueToday: false,
  },
  {
    id: '5',
    content: 'deteriorate',
    translation: '恶化；变坏',
    category: '单词',
    subcategory: '杂笔记',
    phonetic: '/dɪˈtɪəriəreɪt/',
    synonyms: ['worsen', 'decline', 'degrade'],
    example: 'Her health began to deteriorate rapidly.',
    createdAt: '2天前',
    reviewStatus: 'new',
    dueToday: true,
  },
  {
    id: '6',
    content: 'On the one hand... on the other hand',
    translation: '一方面……另一方面（写作连接词）',
    category: '句子',
    subcategory: '杂笔记',
    example: 'On the one hand, technology saves time. On the other hand, it can be addictive.',
    createdAt: '3天前',
    reviewStatus: 'learning',
    dueToday: true,
  },
  {
    id: '7',
    content: 'In conclusion, it is evident that',
    translation: '总而言之，显而易见（写作结尾句式）',
    category: '写作',
    subcategory: '写作',
    example: 'In conclusion, it is evident that climate change requires immediate action.',
    createdAt: '3天前',
    reviewStatus: 'new',
    dueToday: false,
  },
  {
    id: '8',
    content: 'phenomenal',
    translation: '非凡的；惊人的',
    category: '单词',
    subcategory: '杂笔记',
    phonetic: '/fɪˈnɒmɪnəl/',
    synonyms: ['extraordinary', 'remarkable', 'outstanding'],
    createdAt: '4天前',
    reviewStatus: 'mastered',
    dueToday: false,
  },
  {
    id: '9',
    content: 'under the circumstances',
    translation: '在这种情况下',
    category: '短语',
    subcategory: '杂笔记',
    synonyms: ['given the situation', 'in this case', 'considering everything'],
    createdAt: '5天前',
    reviewStatus: 'learning',
    dueToday: true,
  },
]

export const mockStats = {
  dueToday: 12,
  mastered: 86,
  streak: 7,
  total: 234,
}

export const mockProviders: Provider[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: 'git-branch',
    color: '#60a5fa',
    connected: true,
    models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-pro'],
    selectedModel: 'anthropic/claude-3.5-sonnet',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    icon: 'zap',
    color: '#818cf8',
    connected: true,
    models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct'],
    selectedModel: 'deepseek-ai/DeepSeek-V3',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: 'sparkles',
    color: '#34d399',
    connected: true,
    models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    selectedModel: 'gemini-2.0-flash',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: 'brain',
    color: '#fb7185',
    connected: false,
    models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  },
]

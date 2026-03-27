import { create } from 'zustand'
import type { Note, Category } from '../data/mockData'
import { mockNotes } from '../data/mockData'

interface ReviewSession {
  cards: Note[]
  current: number
  results: { id: string; rating: 'easy' | 'hard' | 'again' }[]
}

export interface ProviderConfig {
  id: string
  name: string
  displayName: string
  apiKey: string
  baseUrl: string
  models: { id: string; verified: boolean }[]
  presetId: string
  color: string
  selectedModel?: string
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'p1', name: 'SiliconFlow', displayName: 'SiliconFlow',
    apiKey: 'sk-jhyeofdhmibwjesijkipkwihboldvghwcmnjlzjuuemivmdm',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: [{ id: 'Pro/zai-org/GLM-5', verified: true }, { id: 'Pro/moonshotai/Kimi-K2.5', verified: false }],
    presetId: 'siliconflow', color: '#818cf8', selectedModel: 'Pro/zai-org/GLM-5',
  },
  {
    id: 'p2', name: 'OpenRouter', displayName: 'OpenRouter',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [{ id: 'anthropic/claude-3.5-sonnet', verified: true }],
    presetId: 'openrouter', color: '#60a5fa', selectedModel: 'anthropic/claude-3.5-sonnet',
  },
  {
    id: 'p3', name: 'Google Gemini', displayName: 'Google Gemini',
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [{ id: 'gemini-2.0-flash', verified: true }],
    presetId: 'gemini', color: '#fbbf24', selectedModel: 'gemini-2.0-flash',
  },
  {
    id: 'p4', name: 'Anthropic', displayName: 'Anthropic',
    apiKey: '',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [],
    presetId: 'anthropic', color: '#fb7185',
  },
]

interface AppState {
  // Theme
  theme: 'dark' | 'light'
  setTheme: (t: 'dark' | 'light') => void

  // Providers (shared between Settings and AIModelConfigModal)
  providers: ProviderConfig[]
  setProviders: (p: ProviderConfig[]) => void

  // Notes
  notes: Note[]
  selectedNote: Note | null
  setSelectedNote: (note: Note | null) => void

  // Modals
  showQuickNote: boolean
  showSearch: boolean
  showAIPanel: boolean
  showAIConfig: boolean
  showImport: boolean
  openQuickNote: () => void
  closeQuickNote: () => void
  openSearch: () => void
  closeSearch: () => void
  openAIPanel: () => void
  closeAIPanel: () => void
  openAIConfig: () => void
  closeAIConfig: () => void
  openImport: () => void
  closeImport: () => void
  closeAll: () => void

  // Sidebar
  expandedGroups: string[]
  toggleGroup: (group: string) => void

  // Filter
  activeFilter: Category | '全部'
  setFilter: (cat: Category | '全部') => void

  // Review session
  reviewSession: ReviewSession | null
  startReview: (cards: Note[]) => void
  nextCard: () => void
  rateCard: (id: string, rating: 'easy' | 'hard' | 'again') => void
  endReview: () => void
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'dark',
  setTheme: (t) => {
    document.documentElement.classList.toggle('light', t === 'light')
    set({ theme: t })
  },

  providers: DEFAULT_PROVIDERS,
  setProviders: (p) => set({ providers: p }),

  notes: mockNotes,
  selectedNote: null,
  setSelectedNote: (note) => set({ selectedNote: note }),

  showQuickNote: false,
  showSearch: false,
  showAIPanel: false,
  showAIConfig: false,
  showImport: false,

  openQuickNote: () => set({ showQuickNote: true }),
  closeQuickNote: () => set({ showQuickNote: false }),
  openSearch: () => set({ showSearch: true }),
  closeSearch: () => set({ showSearch: false }),
  openAIPanel: () => set({ showAIPanel: true }),
  closeAIPanel: () => set({ showAIPanel: false }),
  openAIConfig: () => set({ showAIConfig: true }),
  closeAIConfig: () => set({ showAIConfig: false }),
  openImport: () => set({ showImport: true }),
  closeImport: () => set({ showImport: false }),
  closeAll: () => set({
    showQuickNote: false,
    showSearch: false,
    showAIPanel: false,
    showAIConfig: false,
    showImport: false,
  }),

  expandedGroups: ['杂笔记'],
  toggleGroup: (group) => set((s) => ({
    expandedGroups: s.expandedGroups.includes(group)
      ? s.expandedGroups.filter((g) => g !== group)
      : [...s.expandedGroups, group],
  })),

  activeFilter: '全部',
  setFilter: (cat) => set({ activeFilter: cat }),

  reviewSession: null,
  startReview: (cards) => set({ reviewSession: { cards, current: 0, results: [] } }),
  nextCard: () => set((s) => {
    if (!s.reviewSession) return s
    return { reviewSession: { ...s.reviewSession, current: s.reviewSession.current + 1 } }
  }),
  rateCard: (id, rating) => set((s) => {
    if (!s.reviewSession) return s
    return {
      reviewSession: {
        ...s.reviewSession,
        results: [...s.reviewSession.results, { id, rating }],
      },
    }
  }),
  endReview: () => set({ reviewSession: null }),
}))

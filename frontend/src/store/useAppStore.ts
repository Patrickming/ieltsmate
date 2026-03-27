import { create } from 'zustand'
import type { Note, Category } from '../data/mockData'
import { mockNotes } from '../data/mockData'

interface ReviewSession {
  cards: Note[]
  current: number
  results: { id: string; rating: 'easy' | 'hard' | 'again' }[]
}

interface AppState {
  // Notes
  notes: Note[]
  selectedNote: Note | null
  setSelectedNote: (note: Note | null) => void

  // Modals
  showQuickNote: boolean
  showSearch: boolean
  showAIPanel: boolean
  showAIConfig: boolean
  openQuickNote: () => void
  closeQuickNote: () => void
  openSearch: () => void
  closeSearch: () => void
  openAIPanel: () => void
  closeAIPanel: () => void
  openAIConfig: () => void
  closeAIConfig: () => void
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
  notes: mockNotes,
  selectedNote: null,
  setSelectedNote: (note) => set({ selectedNote: note }),

  showQuickNote: false,
  showSearch: false,
  showAIPanel: false,
  showAIConfig: false,

  openQuickNote: () => set({ showQuickNote: true }),
  closeQuickNote: () => set({ showQuickNote: false }),
  openSearch: () => set({ showSearch: true }),
  closeSearch: () => set({ showSearch: false }),
  openAIPanel: () => set({ showAIPanel: true }),
  closeAIPanel: () => set({ showAIPanel: false }),
  openAIConfig: () => set({ showAIConfig: true }),
  closeAIConfig: () => set({ showAIConfig: false }),
  closeAll: () => set({
    showQuickNote: false,
    showSearch: false,
    showAIPanel: false,
    showAIConfig: false,
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

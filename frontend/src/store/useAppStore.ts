import { create } from 'zustand'
import type { Note, Category } from '../data/mockData'
import { mockNotes } from '../data/mockData'
import { apiUrl } from '../lib/apiBase'

interface BackendNote {
  id: string
  content: string
  translation: string
  category: string
  phonetic: string | null
  synonyms: string[]
  antonyms: string[]
  example: string | null
  memoryTip: string | null
  reviewStatus: 'new' | 'learning' | 'mastered'
  reviewCount: number
  correctCount: number
  wrongCount: number
  createdAt: string
}

function formatNoteDate(isoStr: string): string {
  const now = new Date()
  const d = new Date(isoStr)
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays}天前`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 5) return `${diffWeeks}周前`
  const diffMonths = Math.floor(diffDays / 30)
  return `${diffMonths}个月前`
}

function mapBackendNote(n: BackendNote): Note {
  return {
    id: n.id,
    content: n.content,
    translation: n.translation,
    category: n.category as Category,
    subcategory: '杂笔记',
    phonetic: n.phonetic ?? undefined,
    synonyms: n.synonyms ?? [],
    antonyms: n.antonyms ?? [],
    example: n.example ?? undefined,
    memoryTip: n.memoryTip ?? undefined,
    createdAt: formatNoteDate(n.createdAt),
    reviewStatus: n.reviewStatus ?? 'new',
    reviewCount: n.reviewCount ?? 0,
    correctCount: n.correctCount ?? 0,
    wrongCount: n.wrongCount ?? 0,
  }
}

function safeReadFavorites(): string[] {
  try {
    const raw = localStorage.getItem('ielts-favorites')
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    return []
  }
}

interface ReviewSession {
  cards: Note[]
  current: number
  results: { id: string; rating: 'easy' | 'hard' | 'again' }[]
}

type AddNoteInput = {
  content: string
  translation: string
  category: Category
}

type AddQuickNoteResult = {
  source: 'remote' | 'local'
}

const QUICK_NOTE_REQUEST_TIMEOUT_MS = 4000

export interface ProviderConfig {
  id: string
  name: string
  displayName: string
  apiKey: string
  baseUrl: string
  models: { id: string; verified: boolean; isThinking: boolean; isVision: boolean }[]
  presetId: string
  color: string
  selectedModel?: string
}

interface BackendAiProvider {
  id: string
  name: string
  displayName: string
  presetId: string
  color: string
  baseUrl: string
  apiKey: string
  sortOrder: number
  models: { id: string; providerId: string; modelId: string; verified: boolean; isThinking: boolean; isVision: boolean }[]
}

function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

function mapBackendProvider(p: BackendAiProvider): ProviderConfig {
  return {
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    presetId: p.presetId,
    color: p.color,
    baseUrl: p.baseUrl,
    apiKey: p.apiKey,
    models: p.models.map((m) => ({
      id: m.modelId,
      verified: m.verified,
      isThinking: m.isThinking,
      isVision: m.isVision,
    })),
    selectedModel: p.models.find((m) => m.verified)?.modelId ?? p.models[0]?.modelId,
  }
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'p1', name: 'SiliconFlow', displayName: 'SiliconFlow',
    apiKey: '',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: [{ id: 'Pro/zai-org/GLM-5', verified: true, isThinking: false, isVision: false }, { id: 'Pro/moonshotai/Kimi-K2.5', verified: false, isThinking: false, isVision: false }],
    presetId: 'siliconflow', color: '#818cf8', selectedModel: 'Pro/zai-org/GLM-5',
  },
  {
    id: 'p2', name: 'OpenRouter', displayName: 'OpenRouter',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [{ id: 'anthropic/claude-3.5-sonnet', verified: true, isThinking: false, isVision: true }],
    presetId: 'openrouter', color: '#60a5fa', selectedModel: 'anthropic/claude-3.5-sonnet',
  },
  {
    id: 'p3', name: 'Google Gemini', displayName: 'Google Gemini',
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [{ id: 'gemini-2.0-flash', verified: true, isThinking: false, isVision: true }],
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
  providersLoaded: boolean
  setProviders: (p: ProviderConfig[] | ((prev: ProviderConfig[]) => ProviderConfig[])) => void
  loadProviders: () => Promise<void>
  syncProviderToBackend: (provider: ProviderConfig) => Promise<void>
  createProviderInBackend: (provider: ProviderConfig) => Promise<string | null>
  deleteProviderFromBackend: (id: string) => Promise<void>
  addModelToBackend: (providerId: string, modelId: string) => Promise<void>
  removeModelFromBackend: (providerId: string, modelId: string) => Promise<void>
  updateModelFlags: (providerId: string, modelId: string, flags: { isThinking?: boolean; isVision?: boolean }) => Promise<void>
  testModelInBackend: (providerId: string, modelId: string) => Promise<{ ok: boolean; error?: string }>

  // Settings
  settingsLoaded: boolean
  loadSettings: () => Promise<void>
  saveSettings: (patch: Record<string, string>) => Promise<void>
  classifyModel: string
  reviewModel: string
  chatModel: string
  setModelSlot: (slot: 'classify' | 'review' | 'chat', model: string) => Promise<void>

  // Notes
  notes: Note[]
  notesLoaded: boolean
  loadNotes: () => Promise<void>
  deleteNote: (id: string) => Promise<boolean>
  updateNote: (id: string, patch: { content?: string; translation?: string; category?: Category }) => Promise<boolean>
  selectedNote: Note | null
  setSelectedNote: (note: Note | null) => void
  addQuickNote: (input: AddNoteInput) => Promise<AddQuickNoteResult>
  lastAddedNoteId: string | null
  clearLastAddedNoteId: () => void

  // Favorites
  favorites: string[]
  toggleFavorite: (id: string) => Promise<void>
  syncFavorites: () => Promise<void>

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

export const useAppStore = create<AppState>((set, get) => {
  // Internal helper: ensure a provider has a real UUID in the backend.
  // If the provider only has a temp ID (e.g. "p1"), it creates the provider in
  // the backend, updates the store with the real UUID, and returns that UUID.
  const ensureProviderUUID = async (providerOrId: ProviderConfig | string): Promise<string | null> => {
    const provider = typeof providerOrId === 'string'
      ? get().providers.find((p) => p.id === providerOrId)
      : providerOrId
    if (!provider) return null
    if (isUUID(provider.id)) return provider.id

    // Not a UUID — create in backend
    try {
      const res = await fetch(apiUrl('/ai/providers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: provider.name,
          displayName: provider.displayName,
          presetId: provider.presetId,
          color: provider.color,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
        }),
      })
      if (!res.ok) return null
      const json = (await res.json()) as { data?: { id: string } }
      const realId = json.data?.id
      if (!realId) return null
      // Replace temp ID with real UUID in the store
      set((s) => ({
        providers: s.providers.map((p) => p.id === provider.id ? { ...p, id: realId } : p),
      }))
      return realId
    } catch { return null }
  }

  return ({
  theme: 'dark',
  setTheme: (t) => {
    document.documentElement.classList.toggle('light', t === 'light')
    set({ theme: t })
    void fetch(apiUrl('/settings'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { theme: t } }),
    }).catch(() => { /* 静默 */ })
  },

  providers: DEFAULT_PROVIDERS,
  providersLoaded: false,

  setProviders: (p) =>
    set((s) => ({ providers: typeof p === 'function' ? p(s.providers) : p })),

  loadProviders: async () => {
    try {
      const res = await fetch(apiUrl('/ai/providers'))
      if (!res.ok) return
      const json = (await res.json()) as { data?: { items?: BackendAiProvider[] } }
      const items = json.data?.items
      if (!Array.isArray(items) || items.length === 0) return
      set({ providers: items.map(mapBackendProvider), providersLoaded: true })
    } catch { /* 静默失败，保留默认 providers */ }
  },

  syncProviderToBackend: async (provider) => {
    // Lazily provision the provider in the backend if it only has a temp ID
    let id = provider.id
    if (!isUUID(id)) {
      const realId = await ensureProviderUUID(provider)
      if (!realId) return
      // Also add any pre-existing models from DEFAULT_PROVIDERS
      for (const m of provider.models) {
        await fetch(apiUrl(`/ai/providers/${realId}/models`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId: m.id }),
        }).catch(() => null)
      }
      id = realId
    }
    try {
      await fetch(apiUrl(`/ai/providers/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: provider.displayName,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          color: provider.color,
        }),
      })
    } catch { /* 静默 */ }
  },

  createProviderInBackend: async (provider) => {
    try {
      const res = await fetch(apiUrl('/ai/providers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: provider.name,
          displayName: provider.displayName,
          presetId: provider.presetId,
          color: provider.color,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
        }),
      })
      if (!res.ok) return null
      const json = (await res.json()) as { data?: { id: string } }
      return json.data?.id ?? null
    } catch { return null }
  },

  deleteProviderFromBackend: async (id) => {
    try {
      await fetch(apiUrl(`/ai/providers/${id}`), { method: 'DELETE' })
    } catch { /* 静默 */ }
  },

  addModelToBackend: async (providerId, modelId) => {
    let id = providerId
    if (!isUUID(id)) {
      const realId = await ensureProviderUUID(id)
      if (!realId) return
      id = realId
    }
    try {
      await fetch(apiUrl(`/ai/providers/${id}/models`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      })
    } catch { /* 静默 */ }
  },

  removeModelFromBackend: async (providerId, modelId) => {
    try {
      await fetch(
        apiUrl(`/ai/providers/${providerId}/models/${encodeURIComponent(modelId)}`),
        { method: 'DELETE' },
      )
    } catch { /* 静默 */ }
  },

  updateModelFlags: async (providerId, modelId, flags) => {
    // Optimistic local update
    set((s) => ({
      providers: s.providers.map((p) =>
        p.id === providerId
          ? { ...p, models: p.models.map((m) => m.id === modelId ? { ...m, ...flags } : m) }
          : p,
      ),
    }))
    try {
      await fetch(
        apiUrl(`/ai/providers/${providerId}/models/${encodeURIComponent(modelId)}`),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(flags),
        },
      )
    } catch { /* 静默 */ }
  },

  testModelInBackend: async (providerId, modelId) => {
    // Ensure provider has a real UUID in the backend
    let id = providerId
    if (!isUUID(id)) {
      const provider = get().providers.find((p) => p.id === providerId)
      if (!provider) return { ok: false, error: 'Provider not found' }
      const realId = await ensureProviderUUID(provider)
      if (!realId) return { ok: false, error: 'Failed to provision provider in backend' }
      id = realId
    }
    // Ensure the model exists in the backend (upsert-style, ignore if already exists)
    await fetch(apiUrl(`/ai/providers/${id}/models`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId }),
    }).catch(() => null)

    try {
      const res = await fetch(
        apiUrl(`/ai/providers/${id}/models/${encodeURIComponent(modelId)}/test`),
        { method: 'POST' },
      )
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        return { ok: false, error: `HTTP ${res.status}: ${errText.slice(0, 300)}` }
      }
      const json = (await res.json()) as { data?: { ok: boolean; error?: string } }
      return json.data ?? { ok: false, error: 'No response' }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  },

  settingsLoaded: false,
  classifyModel: '',
  reviewModel: '',
  chatModel: '',

  loadSettings: async () => {
    try {
      const res = await fetch(apiUrl('/settings'))
      if (!res.ok) return
      const json = (await res.json()) as { data?: Record<string, string> }
      const s = json.data ?? {}
      set({
        settingsLoaded: true,
        ...(s['theme'] ? { theme: s['theme'] as 'dark' | 'light' } : {}),
        classifyModel: s['classifyModel'] ?? '',
        reviewModel: s['reviewModel'] ?? '',
        chatModel: s['chatModel'] ?? '',
      })
      if (s['theme']) {
        document.documentElement.classList.toggle('light', s['theme'] === 'light')
      }
    } catch { /* 静默 */ }
  },

  saveSettings: async (patch) => {
    try {
      await fetch(apiUrl('/settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: patch }),
      })
    } catch { /* 静默 */ }
  },

  setModelSlot: async (slot, model) => {
    const key = `${slot}Model` as 'classifyModel' | 'reviewModel' | 'chatModel'
    set({ [key]: model })
    try {
      await fetch(apiUrl('/settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { [`${slot}Model`]: model } }),
      })
    } catch { /* 静默 */ }
  },

  notes: mockNotes,
  notesLoaded: false,
  loadNotes: async () => {
    try {
      const res = await fetch(apiUrl('/notes'))
      if (!res.ok) return
      const json = (await res.json()) as { data?: { items?: BackendNote[] } }
      const items = json.data?.items
      if (!Array.isArray(items)) return
      set({ notes: items.map(mapBackendNote), notesLoaded: true })
    } catch {
      // 静默失败，保留 mock 数据
    }
  },
  deleteNote: async (id) => {
    try {
      const res = await fetch(apiUrl(`/notes/${id}`), { method: 'DELETE' })
      if (!res.ok) return false
      set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }))
      return true
    } catch {
      return false
    }
  },
  updateNote: async (id, patch) => {
    try {
      const res = await fetch(apiUrl(`/notes/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) return false
      const json = (await res.json()) as { data?: BackendNote }
      const updated = json.data
      if (!updated?.id) return false
      set((s) => ({
        notes: s.notes.map((n) => n.id === id ? mapBackendNote(updated) : n),
      }))
      return true
    } catch {
      return false
    }
  },
  selectedNote: null,
  setSelectedNote: (note) => set({ selectedNote: note }),
  lastAddedNoteId: null,
  clearLastAddedNoteId: () => set({ lastAddedNoteId: null }),
  addQuickNote: async (input) => {
    const applyLocal = () => {
      const localNote: Note = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        content: input.content,
        translation: input.translation,
        category: input.category,
        subcategory: '杂笔记',
        createdAt: '刚刚',
        reviewStatus: 'new',
        reviewCount: 0,
        correctCount: 0,
        wrongCount: 0,
      }
      set((s) => {
        return { notes: [localNote, ...s.notes], lastAddedNoteId: localNote.id }
      })
      return { source: 'local' as const }
    }

    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), QUICK_NOTE_REQUEST_TIMEOUT_MS)
      let res: Response
      try {
        res = await fetch(apiUrl('/notes'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal: controller.signal,
        })
      } finally {
        window.clearTimeout(timeout)
      }
      if (!res.ok) {
        return applyLocal()
      }
      const json = (await res.json()) as {
        data?: {
          id: string
          content: string
          translation: string
          category: string
          phonetic?: string | null
          synonyms?: string[]
          antonyms?: string[]
          example?: string | null
          memoryTip?: string | null
          reviewStatus?: 'new' | 'learning' | 'mastered'
          reviewCount?: number
          correctCount?: number
          wrongCount?: number
        }
      }
      const n = json.data
      if (!n?.id) {
        return applyLocal()
      }
      const created: Note = {
        id: n.id,
        content: n.content,
        translation: n.translation,
        category: (n.category as Category) ?? input.category,
        subcategory: '杂笔记',
        phonetic: n.phonetic ?? undefined,
        synonyms: n.synonyms ?? [],
        antonyms: n.antonyms ?? [],
        example: n.example ?? undefined,
        memoryTip: n.memoryTip ?? undefined,
        createdAt: '刚刚',
        reviewStatus: n.reviewStatus ?? 'new',
        reviewCount: n.reviewCount ?? 0,
        correctCount: n.correctCount ?? 0,
        wrongCount: n.wrongCount ?? 0,
      }
      set((s) => ({ notes: [created, ...s.notes], lastAddedNoteId: created.id }))
      return { source: 'remote' as const }
    } catch {
      return applyLocal()
    }
  },

  favorites: safeReadFavorites(),

  syncFavorites: async () => {
    try {
      const res = await fetch(apiUrl('/favorites'))
      if (!res.ok) return
      const json = (await res.json()) as { data?: { items?: { id: string }[] } }
      const items = json.data?.items
      if (!Array.isArray(items)) return
      const ids = items.map((i) => i.id).filter(Boolean)
      localStorage.setItem('ielts-favorites', JSON.stringify(ids))
      set({ favorites: ids })
    } catch {
      /* 静默失败，保留本地 favorites */
    }
  },

  toggleFavorite: async (id) => {
    const applyLocalToggle = () => {
      set((s) => {
        const next = s.favorites.includes(id)
          ? s.favorites.filter((f) => f !== id)
          : [...s.favorites, id]
        localStorage.setItem('ielts-favorites', JSON.stringify(next))
        return { favorites: next }
      })
    }

    try {
      const res = await fetch(apiUrl('/favorites/toggle'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: id }),
      })
      if (!res.ok) {
        applyLocalToggle()
        return
      }
      let json: { data?: { noteId: string; isFavorite: boolean } }
      try {
        json = (await res.json()) as { data?: { noteId: string; isFavorite: boolean } }
      } catch {
        applyLocalToggle()
        return
      }
      const data = json.data
      if (!data || data.noteId !== id) {
        applyLocalToggle()
        return
      }
      set((s) => {
        const next = data.isFavorite
          ? s.favorites.includes(id)
            ? s.favorites
            : [...s.favorites, id]
          : s.favorites.filter((f) => f !== id)
        localStorage.setItem('ielts-favorites', JSON.stringify(next))
        return { favorites: next }
      })
    } catch {
      applyLocalToggle()
    }
  },

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
  })
})

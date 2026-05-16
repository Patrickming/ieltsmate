import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { LoadingState } from './components/ui/LoadingState'
import { useAppStore } from './store/useAppStore'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'))
const KnowledgeDetail = lazy(() => import('./pages/KnowledgeDetail'))
const WritingNoteDetail = lazy(() => import('./pages/WritingNoteDetail'))
const ReviewSelection = lazy(() => import('./pages/ReviewSelection'))
const ReviewCards = lazy(() => import('./pages/ReviewCards'))
const ReviewSummary = lazy(() => import('./pages/ReviewSummary'))
const Settings = lazy(() => import('./pages/Settings'))

const QuickNoteModal = lazy(() =>
  import('./components/modals/QuickNoteModal').then((m) => ({ default: m.QuickNoteModal }))
)
const SearchModal = lazy(() =>
  import('./components/modals/SearchModal').then((m) => ({ default: m.SearchModal }))
)
const AIPanel = lazy(() =>
  import('./components/modals/AIPanel').then((m) => ({ default: m.AIPanel }))
)
const AIModelConfigModal = lazy(() =>
  import('./components/modals/AIModelConfigModal').then((m) => ({ default: m.AIModelConfigModal }))
)
const ImportModal = lazy(() =>
  import('./components/modals/ImportModal').then((m) => ({ default: m.ImportModal }))
)

function GlobalShortcuts() {
  const location = useLocation()
  const openSearch = useAppStore((s) => s.openSearch)
  const openAIPanel = useAppStore((s) => s.openAIPanel)
  const closeAll = useAppStore((s) => s.closeAll)
  const showSearch = useAppStore((s) => s.showSearch)
  const showAIPanel = useAppStore((s) => s.showAIPanel)
  const showQuickNote = useAppStore((s) => s.showQuickNote)
  const showAIConfig = useAppStore((s) => s.showAIConfig)
  const showImport = useAppStore((s) => s.showImport)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K → search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (showSearch) closeAll()
        else openSearch()
        return
      }
      // Ctrl+/ → AI panel
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault()
        if (showAIPanel) closeAll()
        else openAIPanel()
        return
      }
      // Escape → close topmost
      if (e.key === 'Escape') {
        if (showSearch || showQuickNote || showAIConfig || showAIPanel || showImport) {
          closeAll()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [location, showSearch, showAIPanel, showQuickNote, showAIConfig, showImport, openSearch, openAIPanel, closeAll])

  return null
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/kb" element={<KnowledgeBase />} />
        <Route path="/kb/w/:id" element={<WritingNoteDetail />} />
        <Route path="/kb/:id" element={<KnowledgeDetail />} />
        <Route path="/review" element={<ReviewSelection />} />
        <Route path="/review/cards" element={<ReviewCards />} />
        <Route path="/review/summary" element={<ReviewSummary />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </AnimatePresence>
  )
}

function AppInner() {
  const showSearch = useAppStore((s) => s.showSearch)
  const showQuickNote = useAppStore((s) => s.showQuickNote)
  const showAIConfig = useAppStore((s) => s.showAIConfig)
  const showImport = useAppStore((s) => s.showImport)
  const syncFavorites = useAppStore((s) => s.syncFavorites)
  const loadNotes = useAppStore((s) => s.loadNotes)
  const loadWritingNotes = useAppStore((s) => s.loadWritingNotes)
  const loadProviders = useAppStore((s) => s.loadProviders)
  const loadSettings = useAppStore((s) => s.loadSettings)

  useEffect(() => {
    void loadSettings?.()
    void loadProviders?.()
    void loadNotes()
    void syncFavorites()
    void loadWritingNotes()
  }, [loadSettings, loadProviders, loadNotes, syncFavorites, loadWritingNotes])

  return (
    <>
      <GlobalShortcuts />
      <Suspense fallback={<LoadingState />}>
        <AnimatedRoutes />
      </Suspense>
      <Suspense fallback={null}>
        {showQuickNote && <QuickNoteModal />}
        {showSearch && <SearchModal />}
        <AIPanel />
        {showAIConfig && <AIModelConfigModal />}
        {showImport && <ImportModal />}
      </Suspense>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}

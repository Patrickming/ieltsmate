import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Dashboard from './pages/Dashboard'
import KnowledgeBase from './pages/KnowledgeBase'
import KnowledgeDetail from './pages/KnowledgeDetail'
import WritingNoteDetail from './pages/WritingNoteDetail'
import ReviewSelection from './pages/ReviewSelection'
import ReviewCards from './pages/ReviewCards'
import ReviewSummary from './pages/ReviewSummary'
import Settings from './pages/Settings'
import { useAppStore } from './store/useAppStore'

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
  const { openSearch, openAIPanel, closeAll, showSearch, showAIPanel, showQuickNote, showAIConfig, showImport } = useAppStore()

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
  const { showSearch, showQuickNote, showAIPanel, showAIConfig, showImport, syncFavorites } =
    useAppStore()

  useEffect(() => {
    void syncFavorites()
  }, [syncFavorites])

  return (
    <>
      <GlobalShortcuts />
      <AnimatedRoutes />
      <Suspense fallback={null}>
        {showQuickNote && <QuickNoteModal />}
        {showSearch && <SearchModal />}
        {showAIPanel && <AIPanel />}
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

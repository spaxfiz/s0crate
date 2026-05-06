import { useState, useEffect } from 'react'
import { useSessionStore } from './stores/sessionStore'
import { useSettingsStore } from './stores/settingsStore'
import { HomeView } from './components/HomeView'
import { ChatView } from './components/ChatView'
import { ForkView } from './components/Fork/ForkView'
import { BottomNav } from './components/BottomNav'
import { DrawerNav } from './components/DrawerNav'
import { SettingsModal } from './components/Settings/SettingsModal'
import { api } from './lib/api'

type View = 'home' | 'chat' | 'fork'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [backendError, setBackendError] = useState<string | null>(null)
  const { current, loadSessions, loadSession, createSession } = useSessionStore()
  const { isOpen, load: loadSettings } = useSettingsStore()

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    const load = () => {
      api.health()
        .then(() => {
          if (cancelled) return
          setBackendError(null)
          return Promise.all([loadSessions(), loadSettings()])
        })
        .catch((error: unknown) => {
          if (cancelled) return
          const message = error instanceof Error ? error.message : String(error)
          setBackendError(`后端连接中断，正在重试：${message}`)
          timer = window.setTimeout(load, 1000)
        })
    }

    load()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [loadSessions, loadSettings])

  const handleNewSession = () => {
    setView('home')
  }

  const handleStartSession = async (question: string) => {
    await createSession(question)
    setView('chat')
  }

  const handleOpenSession = async (id: string) => {
    await loadSession(id)
    setView('chat')
    setDrawerOpen(false)
  }

  const handleNavigate = (nodeId: string) => {
    useSessionStore.getState().navigateToNode(nodeId)
    setView('chat')
    setDrawerOpen(false)
  }

  const handleOpenDrawer = () => {
    window.scrollTo({ top: 0, left: 0 })
    document.scrollingElement?.scrollTo({ top: 0, left: 0 })
    setDrawerOpen(true)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {backendError && (
        <div style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: 12,
          zIndex: 50,
          padding: '10px 14px',
          border: '1px solid var(--crimson)',
          background: 'var(--paper)',
          color: 'var(--crimson)',
          fontFamily: 'var(--sans)',
          fontSize: 13,
          borderRadius: 4,
        }}>
          {backendError}
        </div>
      )}

      <main style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {view === 'home' && (
          <HomeView onStartSession={handleStartSession} onOpenSession={handleOpenSession} />
        )}
        {view === 'chat' && current && <ChatView onOpenDrawer={handleOpenDrawer} onOpenFork={() => setView('fork')} />}
        {view === 'fork' && current && <ForkView onBack={() => setView('chat')} />}
        {view === 'chat' && !current && (
          <HomeView onStartSession={handleStartSession} onOpenSession={handleOpenSession} />
        )}
      </main>

      <BottomNav
        view={view}
        setView={setView}
        onOpenDrawer={handleOpenDrawer}
      />

      {drawerOpen && (
        <DrawerNav
          onNavigate={handleNavigate}
          onNewSession={handleNewSession}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {isOpen && <SettingsModal />}
    </div>
  )
}

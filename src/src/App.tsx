import { useState, useEffect } from 'react'
import { useSessionStore } from './stores/sessionStore'
import { useSettingsStore } from './stores/settingsStore'
import { Sidebar } from './components/Sidebar/Sidebar'
import { HomeView } from './components/HomeView'
import { ChatView } from './components/Chat/ChatView'
import { MapView } from './components/MapView'
import { SettingsModal } from './components/Settings/SettingsModal'
import { api } from './lib/api'

type View = 'home' | 'chat' | 'map'

export default function App() {
  const [view, setView] = useState<View>('home')
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

  const handleNewSession = async () => {
    setView('home')
  }

  const handleStartSession = async (question: string) => {
    await createSession(question)
    setView('chat')
  }

  const handleOpenSession = async (id: string) => {
    await loadSession(id)
    setView('chat')
  }

  const handleNavigate = (nodeId: string) => {
    useSessionStore.getState().navigateToNode(nodeId)
    setView('chat')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        view={view}
        setView={setView}
        onNavigate={handleNavigate}
        onNewSession={handleNewSession}
      />
      <main style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {backendError && (
          <div style={{
            position: 'absolute',
            left: 24,
            right: 24,
            top: 16,
            zIndex: 50,
            padding: '10px 14px',
            border: '1px solid var(--crimson)',
            background: 'var(--paper)',
            color: 'var(--crimson)',
            fontFamily: 'var(--sans)',
            fontSize: 12,
            borderRadius: 4,
          }}>
            {backendError}
          </div>
        )}
        {view === 'home' && (
          <HomeView onStartSession={handleStartSession} onOpenSession={handleOpenSession} />
        )}
        {view === 'chat' && current && <ChatView />}
        {view === 'map' && <MapView onNavigate={handleNavigate} />}
        {isOpen && <SettingsModal />}
      </main>
    </div>
  )
}

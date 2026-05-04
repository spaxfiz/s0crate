import { useSessionStore } from '../stores/sessionStore'
import { useSettingsStore } from '../stores/settingsStore'

type View = 'home' | 'chat'

export function BottomNav({ view, setView, onOpenDrawer }: {
  view: View
  setView: (v: View) => void
  onOpenDrawer: () => void
}) {
  const { current } = useSessionStore()
  const openSettings = useSettingsStore(s => s.open)

  const progress = current?.progress
  const progressBadge = progress && progress[1] > 0 && progress[0] < progress[1]
    ? `${progress[0]}/${progress[1]}`
    : null

  return (
    <nav style={{
      flexShrink: 0,
      borderTop: '1px solid var(--rule)',
      background: 'var(--paper-deep)',
      backgroundImage: 'linear-gradient(180deg, rgba(255,250,235,0.4), rgba(214,205,179,0.15))',
      display: 'flex',
      alignItems: 'center',
      paddingBottom: 'var(--safe-bottom)',
    }}>
      {/* Home */}
      <button onClick={() => setView('home')} style={{
        flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '8px 0 6px',
        border: 'none', background: 'transparent', cursor: 'pointer',
        fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: view === 'home' ? 'var(--accent-deep)' : 'var(--ink-mute)',
        fontWeight: view === 'home' ? 600 : 500,
      }}>
        <span style={{ fontFamily: 'var(--display)', fontSize: 16 }}>⌂</span>
        Home
      </button>

      {/* Chat */}
      <button onClick={() => { if (current) setView('chat') }} style={{
        flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '8px 0 6px',
        border: 'none', background: 'transparent', cursor: current ? 'pointer' : 'default',
        fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: view === 'chat' ? 'var(--accent-deep)' : current ? 'var(--ink-mute)' : 'var(--ink-faint)',
        fontWeight: view === 'chat' ? 600 : 500,
        position: 'relative',
      }}>
        <span style={{ fontFamily: 'var(--display)', fontSize: 16, position: 'relative' }}>
          𝓡
          {progressBadge && (
            <span style={{
              position: 'absolute', top: -6, right: -14,
              fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--accent)',
              whiteSpace: 'nowrap',
            }}>{progressBadge}</span>
          )}
        </span>
        Chat
      </button>

      {/* Menu (drawer) */}
      <button onClick={onOpenDrawer} style={{
        flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '8px 0 6px',
        border: 'none', background: 'transparent', cursor: 'pointer',
        fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--ink-mute)', fontWeight: 500,
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        Menu
      </button>

      {/* Settings */}
      <button onClick={openSettings} style={{
        padding: '8px 12px 6px',
        border: 'none', background: 'transparent', cursor: 'pointer',
        color: 'var(--ink-mute)',
      }}>
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M7 1v2 M7 11v2 M1 7h2 M11 7h2 M2.5 2.5l1.4 1.4 M10.1 10.1l1.4 1.4 M2.5 11.5l1.4-1.4 M10.1 3.9l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </nav>
  )
}

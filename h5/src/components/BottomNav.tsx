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
        fontFamily: 'var(--sans)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: view === 'home' ? 'var(--accent-deep)' : 'var(--ink-mute)',
        fontWeight: view === 'home' ? 600 : 500,
      }}>
        <span style={{ fontFamily: 'var(--display)', fontSize: 17 }}>⌂</span>
        Home
      </button>

      {/* Chat */}
      <button onClick={() => { if (current) setView('chat') }} style={{
        flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '8px 0 6px',
        border: 'none', background: 'transparent', cursor: current ? 'pointer' : 'default',
        fontFamily: 'var(--sans)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: view === 'chat' ? 'var(--accent-deep)' : current ? 'var(--ink-mute)' : 'var(--ink-faint)',
        fontWeight: view === 'chat' ? 600 : 500,
        position: 'relative',
      }}>
        <span style={{ fontFamily: 'var(--display)', fontSize: 17, position: 'relative' }}>
          𝓡
          {progressBadge && (
            <span style={{
              position: 'absolute', top: -6, right: -14,
              fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--accent)',
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
        fontFamily: 'var(--sans)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
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
        <svg width="16" height="16" viewBox="0 0 14 14">
          <path fillRule="evenodd" fill="currentColor" d="M7.96 2.5 A4.6 4.6 0 0 1 10.42 3.92 L11.57 3.43 A5.8 5.8 0 0 1 12.38 4.83 L11.38 5.58 A4.6 4.6 0 0 1 11.38 8.42 L12.38 9.17 A5.8 5.8 0 0 1 11.57 10.57 L10.42 10.08 A4.6 4.6 0 0 1 7.96 11.5 L7.81 12.74 A5.8 5.8 0 0 1 6.19 12.74 L6.04 11.5 A4.6 4.6 0 0 1 3.58 10.08 L2.43 10.57 A5.8 5.8 0 0 1 1.62 9.17 L2.63 8.42 A4.6 4.6 0 0 1 2.63 5.58 L1.62 4.83 A5.8 5.8 0 0 1 2.43 3.43 L3.58 3.92 A4.6 4.6 0 0 1 6.04 2.5 L6.19 1.26 A5.8 5.8 0 0 1 7.81 1.26 Z M7 5.2 A1.8 1.8 0 0 1 7 8.8 A1.8 1.8 0 0 1 7 5.2 Z"/>
        </svg>
      </button>
    </nav>
  )
}

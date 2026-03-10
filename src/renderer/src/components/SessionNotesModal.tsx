import { useEffect } from 'react'
import { useTheme } from '../ThemeContext'

interface WorkspaceWithNote {
  id: string
  name: string
  color: string
  note?: string
}

interface SessionNotesModalProps {
  workspaces: WorkspaceWithNote[]
  onClose: () => void
}

export function SessionNotesModal({ workspaces, onClose }: SessionNotesModalProps): React.JSX.Element {
  const { theme } = useTheme()

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: theme.headerBg,
          border: `1px solid ${theme.borderColor}`,
          borderRadius: '10px',
          width: '420px',
          maxHeight: '520px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 18px 12px',
            borderBottom: `1px solid ${theme.borderColor}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <span style={{ fontSize: '18px' }}>👋</span>
          <div>
            <div style={{ color: theme.textColor, fontWeight: 600, fontSize: '14px' }}>
              Welcome back
            </div>
            <div style={{ color: theme.mutedText, fontSize: '11px', marginTop: '2px' }}>
              Notes you left from your last session
            </div>
          </div>
          <button
            className="hs-btn hs-btn-close"
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: 'none', border: 'none',
              color: theme.mutedText, cursor: 'pointer',
              fontSize: '14px', padding: '4px 6px', borderRadius: '4px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Notes list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              style={{
                background: theme.background,
                border: `1px solid ${theme.borderColor}`,
                borderLeft: `3px solid ${ws.color}`,
                borderRadius: '6px',
                padding: '10px 12px'
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px'
              }}>
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: ws.color, flexShrink: 0, display: 'inline-block'
                }} />
                <span style={{ color: theme.textColor, fontSize: '12px', fontWeight: 600 }}>
                  {ws.name}
                </span>
              </div>
              <p style={{
                color: theme.mutedText,
                fontSize: '12px',
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                margin: 0
              }}>
                {ws.note}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: `1px solid ${theme.borderColor}`,
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              background: theme.accentColor,
              border: 'none',
              color: theme.background,
              cursor: 'pointer',
              fontSize: '13px',
              padding: '6px 18px',
              borderRadius: '5px',
              fontWeight: 600
            }}
          >
            Let's go →
          </button>
        </div>
      </div>
    </div>
  )
}

import { useTheme } from '../ThemeContext'

interface StatusBarProps {
  workspaceCount: number
  activeWorkspaceName: string
  onOpenSettings: () => void
}

export function StatusBar({ workspaceCount, activeWorkspaceName, onOpenSettings }: StatusBarProps): React.JSX.Element {
  const { theme } = useTheme()
  return (
    <div
      style={{
        height: '22px',
        minHeight: '22px',
        background: theme.statusBarBg,
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        gap: '12px',
        fontSize: '11px',
        color: '#ffffff',
        userSelect: 'none'
      }}
    >
      <span style={{ fontWeight: 600, letterSpacing: '0.03em' }}>Hoeven Solutions</span>
      <span style={{ opacity: 0.7 }}>·</span>
      <span style={{ opacity: 0.8 }}>{activeWorkspaceName}</span>
      <span style={{ opacity: 0.5 }}>{workspaceCount} workspace{workspaceCount !== 1 ? 's' : ''}</span>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Shortcut hints as compact badges */}
        <span
          style={{ opacity: 0.45, fontSize: '10px', letterSpacing: '0.02em' }}
          title="Ctrl+T new · Ctrl+W close · Ctrl+\ split · Ctrl+- hsplit"
        >
          ⌨ shortcuts
        </span>
        <button
          className="hs-btn"
          onClick={onOpenSettings}
          title="Settings"
          style={{
            background: 'none',
            border: 'none',
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: '13px',
            padding: '2px 4px',
            opacity: 0.75,
            lineHeight: 1,
            borderRadius: '3px'
          }}
        >
          ⚙
        </button>
      </div>
    </div>
  )
}

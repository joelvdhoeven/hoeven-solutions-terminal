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
        padding: '0 12px',
        gap: '16px',
        fontSize: '11px',
        color: '#ffffff',
        userSelect: 'none'
      }}
    >
      <span>Hoeven Solutions</span>
      <span style={{ opacity: 0.8 }}>{activeWorkspaceName}</span>
      <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
        {workspaceCount} workspace{workspaceCount !== 1 ? 's' : ''}
      </span>
      <span style={{ opacity: 0.7 }}>Ctrl+T new · Ctrl+W close · Ctrl+\ split · Ctrl+- hsplit</span>
      <button
        onClick={onOpenSettings}
        title="Settings"
        style={{
          background: 'none',
          border: 'none',
          color: '#ffffff',
          cursor: 'pointer',
          fontSize: '14px',
          padding: '0',
          opacity: 0.8,
          lineHeight: 1
        }}
      >
        ⚙
      </button>
    </div>
  )
}

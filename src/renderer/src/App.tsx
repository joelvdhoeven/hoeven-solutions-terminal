import { useState, useCallback, useEffect, useRef } from 'react'
import { WorkspaceTab } from './components/WorkspaceTab'
import { PaneLayout } from './components/PaneLayout'
import { StatusBar } from './components/StatusBar'
import { SettingsModal } from './components/SettingsModal'
import { useTheme } from './ThemeContext'
import { useShortcuts, matchesShortcut } from './ShortcutsContext'

interface Workspace {
  id: string
  name: string
  cwd: string
  color: string
  templateCols?: number
  templateRows?: number
}

const TAB_COLORS = [
  '#569cd6', '#6a9955', '#d7ba7d', '#c586c0', '#4ec9b0',
  '#f44747', '#fd971f', '#88c0d0', '#bd93f9', '#ff79c6'
]
let colorIndex = 0

interface SessionData {
  themeId?: string
  shortcuts?: unknown[]
  workspaces?: Workspace[]
  activeWorkspaceId?: string
}

interface AppProps {
  initialSession: SessionData | null
}

let wsCounter = 0
function createWorkspace(): Workspace {
  const id = `ws-${++wsCounter}`
  const color = TAB_COLORS[colorIndex % TAB_COLORS.length]
  colorIndex++
  return { id, name: `Workspace ${wsCounter}`, cwd: '', color }
}

function App({ initialSession }: AppProps): React.JSX.Element {
  const { theme, themeId } = useTheme()
  const { shortcuts, getShortcut } = useShortcuts()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
    if (initialSession?.workspaces && initialSession.workspaces.length > 0) {
      // Sync wsCounter
      initialSession.workspaces.forEach((ws) => {
        const n = parseInt(ws.id.replace('ws-', ''))
        if (!isNaN(n) && n > wsCounter) wsCounter = n
      })
      return initialSession.workspaces.map((ws, i) => ({
        ...ws,
        color: ws.color ?? TAB_COLORS[i % TAB_COLORS.length]
      }))
    }
    return [createWorkspace()]
  })

  const [activeId, setActiveId] = useState<string>(() => {
    if (initialSession?.activeWorkspaceId) return initialSession.activeWorkspaceId
    return workspaces[0].id
  })

  const addWorkspace = useCallback((cols: number = 1, rows: number = 1) => {
    const ws = createWorkspace()
    setWorkspaces((prev) => [...prev, { ...ws, templateCols: cols, templateRows: rows }])
    setActiveId(ws.id)
  }, [])

  const closeWorkspace = useCallback(
    (id: string) => {
      setWorkspaces((prev) => {
        const next = prev.filter((w) => w.id !== id)
        if (next.length === 0) return prev
        if (activeId === id) setActiveId(next[next.length - 1].id)
        return next
      })
    },
    [activeId]
  )

  const renameWorkspace = useCallback((id: string, name: string) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...w, name } : w)))
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const newWs = getShortcut('newWorkspace')
      const closeWs = getShortcut('closeWorkspace')
      if (newWs && matchesShortcut(e, newWs)) {
        e.preventDefault()
        addWorkspace(1, 1)
      } else if (closeWs && matchesShortcut(e, closeWs)) {
        e.preventDefault()
        if (workspaces.length > 1) closeWorkspace(activeId)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [addWorkspace, closeWorkspace, activeId, workspaces.length, getShortcut])

  // Debounced session save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      window.session.save({
        themeId,
        shortcuts,
        workspaces,
        activeWorkspaceId: activeId
      })
    }, 500)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [workspaces, activeId, themeId, shortcuts])

  const activeWorkspace = workspaces.find((w) => w.id === activeId)!

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: theme.background,
        overflow: 'hidden'
      }}
    >
      <WorkspaceTab
        workspaces={workspaces}
        activeId={activeId}
        onSelect={setActiveId}
        onAdd={addWorkspace}
        onClose={closeWorkspace}
        onRename={renameWorkspace}
      />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            style={{ position: 'absolute', inset: 0, display: ws.id === activeId ? 'block' : 'none' }}
          >
            <PaneLayout workspaceId={ws.id} cwd={ws.cwd} templateCols={ws.templateCols ?? 1} templateRows={ws.templateRows ?? 1} />
          </div>
        ))}
      </div>
      <StatusBar
        workspaceCount={workspaces.length}
        activeWorkspaceName={activeWorkspace?.name ?? ''}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </div>
  )
}

export default App

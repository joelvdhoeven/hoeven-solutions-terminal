import { useState, useCallback, useMemo } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { Terminal } from './Terminal'
import { useTheme } from '../ThemeContext'
import { useShortcuts, matchesShortcut } from '../ShortcutsContext'
import { OrchestratorPane } from './OrchestratorPane'

interface PaneConfig {
  id: string
  terminalId: string
  cwd: string
  direction?: 'horizontal' | 'vertical'
  children?: PaneConfig[]
}

interface PaneInfo {
  terminalId: string
  cwd: string
}

interface PaneLayoutProps {
  workspaceId: string
  cwd: string
  templateCols?: number
  templateRows?: number
}

function collectLeaves(pane: PaneConfig): PaneInfo[] {
  if (!pane.children) return [{ terminalId: pane.terminalId, cwd: pane.cwd }]
  return pane.children.flatMap(collectLeaves)
}

let paneCounter = 0
function newPaneId(): string {
  return `pane-${++paneCounter}`
}

function newTermId(): string {
  return `term-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function createPane(cwd: string): PaneConfig {
  return { id: newPaneId(), terminalId: newTermId(), cwd }
}

interface PaneTreeProps {
  pane: PaneConfig
  activePaneId: string
  onSetActive: (id: string) => void
  onSplit: (id: string, direction: 'horizontal' | 'vertical') => void
  onClose: (id: string) => void
  canClose: boolean
}

function PaneTree({
  pane,
  activePaneId,
  onSetActive,
  onSplit,
  onClose,
  canClose
}: PaneTreeProps): React.JSX.Element {
  const { theme } = useTheme()

  if (pane.children && pane.direction) {
    const resizeHandleStyle: React.CSSProperties = {
      background: theme.borderColor,
      flexShrink: 0,
      position: 'relative'
    }

    return (
      <PanelGroup orientation={pane.direction} style={{ width: '100%', height: '100%' }}>
        {pane.children.flatMap((child, idx) => {
          const items: React.ReactNode[] = [
            <Panel key={child.id} minSize={10}>
              <PaneTree
                pane={child}
                activePaneId={activePaneId}
                onSetActive={onSetActive}
                onSplit={onSplit}
                onClose={onClose}
                canClose={pane.children!.length > 1}
              />
            </Panel>
          ]
          if (idx < pane.children!.length - 1) {
            items.push(
              <PanelResizeHandle
                key={`handle-${child.id}`}
                style={{
                  ...resizeHandleStyle,
                  width: pane.direction === 'horizontal' ? '4px' : '100%',
                  height: pane.direction === 'vertical' ? '4px' : '100%',
                  cursor: pane.direction === 'horizontal' ? 'col-resize' : 'row-resize'
                }}
              />
            )
          }
          return items
        })}
      </PanelGroup>
    )
  }

  const isActive = pane.id === activePaneId
  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: theme.mutedText,
    cursor: 'pointer',
    fontSize: '14px',
    padding: '0 4px',
    lineHeight: 1,
    borderRadius: '2px'
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: isActive ? `1px solid ${theme.accentColor}` : `1px solid ${theme.borderColor}`,
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
      onClick={() => onSetActive(pane.id)}
    >
      <div
        style={{
          height: '28px',
          minHeight: '28px',
          background: theme.headerBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          gap: '4px',
          borderBottom: `1px solid ${theme.borderColor}`
        }}
      >
        <span style={{ color: theme.mutedText, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pane.cwd || '~'}
        </span>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button
            title="Split vertical (Ctrl+\)"
            onClick={(e) => { e.stopPropagation(); onSplit(pane.id, 'horizontal') }}
            style={btnStyle}
          >
            ⊟
          </button>
          <button
            title="Split horizontal (Ctrl+-)"
            onClick={(e) => { e.stopPropagation(); onSplit(pane.id, 'vertical') }}
            style={btnStyle}
          >
            ⊞
          </button>
          {canClose && (
            <button
              title="Close pane"
              onClick={(e) => { e.stopPropagation(); onClose(pane.id) }}
              style={{ ...btnStyle, color: '#f44747' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Terminal id={pane.terminalId} cwd={pane.cwd} isActive={isActive} />
      </div>
    </div>
  )
}

function splitPane(
  root: PaneConfig,
  targetId: string,
  direction: 'horizontal' | 'vertical',
  cwd: string
): PaneConfig {
  if (root.id === targetId && !root.children) {
    const newPane = createPane(cwd)
    return {
      id: newPaneId(),
      terminalId: '',
      cwd: '',
      direction,
      children: [root, newPane]
    }
  }
  if (root.children) {
    return {
      ...root,
      children: root.children.map((c) => splitPane(c, targetId, direction, cwd))
    }
  }
  return root
}

function closePane(root: PaneConfig, targetId: string): PaneConfig | null {
  if (root.id === targetId) return null
  if (!root.children) return root

  const newChildren = root.children
    .map((c) => closePane(c, targetId))
    .filter(Boolean) as PaneConfig[]

  if (newChildren.length === 0) return null
  if (newChildren.length === 1) return newChildren[0]
  return { ...root, children: newChildren }
}

function findFirstLeaf(pane: PaneConfig): PaneConfig {
  if (!pane.children) return pane
  return findFirstLeaf(pane.children[0])
}

function buildVerticalStack(panes: PaneConfig[]): PaneConfig {
  if (panes.length === 1) return panes[0]
  return { id: newPaneId(), terminalId: '', cwd: '', direction: 'vertical', children: panes }
}

function buildHorizontalJoin(panes: PaneConfig[]): PaneConfig {
  if (panes.length === 1) return panes[0]
  return { id: newPaneId(), terminalId: '', cwd: '', direction: 'horizontal', children: panes }
}

function buildGridTemplate(cols: number, rows: number, cwd: string): PaneConfig {
  const total = cols * rows
  if (total <= 1) return createPane(cwd)

  // Create all leaf panes
  const panes = Array.from({ length: total }, () => createPane(cwd))

  if (cols === 1) {
    // Single column, stack vertically
    return buildVerticalStack(panes)
  }

  // Build columns first, then join horizontally
  const columns: PaneConfig[] = []
  for (let c = 0; c < cols; c++) {
    const colPanes = panes.slice(c * rows, c * rows + rows)
    columns.push(colPanes.length === 1 ? colPanes[0] : buildVerticalStack(colPanes))
  }
  return buildHorizontalJoin(columns)
}

export function PaneLayout({ workspaceId, cwd, templateCols = 1, templateRows = 1 }: PaneLayoutProps): React.JSX.Element {
  const initialRoot = useMemo(() => buildGridTemplate(templateCols, templateRows, cwd), [])
  const [root, setRoot] = useState<PaneConfig>(initialRoot)
  const [activePaneId, setActivePaneId] = useState<string>(() => findFirstLeaf(initialRoot).id)
  const [showOrchestrator, setShowOrchestrator] = useState(false)
  const { getShortcut } = useShortcuts()
  const { theme } = useTheme()

  const handleSplit = useCallback(
    (paneId: string, direction: 'horizontal' | 'vertical') => {
      setRoot((prev) => splitPane(prev, paneId, direction, cwd))
    },
    [cwd]
  )

  const handleClose = useCallback((paneId: string) => {
    setRoot((prev) => {
      const updated = closePane(prev, paneId)
      if (!updated) return prev
      const leaf = findFirstLeaf(updated)
      setActivePaneId(leaf.id)
      return updated
    })
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const splitH = getShortcut('splitHorizontal')
      const splitV = getShortcut('splitVertical')
      if (splitH && matchesShortcut(e, splitH)) {
        e.preventDefault()
        handleSplit(activePaneId, 'horizontal')
      } else if (splitV && matchesShortcut(e, splitV)) {
        e.preventDefault()
        handleSplit(activePaneId, 'vertical')
      }
    },
    [activePaneId, handleSplit, getShortcut]
  )

  const leaves = useMemo(() => collectLeaves(root), [root])

  return (
    <div
      style={{ width: '100%', height: '100%', outline: 'none', position: 'relative' }}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      data-workspace={workspaceId}
    >
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <PaneTree
            pane={root}
            activePaneId={activePaneId}
            onSetActive={setActivePaneId}
            onSplit={handleSplit}
            onClose={handleClose}
            canClose={false}
          />
        </div>
        {showOrchestrator && <OrchestratorPane panes={leaves} />}
      </div>

      {/* Orchestrator toggle button — bottom-right overlay */}
      <button
        title={showOrchestrator ? 'Close Orchestrator' : 'Open Orchestrator'}
        onClick={() => setShowOrchestrator((v) => !v)}
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          zIndex: 50,
          background: showOrchestrator ? theme.accentColor : theme.headerBg,
          color: showOrchestrator ? theme.background : theme.mutedText,
          border: `1px solid ${theme.borderColor}`,
          borderRadius: '4px',
          padding: '4px 10px',
          fontSize: '14px',
          cursor: 'pointer',
          lineHeight: 1,
          userSelect: 'none',
          opacity: 0.9
        }}
      >
        {showOrchestrator ? '⊗' : '⊕'}
      </button>
    </div>
  )
}

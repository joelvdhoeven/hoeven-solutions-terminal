import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../ThemeContext'

interface Workspace {
  id: string
  name: string
  cwd: string
  color: string
}

interface WorkspaceTabProps {
  workspaces: Workspace[]
  activeId: string
  onSelect: (id: string) => void
  onAdd: (cols: number, rows: number) => void
  onClose: (id: string) => void
}

interface GridPos { top: number; right: number }

function TemplateGrid({
  onSelect,
  onClose,
  pos
}: {
  onSelect: (cols: number, rows: number) => void
  onClose: () => void
  pos: GridPos
}): React.JSX.Element {
  const { theme } = useTheme()
  const [hovered, setHovered] = useState<[number, number]>([1, 1])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: pos.top,
        right: pos.right,
        background: theme.headerBg,
        border: `1px solid ${theme.borderColor}`,
        borderRadius: '6px',
        padding: '8px',
        zIndex: 9999,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        userSelect: 'none'
      }}
    >
      <div style={{ color: theme.mutedText, fontSize: '11px', marginBottom: '6px', textAlign: 'center' }}>
        {hovered[0]}×{hovered[1]}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 18px)', gap: '3px' }}>
        {Array.from({ length: 16 }, (_, i) => {
          const col = (i % 4) + 1
          const row = Math.floor(i / 4) + 1
          const active = col <= hovered[0] && row <= hovered[1]
          return (
            <div
              key={i}
              onMouseEnter={() => setHovered([col, row])}
              onClick={() => { onSelect(hovered[0], hovered[1]); onClose() }}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '3px',
                background: active ? theme.accentColor : theme.borderColor,
                cursor: 'pointer',
                transition: 'background 0.05s'
              }}
            />
          )
        })}
      </div>
    </div>,
    document.body
  )
}

export function WorkspaceTab({
  workspaces,
  activeId,
  onSelect,
  onAdd,
  onClose
}: WorkspaceTabProps): React.JSX.Element {
  const { theme } = useTheme()
  const [showGrid, setShowGrid] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [gridPos, setGridPos] = useState<GridPos>({ top: 40, right: 8 })

  const openGrid = (): void => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setGridPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right
      })
    }
    setShowGrid(true)
  }

  return (
    <div
      style={{
        height: '36px',
        minHeight: '36px',
        background: theme.headerBg,
        display: 'flex',
        alignItems: 'center',
        borderBottom: `1px solid ${theme.borderColor}`,
        padding: '0 4px',
        gap: '2px'
      }}
    >
      {/* Scrollable tabs area */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', overflowX: 'auto', overflowY: 'hidden', flex: 1 }}>
        {workspaces.map((ws) => {
          const isActive = ws.id === activeId
          return (
            <div
              key={ws.id}
              onClick={() => onSelect(ws.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 10px',
                height: '28px',
                borderRadius: '4px',
                cursor: 'pointer',
                background: isActive ? theme.background : 'transparent',
                color: isActive ? theme.textColor : theme.mutedText,
                fontSize: '12px',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                border: isActive ? `1px solid ${ws.color ?? theme.borderColor}` : '1px solid transparent',
                transition: 'background 0.1s'
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: ws.color ?? theme.accentColor,
                  flexShrink: 0,
                  display: 'inline-block'
                }}
              />
              <span>{ws.name}</span>
              {workspaces.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose(ws.id)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.mutedText,
                    cursor: 'pointer',
                    fontSize: '11px',
                    padding: '0',
                    lineHeight: 1,
                    opacity: 0.6
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>

      <button
        ref={btnRef}
        onClick={openGrid}
        title="New workspace (click for layout picker)"
        style={{
          background: 'none',
          border: `1px solid ${theme.borderColor}`,
          color: theme.textColor,
          cursor: 'pointer',
          fontSize: '16px',
          padding: '0 10px',
          height: '28px',
          borderRadius: '4px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0
        }}
      >
        +
      </button>

      {showGrid && (
        <TemplateGrid
          pos={gridPos}
          onSelect={(cols, rows) => onAdd(cols, rows)}
          onClose={() => setShowGrid(false)}
        />
      )}
    </div>
  )
}

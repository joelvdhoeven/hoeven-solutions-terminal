import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../ThemeContext'

interface Workspace {
  id: string
  name: string
  cwd: string
  color: string
  note?: string
}

interface WorkspaceTabProps {
  workspaces: Workspace[]
  activeId: string
  onSelect: (id: string) => void
  onAdd: (cols: number, rows: number) => void
  onClose: (id: string) => void
  onRename: (id: string, name: string) => void
  onSetNote: (id: string, note: string) => void
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
        borderRadius: '8px',
        padding: '10px',
        zIndex: 9999,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        userSelect: 'none'
      }}
    >
      <div style={{ color: theme.mutedText, fontSize: '11px', marginBottom: '8px', textAlign: 'center', letterSpacing: '0.05em' }}>
        {hovered[0]}×{hovered[1]}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 20px)', gap: '4px' }}>
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
                width: '20px',
                height: '20px',
                borderRadius: '4px',
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

interface NotePopoverProps {
  ws: Workspace
  anchorRect: DOMRect
  onSave: (note: string) => void
  onClose: () => void
}

function NotePopover({ ws, anchorRect, onSave, onClose }: NotePopoverProps): React.JSX.Element {
  const { theme } = useTheme()
  const [value, setValue] = useState(ws.note ?? '')
  const ref = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onSave(value)
        onClose()
      }
    }
    const keyHandler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { onSave(value); onClose() }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [value, onSave, onClose])

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: anchorRect.bottom + 4,
        left: anchorRect.left,
        background: theme.headerBg,
        border: `1px solid ${theme.accentColor}`,
        borderRadius: '6px',
        padding: '10px',
        zIndex: 9999,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        width: '280px'
      }}
    >
      <div style={{ color: theme.mutedText, fontSize: '10px', marginBottom: '6px', letterSpacing: '0.05em' }}>
        NOTE FOR <span style={{ color: theme.textColor }}>{ws.name}</span>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Leave a note for your next session…"
        rows={4}
        style={{
          width: '100%',
          background: theme.background,
          border: `1px solid ${theme.borderColor}`,
          borderRadius: '4px',
          color: theme.textColor,
          fontSize: '12px',
          padding: '6px 8px',
          resize: 'vertical',
          outline: 'none',
          fontFamily: 'inherit',
          lineHeight: 1.5
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '6px' }}>
        {value && (
          <button
            onClick={() => { setValue(''); onSave(''); onClose() }}
            style={{
              background: 'none', border: 'none', color: theme.mutedText,
              cursor: 'pointer', fontSize: '11px', padding: '3px 8px', borderRadius: '3px'
            }}
          >
            Clear
          </button>
        )}
        <button
          onClick={() => { onSave(value); onClose() }}
          style={{
            background: theme.accentColor, border: 'none', color: theme.background,
            cursor: 'pointer', fontSize: '11px', padding: '3px 10px',
            borderRadius: '3px', fontWeight: 600
          }}
        >
          Save
        </button>
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
  onClose,
  onRename,
  onSetNote
}: WorkspaceTabProps): React.JSX.Element {
  const { theme } = useTheme()
  const [showGrid, setShowGrid] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [gridPos, setGridPos] = useState<GridPos>({ top: 40, right: 8 })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  const [noteAnchor, setNoteAnchor] = useState<{ ws: Workspace; rect: DOMRect } | null>(null)

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.select()
  }, [editingId])

  const startEdit = (ws: Workspace): void => {
    setEditingId(ws.id)
    setEditValue(ws.name)
  }

  const commitEdit = (): void => {
    if (editingId && editValue.trim()) onRename(editingId, editValue.trim())
    setEditingId(null)
  }

  const openGrid = (): void => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setGridPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setShowGrid(true)
  }

  const winCtrlBtn: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: theme.mutedText,
    cursor: 'pointer',
    fontSize: '12px',
    width: '40px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    WebkitAppRegion: 'no-drag' as any,
    transition: 'background 0.1s, color 0.1s'
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
        WebkitAppRegion: 'drag' as any,
        userSelect: 'none'
      }}
    >
      {/* App icon / branding */}
      <div style={{
        width: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        WebkitAppRegion: 'no-drag' as any,
        opacity: 0.5,
        fontSize: '14px'
      }}>
        ⬡
      </div>

      {/* Scrollable tabs area */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        overflowX: 'auto',
        overflowY: 'hidden',
        flex: 1,
        WebkitAppRegion: 'no-drag' as any,
        scrollbarWidth: 'none'
      }}>
        {workspaces.map((ws) => {
          const isActive = ws.id === activeId
          const isEditing = editingId === ws.id
          return (
            <div
              key={ws.id}
              className={isActive ? undefined : 'hs-tab'}
              onClick={() => !isEditing && onSelect(ws.id)}
              onDoubleClick={() => startEdit(ws)}
              onAuxClick={(e) => { if (e.button === 1) onClose(ws.id) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 8px 0 10px',
                height: '28px',
                borderRadius: '4px',
                cursor: isEditing ? 'default' : 'pointer',
                background: isActive ? theme.background : 'transparent',
                color: isActive ? theme.textColor : theme.mutedText,
                fontSize: '12px',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                border: isActive ? `1px solid ${ws.color ?? theme.borderColor}` : '1px solid transparent',
                transition: 'background 0.1s',
                flexShrink: 0
              }}
            >
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: ws.color ?? theme.accentColor,
                flexShrink: 0, display: 'inline-block'
              }} />
              {isEditing ? (
                <input
                  ref={editInputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit()
                    else if (e.key === 'Escape') setEditingId(null)
                    e.stopPropagation()
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: theme.textColor, fontSize: '12px',
                    width: `${Math.max(editValue.length, 4)}ch`, padding: 0
                  }}
                />
              ) : (
                <span>{ws.name}</span>
              )}
              {!isEditing && (
                <button
                  className="hs-btn"
                  title={ws.note ? ws.note : 'Add note'}
                  onClick={(e) => {
                    e.stopPropagation()
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    setNoteAnchor({ ws, rect })
                  }}
                  style={{
                    background: 'none', border: 'none',
                    color: ws.note ? theme.accentColor : theme.mutedText,
                    cursor: 'pointer', fontSize: '10px', padding: '1px 3px',
                    lineHeight: 1, opacity: ws.note ? 1 : 0.45, borderRadius: '3px'
                  }}
                >✎</button>
              )}
              {workspaces.length > 1 && !isEditing && (
                <button
                  className="hs-btn hs-btn-close"
                  onClick={(e) => { e.stopPropagation(); onClose(ws.id) }}
                  style={{
                    background: 'none', border: 'none', color: theme.mutedText,
                    cursor: 'pointer', fontSize: '11px', padding: '2px 3px',
                    lineHeight: 1, opacity: 0.6, borderRadius: '3px'
                  }}
                >✕</button>
              )}
            </div>
          )
        })}
      </div>

      {/* New workspace button */}
      <button
        ref={btnRef}
        className="hs-btn"
        onClick={openGrid}
        title="New workspace"
        style={{
          background: 'none',
          border: 'none',
          color: theme.mutedText,
          cursor: 'pointer',
          fontSize: '18px',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          WebkitAppRegion: 'no-drag' as any,
          borderRadius: 0,
          lineHeight: 1
        }}
      >
        +
      </button>

      {/* Window controls */}
      <button
        className="hs-btn"
        onClick={() => window.windowControls.minimize()}
        title="Minimize"
        style={winCtrlBtn}
      >
        ─
      </button>
      <button
        className="hs-btn"
        onClick={() => window.windowControls.maximize()}
        title="Maximize / Restore"
        style={winCtrlBtn}
      >
        ▭
      </button>
      <button
        className="hs-btn-close-win"
        onClick={() => window.windowControls.close()}
        title="Close"
        style={{ ...winCtrlBtn, borderRadius: 0 }}
      >
        ✕
      </button>

      {showGrid && (
        <TemplateGrid
          pos={gridPos}
          onSelect={(cols, rows) => onAdd(cols, rows)}
          onClose={() => setShowGrid(false)}
        />
      )}

      {noteAnchor && (
        <NotePopover
          ws={noteAnchor.ws}
          anchorRect={noteAnchor.rect}
          onSave={(note) => onSetNote(noteAnchor.ws.id, note)}
          onClose={() => setNoteAnchor(null)}
        />
      )}
    </div>
  )
}

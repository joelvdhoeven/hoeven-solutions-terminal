import { useState } from 'react'
import { useTheme } from '../ThemeContext'
import type { Dispatch } from '../../../preload/index.d'

export type { Dispatch }

interface PaneInfo {
  terminalId: string
  cwd: string
  label?: string
}

interface DispatchQueueProps {
  panes: PaneInfo[]
  dispatches: Dispatch[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onCreate: (title: string, instructions: string, targetTerminalId: string) => void
}

function paneLabel(pane: PaneInfo, index: number): string {
  if (pane.label) return pane.label
  if (!pane.cwd) return `Terminal ${index + 1}`
  const parts = pane.cwd.replace(/\\/g, '/').split('/')
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]) return parts[i]
  }
  return `Terminal ${index + 1}`
}

export function DispatchQueue({ panes, dispatches, onApprove, onReject, onCreate }: DispatchQueueProps): React.JSX.Element {
  const { theme } = useTheme()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [targetId, setTargetId] = useState(() => panes[0]?.terminalId ?? '')

  const pending = dispatches.filter(d => d.status === 'pending')
  const active = dispatches.filter(d => d.status === 'active')
  const visible = [...pending, ...active]

  function handleCreate(): void {
    if (!title.trim() || !instructions.trim() || !targetId) return
    onCreate(title.trim(), instructions.trim(), targetId)
    setTitle('')
    setInstructions('')
    setShowForm(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: theme.background,
    border: `1px solid ${theme.borderColor}`,
    borderRadius: '3px',
    color: theme.textColor,
    fontSize: '12px',
    padding: '4px 6px',
    outline: 'none'
  }

  const btnSmall: React.CSSProperties = {
    background: 'none',
    border: `1px solid ${theme.borderColor}`,
    borderRadius: '3px',
    color: theme.mutedText,
    cursor: 'pointer',
    fontSize: '10px',
    padding: '1px 6px',
    lineHeight: '16px',
    flexShrink: 0
  }

  return (
    <div>
      {/* Section header */}
      <div style={{
        fontSize: '10px',
        fontVariant: 'small-caps',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: theme.mutedText,
        padding: '8px 10px 4px',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span>Dispatch Queue {pending.length > 0 && <span style={{ color: theme.accentColor }}>({pending.length})</span>}</span>
        <button
          className="hs-btn"
          onClick={() => setShowForm(v => !v)}
          style={{ ...btnSmall, color: theme.accentColor, borderColor: theme.accentColor }}
        >
          {showForm ? '×' : '+ New'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ padding: '6px 10px 8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Task title..."
            style={inputStyle}
            autoFocus
          />
          <textarea
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Instructions for agent..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            style={inputStyle}
          >
            {panes.map((p, i) => (
              <option key={p.terminalId} value={p.terminalId}>
                {paneLabel(p, i)}
              </option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || !instructions.trim() || !targetId}
            style={{
              background: theme.accentColor,
              border: 'none',
              borderRadius: '3px',
              color: theme.background,
              cursor: !title.trim() || !instructions.trim() ? 'default' : 'pointer',
              fontSize: '12px',
              padding: '5px 10px',
              opacity: !title.trim() || !instructions.trim() ? 0.5 : 1
            }}
          >
            Create Dispatch
          </button>
        </div>
      )}

      {/* Queue items */}
      {visible.length === 0 && !showForm && (
        <div style={{ padding: '2px 10px 8px', color: theme.mutedText, fontSize: '12px', fontStyle: 'italic' }}>
          No dispatches
        </div>
      )}

      {visible.map(dispatch => {
        const pane = panes.find(p => p.terminalId === dispatch.targetTerminalId)
        const idx = pane ? panes.indexOf(pane) : 0
        const label = pane ? paneLabel(pane, idx) : '?'
        const isPending = dispatch.status === 'pending'

        return (
          <div
            key={dispatch.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              padding: '5px 10px',
              gap: '6px',
              fontSize: '12px',
              borderTop: `1px solid ${theme.borderColor}20`
            }}
          >
            <span
              className={!isPending ? 'hs-dot-running' : undefined}
              style={{
                width: '7px', height: '7px', minWidth: '7px', borderRadius: '50%',
                background: isPending ? theme.mutedText : theme.terminal.blue,
                display: 'inline-block', flexShrink: 0, marginTop: '3px'
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: theme.textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                {dispatch.title}
              </div>
              <div style={{ color: theme.mutedText, fontSize: '10px' }}>
                → {label} · {dispatch.status}
              </div>
            </div>
            {isPending && (
              <div style={{ display: 'flex', gap: '3px' }}>
                <button
                  className="hs-btn"
                  onClick={() => onApprove(dispatch.id)}
                  title="Approve"
                  style={{ ...btnSmall, color: '#6a9955', borderColor: '#6a9955' }}
                >✓</button>
                <button
                  className="hs-btn hs-btn-close"
                  onClick={() => onReject(dispatch.id)}
                  title="Reject"
                  style={{ ...btnSmall, color: '#f44747', borderColor: '#f44747' }}
                >✕</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

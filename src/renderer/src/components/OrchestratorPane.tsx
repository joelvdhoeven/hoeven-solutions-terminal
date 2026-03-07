import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../ThemeContext'

interface PaneInfo {
  terminalId: string
  cwd: string
}

interface OrchestratorPaneProps {
  panes: PaneInfo[]
}

type TerminalStatus = 'idle' | 'running' | 'done' | 'error'

interface TerminalState {
  status: TerminalStatus
  exitCode: number | null
}

interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

const OSC_REGEX = /\x1b\]133;([^\x07]*)\x07/g

function statusDotColor(status: TerminalStatus, theme: { terminal: { blue: string; green: string; red: string }; mutedText: string }): string {
  switch (status) {
    case 'running': return theme.terminal.blue
    case 'done': return theme.terminal.green
    case 'error': return theme.terminal.red
    default: return theme.mutedText
  }
}

function cwdLabel(cwd: string, index: number): string {
  if (!cwd) return `terminal ${index + 1}`
  const parts = cwd.replace(/\\/g, '/').split('/')
  // Walk backwards to find a non-empty segment
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]) return parts[i]
  }
  return `terminal ${index + 1}`
}

export function OrchestratorPane({ panes }: OrchestratorPaneProps): React.JSX.Element {
  const { theme } = useTheme()

  const [termStates, setTermStates] = useState<Record<string, TerminalState>>(() => {
    const init: Record<string, TerminalState> = {}
    for (const p of panes) {
      init[p.terminalId] = { status: 'idle', exitCode: null }
    }
    return init
  })

  const [items, setItems] = useState<ChecklistItem[]>([])
  const [inputText, setInputText] = useState('')
  const cleanupRefs = useRef<Record<string, () => void>>({})

  // Subscribe / unsubscribe from terminal data as panes list changes
  useEffect(() => {
    const currentIds = new Set(panes.map((p) => p.terminalId))

    // Remove cleanups for panes that no longer exist
    for (const id of Object.keys(cleanupRefs.current)) {
      if (!currentIds.has(id)) {
        cleanupRefs.current[id]()
        delete cleanupRefs.current[id]
      }
    }

    // Add subscriptions for new panes
    for (const pane of panes) {
      if (cleanupRefs.current[pane.terminalId]) continue

      const unsub = window.terminal.onData(pane.terminalId, (data: string) => {
        // Reset lastIndex to 0 before each use of the regex
        OSC_REGEX.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = OSC_REGEX.exec(data)) !== null) {
          const payload = match[1]
          if (payload === 'A') {
            setTermStates((prev) => ({
              ...prev,
              [pane.terminalId]: { status: 'idle', exitCode: null }
            }))
          } else if (payload === 'B') {
            setTermStates((prev) => ({
              ...prev,
              [pane.terminalId]: { status: 'running', exitCode: null }
            }))
          } else if (payload === 'D;0') {
            setTermStates((prev) => ({
              ...prev,
              [pane.terminalId]: { status: 'done', exitCode: 0 }
            }))
          } else if (payload.startsWith('D;')) {
            const code = parseInt(payload.slice(2), 10)
            setTermStates((prev) => ({
              ...prev,
              [pane.terminalId]: { status: 'error', exitCode: isNaN(code) ? 1 : code }
            }))
          }
        }
      })

      cleanupRefs.current[pane.terminalId] = unsub
    }

    // Initialize state for any new panes not yet tracked
    setTermStates((prev) => {
      const next = { ...prev }
      for (const p of panes) {
        if (!(p.terminalId in next)) {
          next[p.terminalId] = { status: 'idle', exitCode: null }
        }
      }
      return next
    })

    return () => {
      // Cleanup all on component unmount
    }
  }, [panes])

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      for (const unsub of Object.values(cleanupRefs.current)) {
        unsub()
      }
      cleanupRefs.current = {}
    }
  }, [])

  function handleAddItem(): void {
    const text = inputText.trim()
    if (!text) return
    setItems((prev) => [
      ...prev,
      { id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, done: false }
    ])
    setInputText('')
  }

  function handleToggle(id: string): void {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, done: !item.done } : item))
  }

  function handleDelete(id: string): void {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '10px',
    fontVariant: 'small-caps',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.mutedText,
    padding: '8px 10px 4px',
    userSelect: 'none'
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    height: '28px',
    minHeight: '28px',
    padding: '0 10px',
    gap: '6px',
    fontSize: '12px',
    color: theme.textColor
  }

  return (
    <div
      style={{
        width: '280px',
        minWidth: '280px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: theme.headerBg,
        borderLeft: `1px solid ${theme.borderColor}`,
        overflowY: 'auto',
        boxSizing: 'border-box',
        flexShrink: 0
      }}
    >
      {/* Terminal Monitor Section */}
      <div style={sectionHeaderStyle}>Terminal Monitor</div>

      {panes.length === 0 && (
        <div style={{ ...rowStyle, color: theme.mutedText, fontStyle: 'italic' }}>
          No terminals
        </div>
      )}

      {panes.map((pane, i) => {
        const state = termStates[pane.terminalId] ?? { status: 'idle' as TerminalStatus, exitCode: null }
        const dotColor = statusDotColor(state.status, theme)
        const label = cwdLabel(pane.cwd, i)

        return (
          <div key={pane.terminalId} style={rowStyle}>
            {/* Status dot */}
            <span
              style={{
                width: '8px',
                height: '8px',
                minWidth: '8px',
                borderRadius: '50%',
                background: dotColor,
                display: 'inline-block',
                flexShrink: 0
              }}
              title={state.status}
            />
            {/* Label */}
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: theme.textColor,
                fontSize: '12px'
              }}
            >
              {label}
            </span>
            {/* Exit code badge on error */}
            {state.status === 'error' && state.exitCode !== null && (
              <span
                style={{
                  background: theme.terminal.red,
                  color: '#fff',
                  borderRadius: '3px',
                  padding: '1px 5px',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  flexShrink: 0
                }}
              >
                {state.exitCode}
              </span>
            )}
            {/* Status label */}
            <span
              style={{
                color: theme.mutedText,
                fontSize: '10px',
                flexShrink: 0
              }}
            >
              {state.status}
            </span>
          </div>
        )
      })}

      {/* Divider */}
      <div style={{ height: '1px', background: theme.borderColor, margin: '4px 0' }} />

      {/* Checklist Section */}
      <div style={sectionHeaderStyle}>Checklist</div>

      {items.map((item) => (
        <div key={item.id} style={rowStyle}>
          <input
            type="checkbox"
            checked={item.done}
            onChange={() => handleToggle(item.id)}
            style={{ cursor: 'pointer', flexShrink: 0, accentColor: theme.accentColor }}
          />
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '12px',
              textDecoration: item.done ? 'line-through' : 'none',
              color: item.done ? theme.mutedText : theme.textColor
            }}
          >
            {item.text}
          </span>
          <button
            onClick={() => handleDelete(item.id)}
            title="Delete"
            style={{
              background: 'none',
              border: 'none',
              color: theme.mutedText,
              cursor: 'pointer',
              fontSize: '13px',
              padding: '0 2px',
              lineHeight: 1,
              flexShrink: 0,
              borderRadius: '2px'
            }}
          >
            ×
          </button>
        </div>
      ))}

      {items.length === 0 && (
        <div style={{ ...rowStyle, color: theme.mutedText, fontStyle: 'italic' }}>
          No items
        </div>
      )}

      {/* Add item input */}
      <div style={{ padding: '6px 10px', marginTop: 'auto' }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem() }}
          placeholder="Add item..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: theme.background,
            border: `1px solid ${theme.borderColor}`,
            borderRadius: '3px',
            color: theme.textColor,
            fontSize: '12px',
            padding: '4px 8px',
            outline: 'none'
          }}
        />
      </div>
    </div>
  )
}

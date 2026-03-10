import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from '../ThemeContext'
import { DispatchQueue } from './DispatchQueue'
import type { Dispatch } from './DispatchQueue'
import type { Receipt } from '../../../preload/index.d'

interface PaneInfo {
  terminalId: string
  cwd: string
  label?: string
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
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]) return parts[i]
  }
  return `terminal ${index + 1}`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

let dispatchCounter = 0
function newDispatchId(): string {
  return `d-${Date.now()}-${++dispatchCounter}`
}

export function OrchestratorPane({ panes }: OrchestratorPaneProps): React.JSX.Element {
  const { theme } = useTheme()

  // --- Terminal Monitor ---
  const [termStates, setTermStates] = useState<Record<string, TerminalState>>(() => {
    const init: Record<string, TerminalState> = {}
    for (const p of panes) init[p.terminalId] = { status: 'idle', exitCode: null }
    return init
  })
  const cleanupRefs = useRef<Record<string, () => void>>({})

  // --- Dispatch Queue ---
  const [dispatches, setDispatches] = useState<Dispatch[]>([])

  // --- Receipt Ledger ---
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [showReceipts, setShowReceipts] = useState(true)

  // --- Checklist ---
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [inputText, setInputText] = useState('')

  // Track previous termStates for transition detection
  const prevTermStatesRef = useRef<Record<string, TerminalState>>({})

  // Load receipts on mount
  useEffect(() => {
    window.receipt.load().then(setReceipts)
  }, [])

  // Subscribe to terminal data
  useEffect(() => {
    const currentIds = new Set(panes.map(p => p.terminalId))

    for (const id of Object.keys(cleanupRefs.current)) {
      if (!currentIds.has(id)) {
        cleanupRefs.current[id]()
        delete cleanupRefs.current[id]
      }
    }

    for (const pane of panes) {
      if (cleanupRefs.current[pane.terminalId]) continue

      const unsub = window.terminal.onData(pane.terminalId, (data: string) => {
        OSC_REGEX.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = OSC_REGEX.exec(data)) !== null) {
          const payload = match[1]
          if (payload === 'A') {
            setTermStates(prev => ({ ...prev, [pane.terminalId]: { status: 'idle', exitCode: null } }))
          } else if (payload === 'B') {
            setTermStates(prev => ({ ...prev, [pane.terminalId]: { status: 'running', exitCode: null } }))
          } else if (payload === 'D;0') {
            setTermStates(prev => ({ ...prev, [pane.terminalId]: { status: 'done', exitCode: 0 } }))
          } else if (payload.startsWith('D;')) {
            const code = parseInt(payload.slice(2), 10)
            setTermStates(prev => ({ ...prev, [pane.terminalId]: { status: 'error', exitCode: isNaN(code) ? 1 : code } }))
          }
        }
      })
      cleanupRefs.current[pane.terminalId] = unsub
    }

    setTermStates(prev => {
      const next = { ...prev }
      for (const p of panes) {
        if (!(p.terminalId in next)) next[p.terminalId] = { status: 'idle', exitCode: null }
      }
      return next
    })
  }, [panes])

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      for (const unsub of Object.values(cleanupRefs.current)) unsub()
      cleanupRefs.current = {}
    }
  }, [])

  // Dispatch lifecycle: detect running→done/error transitions, auto-complete active dispatches
  useEffect(() => {
    const prev = prevTermStatesRef.current
    for (const [termId, state] of Object.entries(termStates)) {
      const prevState = prev[termId]
      if (prevState?.status === 'running' && (state.status === 'done' || state.status === 'error')) {
        setDispatches(prevDispatches => {
          const active = prevDispatches.find(d => d.targetTerminalId === termId && d.status === 'active')
          if (!active) return prevDispatches

          const now = new Date().toISOString()
          const durationMs = active.startedAt ? Date.now() - new Date(active.startedAt).getTime() : undefined
          const receipt: Receipt = {
            id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: now,
            dispatchId: active.id,
            terminalId: termId,
            eventType: state.status === 'done' ? 'task_complete' : 'task_failed',
            exitCode: state.exitCode ?? undefined,
            durationMs,
            title: active.title
          }
          window.receipt.append(receipt)
          setReceipts(r => [...r.slice(-199), receipt])

          return prevDispatches.map(d => d.id === active.id ? {
            ...d,
            status: state.status === 'done' ? 'completed' : 'failed',
            completedAt: now,
            exitCode: state.exitCode ?? undefined
          } : d)
        })
      }
    }
    prevTermStatesRef.current = { ...termStates }
  }, [termStates])

  // Dispatch actions
  const handleCreate = useCallback((title: string, instructions: string, targetTerminalId: string) => {
    const dispatch: Dispatch = {
      id: newDispatchId(),
      title,
      instructions,
      targetTerminalId,
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    setDispatches(prev => [...prev, dispatch])
  }, [])

  const handleApprove = useCallback((id: string) => {
    setDispatches(prev => prev.map(d => {
      if (d.id !== id || d.status !== 'pending') return d
      const now = new Date().toISOString()
      const cmd = `claude -p "${d.instructions.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      window.terminal.write(d.targetTerminalId, cmd + '\r')
      const receipt: Receipt = {
        id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now,
        dispatchId: d.id,
        terminalId: d.targetTerminalId,
        eventType: 'dispatch_sent',
        title: d.title
      }
      window.receipt.append(receipt)
      setReceipts(r => [...r.slice(-199), receipt])
      return { ...d, status: 'active', startedAt: now }
    }))
  }, [])

  const handleReject = useCallback((id: string) => {
    setDispatches(prev => prev.map(d => {
      if (d.id !== id || d.status !== 'pending') return d
      const now = new Date().toISOString()
      const receipt: Receipt = {
        id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now,
        dispatchId: d.id,
        terminalId: d.targetTerminalId,
        eventType: 'task_rejected',
        title: d.title
      }
      window.receipt.append(receipt)
      setReceipts(r => [...r.slice(-199), receipt])
      return { ...d, status: 'rejected', completedAt: now }
    }))
  }, [])

  function handleAddItem(): void {
    const text = inputText.trim()
    if (!text) return
    setItems(prev => [...prev, { id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, done: false }])
    setInputText('')
  }

  function handleToggle(id: string): void {
    setItems(prev => prev.map(item => item.id === id ? { ...item, done: !item.done } : item))
  }

  function handleDelete(id: string): void {
    setItems(prev => prev.filter(item => item.id !== id))
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

  const divider = <div style={{ height: '1px', background: theme.borderColor, margin: '4px 0' }} />

  // Only last 20 receipts, newest first
  const recentReceipts = [...receipts].reverse().slice(0, 20)

  return (
    <div style={{
      width: '300px',
      minWidth: '300px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: theme.headerBg,
      borderLeft: `1px solid ${theme.borderColor}`,
      overflowY: 'auto',
      boxSizing: 'border-box',
      flexShrink: 0
    }}>

      {/* Terminal Monitor */}
      <div style={sectionHeaderStyle}>Terminal Monitor</div>

      {panes.length === 0 && (
        <div style={{ ...rowStyle, color: theme.mutedText, fontStyle: 'italic' }}>No terminals</div>
      )}

      {panes.map((pane, i) => {
        const state = termStates[pane.terminalId] ?? { status: 'idle' as TerminalStatus, exitCode: null }
        const dotColor = statusDotColor(state.status, theme)
        const label = pane.label ?? cwdLabel(pane.cwd, i)

        return (
          <div key={pane.terminalId} style={rowStyle}>
            <span
              className={state.status === 'running' ? 'hs-dot-running' : undefined}
              style={{
                width: '8px', height: '8px', minWidth: '8px', borderRadius: '50%',
                background: dotColor, display: 'inline-block', flexShrink: 0
              }}
              title={state.status}
            />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>
              {label}
            </span>
            {state.status === 'error' && state.exitCode !== null && (
              <span style={{ background: theme.terminal.red, color: '#fff', borderRadius: '3px', padding: '1px 5px', fontSize: '10px', fontFamily: 'monospace', flexShrink: 0 }}>
                {state.exitCode}
              </span>
            )}
            <span style={{ color: theme.mutedText, fontSize: '10px', flexShrink: 0 }}>{state.status}</span>
          </div>
        )
      })}

      {divider}

      {/* Dispatch Queue */}
      <DispatchQueue
        panes={panes}
        dispatches={dispatches}
        onApprove={handleApprove}
        onReject={handleReject}
        onCreate={handleCreate}
      />

      {divider}

      {/* Receipt Ledger */}
      <div
        style={{ ...sectionHeaderStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        onClick={() => setShowReceipts(v => !v)}
      >
        <span>Receipt Ledger</span>
        <span style={{ fontSize: '9px' }}>{showReceipts ? '▲' : '▼'}</span>
      </div>

      {showReceipts && (
        <>
          {recentReceipts.length === 0 && (
            <div style={{ ...rowStyle, color: theme.mutedText, fontStyle: 'italic', height: 'auto', padding: '2px 10px 8px' }}>
              No receipts yet
            </div>
          )}
          {recentReceipts.map(r => {
            const isOk = r.eventType === 'task_complete' || r.eventType === 'dispatch_sent'
            const icon = r.eventType === 'task_complete' ? '✓'
              : r.eventType === 'task_failed' ? '✕'
              : r.eventType === 'task_rejected' ? '–'
              : '→'
            const color = r.eventType === 'task_complete' ? '#6a9955'
              : r.eventType === 'task_failed' ? theme.terminal.red
              : r.eventType === 'task_rejected' ? theme.mutedText
              : theme.terminal.blue

            return (
              <div key={r.id} style={{ padding: '4px 10px', borderTop: `1px solid ${theme.borderColor}20`, fontSize: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ color, fontWeight: 700, flexShrink: 0 }}>{icon}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: theme.textColor }}>
                    {r.title}
                  </span>
                  {r.durationMs !== undefined && (
                    <span style={{ color: theme.mutedText, flexShrink: 0 }}>{formatDuration(r.durationMs)}</span>
                  )}
                </div>
                <div style={{ color: theme.mutedText, fontSize: '10px', marginTop: '1px', display: 'flex', gap: '6px' }}>
                  <span>{formatTime(r.timestamp)}</span>
                  <span>{r.eventType.replace(/_/g, ' ')}</span>
                  {r.exitCode !== undefined && !isOk && <span style={{ color: theme.terminal.red }}>exit {r.exitCode}</span>}
                </div>
              </div>
            )
          })}
        </>
      )}

      {divider}

      {/* Checklist */}
      <div style={sectionHeaderStyle}>Checklist</div>

      {items.map(item => (
        <div key={item.id} style={rowStyle}>
          <input type="checkbox" checked={item.done} onChange={() => handleToggle(item.id)}
            style={{ cursor: 'pointer', flexShrink: 0, accentColor: theme.accentColor }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', textDecoration: item.done ? 'line-through' : 'none', color: item.done ? theme.mutedText : theme.textColor }}>
            {item.text}
          </span>
          <button onClick={() => handleDelete(item.id)} title="Delete"
            style={{ background: 'none', border: 'none', color: theme.mutedText, cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, flexShrink: 0, borderRadius: '2px' }}>
            ×
          </button>
        </div>
      ))}

      {items.length === 0 && (
        <div style={{ ...rowStyle, color: theme.mutedText, fontStyle: 'italic' }}>No items</div>
      )}

      <div style={{ padding: '6px 10px', marginTop: 'auto' }}>
        <input type="text" value={inputText} onChange={e => setInputText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAddItem() }}
          placeholder="Add item..."
          style={{ width: '100%', boxSizing: 'border-box', background: theme.background, border: `1px solid ${theme.borderColor}`, borderRadius: '3px', color: theme.textColor, fontSize: '12px', padding: '4px 8px', outline: 'none' }}
        />
      </div>
    </div>
  )
}

import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useTheme } from '../ThemeContext'

type TerminalStatus = 'idle' | 'running' | 'done' | 'error'

interface TerminalProps {
  id: string
  cwd: string
  isActive: boolean
  onStatusChange?: (status: TerminalStatus) => void
}

interface CommandBlock {
  id: number
  startLine: number
  endLine: number | null
  exitCode: number | null
}


export function Terminal({ id, cwd, isActive, onStatusChange }: TerminalProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const cleanupRef = useRef<(() => void)[]>([])
  const { theme } = useTheme()
  const [blocks, setBlocks] = useState<CommandBlock[]>([])
  const blocksRef = useRef<CommandBlock[]>([])
  const blockIdRef = useRef(0)
  const currentBlockRef = useRef<CommandBlock | null>(null)

  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const hadCommandRef = useRef(false)
  const isRunningRef = useRef(false)

  const updateBlocks = useCallback((updater: (prev: CommandBlock[]) => CommandBlock[]) => {
    blocksRef.current = updater(blocksRef.current)
    setBlocks([...blocksRef.current])
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const xterm = new XTerm({
      theme: theme.terminal,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const webLinksAddon = new WebLinksAddon()

    xterm.loadAddon(fitAddon)
    xterm.loadAddon(searchAddon)
    xterm.loadAddon(webLinksAddon)
    xterm.open(containerRef.current)
    fitAddon.fit()

    // Reposition xterm's internal textarea so voice dictation tools (e.g. Wispr)
    // can detect it as an active text field. By default xterm hides it at left:-9999em.
    if (xterm.textarea) {
      Object.assign(xterm.textarea.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: '100%',
        height: '100%',
        opacity: '0',
        zIndex: '1',
        pointerEvents: 'none'
      })
      // Intercept paste in capture phase (before xterm's own paste listener) so
      // that paste events — including those from Wispr / clipboard tools — are
      // handled exactly once. Without this, Ctrl+V triggers both our keydown
      // handler AND xterm's paste handler → double input.
      xterm.textarea.addEventListener('paste', (e) => {
        e.stopImmediatePropagation()
        e.preventDefault() // prevent browser from also inserting into textarea (would cause double-write)
        const text = e.clipboardData?.getData('text')
        if (text) window.terminal.write(id, text)
      }, true)
    }

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon
    searchAddonRef.current = searchAddon

    // Keyboard shortcuts
    xterm.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true

      // Ctrl+F: open search overlay
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
        return false
      }

      // Ctrl+C: copy selection if text is selected, otherwise pass through (SIGINT)
      if (e.ctrlKey && e.key === 'c') {
        const selection = xterm.getSelection()
        if (selection) {
          navigator.clipboard.writeText(selection)
          return false
        }
        return true
      }

      // Ctrl+V: handled by the textarea paste event listener (capture phase)
      // to avoid double-paste. Just suppress xterm's built-in Ctrl+V → \x16.
      if (e.ctrlKey && e.key === 'v') {
        return false
      }

      // Ctrl+A: select all
      if (e.ctrlKey && e.key === 'a') {
        xterm.selectAll()
        return false
      }

      // Shift+Enter: insert literal newline without executing (readline quoted-insert)
      if (e.shiftKey && e.key === 'Enter') {
        window.terminal.write(id, '\x16\x0a')
        // PSReadLine may shrink the scroll region on redraw — reset it, but only
        // when NOT inside a running command (e.g. Claude Code TUI), otherwise
        // we'd corrupt the TUI's scroll region layout.
        if (!isRunningRef.current) {
          setTimeout(() => xterm.write('\x1b[r'), 150)
        }
        return false
      }

      return true
    })

    // OSC 133 handler
    xterm.parser.registerOscHandler(133, (data) => {
      const type = data.split(';')[0]
      const buf = xterm.buffer.active

      if (type === 'B') {
        // Command about to execute (Enter pressed at shell prompt)
        isRunningRef.current = true
        onStatusChange?.('running')
      } else if (type === 'A') {
        // Prompt ready — if a command just ran, reset scroll region now (safe: TUI is gone)
        if (hadCommandRef.current) {
          hadCommandRef.current = false
          xterm.write('\x1b[r')
        }
        onStatusChange?.('idle')
        // Begin new block
        const line = buf.baseY + buf.cursorY
        const block: CommandBlock = {
          id: blockIdRef.current++,
          startLine: line,
          endLine: null,
          exitCode: null
        }
        currentBlockRef.current = block
        updateBlocks((prev) => [...prev, block])
      } else if (type === 'D') {
        // Command done — mark that a command ran so A can reset scroll region
        hadCommandRef.current = true
        isRunningRef.current = false
        const exitCode = parseInt(data.split(';')[1] ?? '0') || 0
        onStatusChange?.(exitCode === 0 ? 'done' : 'error')
        const line = buf.baseY + buf.cursorY
        if (currentBlockRef.current) {
          const id = currentBlockRef.current.id
          currentBlockRef.current = null
          updateBlocks((prev) =>
            prev.map((b) => (b.id === id ? { ...b, endLine: line, exitCode } : b))
          )
        }
      }
      return true // consumed — don't render raw sequence
    })

    window.terminal.create(id, cwd).then(() => {
      const unsubData = window.terminal.onData(id, (data) => {
        xterm.write(data)
      })
      const unsubExit = window.terminal.onExit(id, () => {
        xterm.writeln('\r\n\x1b[90m[Process exited]\x1b[0m')
      })
      cleanupRef.current.push(unsubData, unsubExit)
      // Trigger resize so pty redraws its output after HMR reconnect
      setTimeout(() => {
        if (fitAddonRef.current && xtermRef.current) {
          fitAddon.fit()
          window.terminal.resize(id, xterm.cols, xterm.rows)
        }
      }, 150)
    })

    xterm.onData((data) => {
      window.terminal.write(id, data)
    })

    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddon.fit()
          const { cols, rows } = xterm
          window.terminal.resize(id, cols, rows)
        } catch { /* ignore */ }
      }
    })
    observer.observe(containerRef.current)
    cleanupRef.current.push(() => observer.disconnect())

    return () => {
      cleanupRef.current.forEach((fn) => fn())
      cleanupRef.current = []
      window.terminal.kill(id)
      xterm.dispose()
      blocksRef.current = []
      setBlocks([])
      hadCommandRef.current = false
      isRunningRef.current = false
    }
  }, [id, cwd])

  // Live theme update
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = theme.terminal
    }
  }, [theme])

  // Focus on active
  useEffect(() => {
    if (isActive && xtermRef.current) xtermRef.current.focus()
  }, [isActive])

  // Auto-focus search input when search opens
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showSearch])

  const closeSearch = useCallback(() => {
    setShowSearch(false)
    setSearchQuery('')
    if (searchAddonRef.current) {
      searchAddonRef.current.clearDecorations()
    }
    if (xtermRef.current) {
      xtermRef.current.focus()
    }
  }, [])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      closeSearch()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (searchAddonRef.current && searchQuery) {
        if (e.shiftKey) {
          searchAddonRef.current.findPrevious(searchQuery)
        } else {
          searchAddonRef.current.findNext(searchQuery)
        }
      }
    }
  }, [closeSearch, searchQuery])

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)
    if (searchAddonRef.current && val) {
      searchAddonRef.current.findNext(val)
    } else if (searchAddonRef.current && !val) {
      searchAddonRef.current.clearDecorations()
    }
  }, [])

  const scrollToBlock = useCallback((block: CommandBlock) => {
    if (!xtermRef.current) return
    const buf = xtermRef.current.buffer.active
    const viewportY = block.startLine - buf.baseY - 2
    xtermRef.current.scrollToLine(Math.max(0, viewportY))
  }, [])

  const scrollToPrevBlock = useCallback(() => {
    if (!xtermRef.current || blocks.length === 0) return
    const buf = xtermRef.current.buffer.active
    const currentLine = buf.baseY + buf.viewportY
    const prev = [...blocks].reverse().find((b) => b.startLine < currentLine - 1)
    if (prev) scrollToBlock(prev)
  }, [blocks, scrollToBlock])

  const scrollToNextBlock = useCallback(() => {
    if (!xtermRef.current || blocks.length === 0) return
    const buf = xtermRef.current.buffer.active
    const currentLine = buf.baseY + buf.viewportY
    const next = blocks.find((b) => b.startLine > currentLine + 1)
    if (next) scrollToBlock(next)
  }, [blocks, scrollToBlock])

  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: theme.textColor,
    cursor: 'pointer',
    fontSize: '13px',
    padding: '0 6px',
    lineHeight: '32px',
    opacity: 0.8
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* Block navigation bar */}
      {blocks.length > 0 && (
        <div
          style={{
            height: '22px',
            minHeight: '22px',
            background: theme.headerBg,
            borderBottom: `1px solid ${theme.borderColor}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            gap: '8px',
            fontSize: '11px',
            color: theme.mutedText,
            userSelect: 'none'
          }}
        >
          <button
            onClick={scrollToPrevBlock}
            title="Previous block (Alt+Up)"
            style={{ background: 'none', border: 'none', color: theme.mutedText, cursor: 'pointer', fontSize: '12px', padding: '0 4px' }}
          >
            ↑
          </button>
          <button
            onClick={scrollToNextBlock}
            title="Next block (Alt+Down)"
            style={{ background: 'none', border: 'none', color: theme.mutedText, cursor: 'pointer', fontSize: '12px', padding: '0 4px' }}
          >
            ↓
          </button>
          <span>{blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
          <div style={{ display: 'flex', gap: '3px', marginLeft: 'auto', alignItems: 'center' }}>
            {blocks.slice(-8).map((b) => (
              <div
                key={b.id}
                onClick={() => scrollToBlock(b)}
                title={`Block ${b.id + 1}${b.exitCode !== null ? ` (exit ${b.exitCode})` : ''}`}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  background: b.exitCode === null
                    ? theme.accentColor
                    : b.exitCode === 0
                      ? '#6a9955'
                      : '#f44747'
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Search bar */}
      {showSearch && (
        <div
          style={{
            height: '32px',
            minHeight: '32px',
            background: theme.headerBg,
            borderBottom: `1px solid ${theme.borderColor}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            gap: '4px',
            zIndex: 50
          }}
        >
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Find..."
            style={{
              flex: 1,
              background: 'transparent',
              border: `1px solid ${theme.borderColor}`,
              borderRadius: '3px',
              color: theme.textColor,
              fontSize: '12px',
              padding: '2px 6px',
              outline: 'none',
              height: '22px'
            }}
          />
          <button
            onClick={() => searchAddonRef.current && searchQuery && searchAddonRef.current.findPrevious(searchQuery)}
            title="Previous match (Shift+Enter)"
            style={btnStyle}
          >
            ↑
          </button>
          <button
            onClick={() => searchAddonRef.current && searchQuery && searchAddonRef.current.findNext(searchQuery)}
            title="Next match (Enter)"
            style={btnStyle}
          >
            ↓
          </button>
          <button
            onClick={closeSearch}
            title="Close (Escape)"
            style={{ ...btnStyle, fontSize: '16px' }}
          >
            ×
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          padding: '4px'
        }}
      />
    </div>
  )
}

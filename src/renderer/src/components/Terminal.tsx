import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useTheme } from '../ThemeContext'

interface TerminalProps {
  id: string
  cwd: string
  isActive: boolean
}

interface CommandBlock {
  id: number
  startLine: number
  endLine: number | null
  exitCode: number | null
}


export function Terminal({ id, cwd, isActive }: TerminalProps): React.JSX.Element {
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

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon
    searchAddonRef.current = searchAddon

    // Ctrl+F: open search overlay (only when terminal is focused)
    xterm.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type === 'keydown' && e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
        return false
      }
      return true
    })

    // OSC 133 handler
    xterm.parser.registerOscHandler(133, (data) => {
      const type = data.split(';')[0]
      const buf = xterm.buffer.active

      if (type === 'A') {
        // Prompt start — begin new block
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
        // Command done
        const exitCode = parseInt(data.split(';')[1] ?? '0') || 0
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

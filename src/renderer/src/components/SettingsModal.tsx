import { useState, useEffect } from 'react'
import { useTheme } from '../ThemeContext'
import { useShortcuts } from '../ShortcutsContext'
import { THEMES } from '../themes'
import type { ShortcutDef } from '../ShortcutsContext'

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps): React.JSX.Element {
  const { theme, themeId, setThemeId } = useTheme()
  const { shortcuts, setShortcuts } = useShortcuts()
  const [activeTab, setActiveTab] = useState<'appearance' | 'shortcuts'>('appearance')
  const [recordingId, setRecordingId] = useState<string | null>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && recordingId === null) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, recordingId])

  // Record new shortcut
  useEffect(() => {
    if (!recordingId) return
    const handler = (e: KeyboardEvent): void => {
      e.preventDefault()
      if (e.key === 'Escape') {
        setRecordingId(null)
        return
      }
      // Ignore modifier-only keypresses
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return
      setShortcuts(
        shortcuts.map((s) =>
          s.id === recordingId
            ? { ...s, key: e.key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey }
            : s
        )
      )
      setRecordingId(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [recordingId, shortcuts, setShortcuts])

  const formatShortcut = (s: ShortcutDef): string => {
    const parts: string[] = []
    if (s.ctrl) parts.push('Ctrl')
    if (s.alt) parts.push('Alt')
    if (s.shift) parts.push('Shift')
    parts.push(s.key === ' ' ? 'Space' : s.key.toUpperCase())
    return parts.join('+')
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  }

  const modalStyle: React.CSSProperties = {
    background: theme.headerBg,
    border: `1px solid ${theme.borderColor}`,
    borderRadius: '8px',
    width: '480px',
    maxHeight: '540px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px',
    background: active ? theme.background : 'transparent',
    color: active ? theme.textColor : theme.mutedText,
    border: 'none',
    borderBottom: active ? `2px solid ${theme.accentColor}` : '2px solid transparent',
    cursor: 'pointer',
    fontSize: '13px'
  })

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: `1px solid ${theme.borderColor}`
          }}
        >
          <span style={{ color: theme.textColor, fontWeight: 600, fontSize: '14px' }}>
            Settings
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: theme.mutedText,
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0 4px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${theme.borderColor}` }}>
          <button style={tabStyle(activeTab === 'appearance')} onClick={() => setActiveTab('appearance')}>
            Appearance
          </button>
          <button style={tabStyle(activeTab === 'shortcuts')} onClick={() => setActiveTab('shortcuts')}>
            Shortcuts
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {activeTab === 'appearance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    background: t.id === themeId ? theme.background : 'transparent',
                    border: `1px solid ${t.id === themeId ? theme.accentColor : theme.borderColor}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  {/* Color preview dots */}
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.background, border: '1px solid rgba(255,255,255,0.2)' }} />
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.accentColor }} />
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.statusBarBg }} />
                  </div>
                  <span style={{ color: theme.textColor, fontSize: '13px' }}>{t.name}</span>
                  {t.id === themeId && (
                    <span style={{ marginLeft: 'auto', color: theme.accentColor, fontSize: '12px' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {shortcuts.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: recordingId === s.id ? theme.background : 'transparent',
                    border: `1px solid ${recordingId === s.id ? theme.accentColor : theme.borderColor}`,
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                  onClick={() => setRecordingId(s.id)}
                >
                  <span style={{ color: theme.textColor, fontSize: '13px' }}>{s.label}</span>
                  <span
                    style={{
                      color: recordingId === s.id ? theme.accentColor : theme.mutedText,
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      background: theme.background,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${theme.borderColor}`
                    }}
                  >
                    {recordingId === s.id ? 'Press keys…' : formatShortcut(s)}
                  </span>
                </div>
              ))}
              <p style={{ color: theme.mutedText, fontSize: '11px', marginTop: '8px' }}>
                Click a row, then press your desired key combination.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

export interface ShortcutDef {
  id: string
  label: string
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean
}

export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  { id: 'newWorkspace', label: 'New Workspace', key: 't', ctrl: true, alt: false, shift: false },
  { id: 'closeWorkspace', label: 'Close Workspace', key: 'w', ctrl: true, alt: false, shift: false },
  { id: 'splitHorizontal', label: 'Split Horizontal', key: '\\', ctrl: true, alt: false, shift: false },
  { id: 'splitVertical', label: 'Split Vertical', key: '-', ctrl: true, alt: false, shift: false }
]

export function matchesShortcut(
  e: KeyboardEvent | React.KeyboardEvent,
  def: ShortcutDef
): boolean {
  return (
    e.key === def.key &&
    e.ctrlKey === def.ctrl &&
    e.altKey === def.alt &&
    e.shiftKey === def.shift
  )
}

interface ShortcutsContextValue {
  shortcuts: ShortcutDef[]
  setShortcuts: (shortcuts: ShortcutDef[]) => void
  getShortcut: (id: string) => ShortcutDef | undefined
}

const ShortcutsContext = createContext<ShortcutsContextValue>(null!)

export function ShortcutsProvider({
  children,
  initialShortcuts
}: {
  children: ReactNode
  initialShortcuts?: ShortcutDef[]
}): React.JSX.Element {
  const [shortcuts, setShortcuts] = useState<ShortcutDef[]>(
    initialShortcuts ?? DEFAULT_SHORTCUTS
  )

  const getShortcut = (id: string): ShortcutDef | undefined =>
    shortcuts.find((s) => s.id === id)

  return (
    <ShortcutsContext.Provider value={{ shortcuts, setShortcuts, getShortcut }}>
      {children}
    </ShortcutsContext.Provider>
  )
}

export function useShortcuts(): ShortcutsContextValue {
  return useContext(ShortcutsContext)
}

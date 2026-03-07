import { ElectronAPI } from '@electron-toolkit/preload'

type TerminalAPI = {
  create: (id: string, cwd: string) => Promise<{ pid: number }>
  write: (id: string, data: string) => void
  resize: (id: string, cols: number, rows: number) => void
  kill: (id: string) => void
  onData: (id: string, cb: (data: string) => void) => () => void
  onExit: (id: string, cb: (exitCode: number) => void) => () => void
}

export type SessionData = {
  themeId?: string
  shortcuts?: Array<{
    id: string
    label: string
    key: string
    ctrl: boolean
    alt: boolean
    shift: boolean
  }>
  workspaces?: Array<{ id: string; name: string; cwd: string; color?: string }>
  activeWorkspaceId?: string
}

type SessionAPI = {
  load: () => Promise<SessionData | null>
  save: (data: SessionData) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    terminal: TerminalAPI
    session: SessionAPI
  }
}

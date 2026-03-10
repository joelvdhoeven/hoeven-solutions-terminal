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

export type Dispatch = {
  id: string
  title: string
  instructions: string
  targetTerminalId: string
  status: 'pending' | 'active' | 'completed' | 'failed' | 'rejected'
  createdAt: string
  startedAt?: string
  completedAt?: string
  exitCode?: number
}

export type Receipt = {
  id: string
  timestamp: string
  dispatchId: string
  terminalId: string
  eventType: 'dispatch_sent' | 'task_complete' | 'task_failed' | 'task_rejected'
  exitCode?: number
  durationMs?: number
  title: string
}

type ReceiptAPI = {
  append: (receipt: Receipt) => Promise<void>
  load: () => Promise<Receipt[]>
}

type WindowControlsAPI = {
  minimize: () => void
  maximize: () => void
  close: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    terminal: TerminalAPI
    session: SessionAPI
    receipt: ReceiptAPI
    windowControls: WindowControlsAPI
  }
}

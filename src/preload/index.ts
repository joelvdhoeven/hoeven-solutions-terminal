import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const terminalAPI = {
  create: (id: string, cwd: string) => ipcRenderer.invoke('terminal:create', id, cwd),
  write: (id: string, data: string) => ipcRenderer.send('terminal:write', id, data),
  resize: (id: string, cols: number, rows: number) =>
    ipcRenderer.send('terminal:resize', id, cols, rows),
  kill: (id: string) => ipcRenderer.send('terminal:kill', id),
  onData: (id: string, cb: (data: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, termId: string, data: string) => {
      if (termId === id) cb(data)
    }
    ipcRenderer.on('terminal:data', listener)
    return () => ipcRenderer.removeListener('terminal:data', listener)
  },
  onExit: (id: string, cb: (exitCode: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, termId: string, code: number) => {
      if (termId === id) cb(code)
    }
    ipcRenderer.on('terminal:exit', listener)
    return () => ipcRenderer.removeListener('terminal:exit', listener)
  }
}

const sessionAPI = {
  load: () => ipcRenderer.invoke('session:load'),
  save: (data: unknown) => ipcRenderer.invoke('session:save', data)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('terminal', terminalAPI)
    contextBridge.exposeInMainWorld('session', sessionAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.terminal = terminalAPI
  // @ts-ignore
  window.session = sessionAPI
}

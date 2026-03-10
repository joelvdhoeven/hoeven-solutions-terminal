import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join, basename } from 'path'
import { writeFileSync, mkdirSync, rmSync, appendFileSync, readFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import * as pty from 'node-pty'
import icon from '../../resources/icon.png?asset'

// Map of terminal id -> pty process
const terminals = new Map<string, pty.IPty>()
// Pending kill timers — cancelled if terminal reconnects within grace period (HMR)
const killTimers = new Map<string, ReturnType<typeof setTimeout>>()
let mainWindow: BrowserWindow | null = null
let store: any = null

async function initStore(): Promise<void> {
  const { default: Store } = await import('electron-store')
  store = new Store()
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#1a1a1a',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await initStore()

  electronApp.setAppUserModelId('com.hoeevensolutions')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC: Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())

  // IPC: Session load
  ipcMain.handle('session:load', () => {
    return store?.get('session') ?? null
  })

  // IPC: Session save
  ipcMain.handle('session:save', (_e, data) => {
    store?.set('session', data)
  })

  // IPC: Create terminal
  ipcMain.handle('terminal:create', async (_event, id: string, cwd: string) => {
    // Cancel pending kill if same terminal reconnects (HMR reload scenario)
    if (killTimers.has(id)) {
      clearTimeout(killTimers.get(id)!)
      killTimers.delete(id)
    }
    // Reattach to existing pty if still alive
    if (terminals.has(id)) {
      const existing = terminals.get(id)!
      // Send resize to trigger redraw in the reconnected xterm instance
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send('terminal:data', id, '\x1b[?2026h\x1b[r')
        }
      }, 100)
      return { pid: existing.pid }
    }

    let shell: string
    if (process.platform === 'win32') {
      // Try PowerShell 7 first, fall back to Windows PowerShell 5
      const { execSync } = await import('child_process')
      try {
        execSync('pwsh.exe -NoProfile -Command exit', { timeout: 2000, stdio: 'ignore' })
        shell = 'pwsh.exe'
      } catch {
        shell = 'powershell.exe'
      }
    } else {
      shell = process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash')
    }

    const defaultCwd =
      cwd ||
      (process.platform === 'win32' ? process.env.USERPROFILE : process.env.HOME) ||
      process.cwd()

    // Filter out undefined env values and strip Claude Code nesting guard
    const cleanEnv = Object.fromEntries(
      Object.entries(process.env).filter(([k, v]) => v !== undefined && k !== 'CLAUDECODE')
    ) as Record<string, string>

    // OSC 133 shell integration
    const shellArgs: string[] = []
    const shellLower = shell.toLowerCase()
    const shellBase = basename(shell).toLowerCase()

    if (shellLower.includes('pwsh') || shellLower.includes('powershell')) {
      // PowerShell (Windows) — use [char]27 for ESC, works on PS 5.1 and PS 7+
      // D;$ec before A signals command completion to the orchestrator pane
      shellArgs.push('-NoExit', '-Command', [
        '$global:__hs_first = $true',
        'function global:prompt {',
        '  $ec = $LASTEXITCODE',
        '  if (-not $global:__hs_first) { Write-Host -NoNewline "$([char]27)]133;D;$ec$([char]7)" }',
        '  $global:__hs_first = $false',
        '  Write-Host -NoNewline "$([char]27)]133;A$([char]7)"',
        '  Write-Host -NoNewline ("PS " + (Get-Location).Path + "> ")',
        '  Write-Host -NoNewline "$([char]27)]133;B$([char]7)"',
        '  $global:LASTEXITCODE = $ec',
        '  return ""',
        '}'
      ].join('; '))
    } else if (shellBase === 'bash') {
      // Bash (Linux/macOS)
      const tmpFile = join(app.getPath('temp'), `hs-init-${id}.sh`)
      writeFileSync(tmpFile, [
        '[ -f ~/.bashrc ] && source ~/.bashrc 2>/dev/null',
        '[ -f ~/.bash_profile ] && source ~/.bash_profile 2>/dev/null',
        '__hs_first=1',
        // Capture $? first, emit D;exitcode after first prompt, then A
        'PROMPT_COMMAND=\'__hs_exit=$?; [ -z "${__hs_first:-}" ] && printf "\\033]133;D;%s\\a" "$__hs_exit"; unset __hs_first; printf "\\033]133;A\\a"\''
      ].join('\n'))
      shellArgs.push('--rcfile', tmpFile)
      // Clean up on exit, not via timeout
      process.on('exit', () => { try { rmSync(tmpFile) } catch { /* ignore */ } })
    } else if (shellBase === 'zsh') {
      // Zsh (macOS/Linux)
      const zdotdir = join(app.getPath('temp'), `hs-zdot-${id}`)
      mkdirSync(zdotdir, { recursive: true })
      writeFileSync(join(zdotdir, '.zshrc'), [
        '[ -f "$HOME/.zshenv" ] && source "$HOME/.zshenv" 2>/dev/null',
        '[ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc" 2>/dev/null',
        '__hs_first=1',
        'precmd() { local ec=$?; [[ -z ${__hs_first:-} ]] && printf "\\033]133;D;%s\\a" "$ec"; unset __hs_first; printf "\\033]133;A\\a" }',
        'preexec() { printf "\\033]133;B\\a" }'
      ].join('\n'))
      cleanEnv['ZDOTDIR'] = zdotdir
      process.on('exit', () => { try { rmSync(zdotdir, { recursive: true }) } catch { /* ignore */ } })
    }

    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: defaultCwd,
      env: cleanEnv,
      ...(process.platform === 'win32' ? { useConpty: false } : {})
    })

    terminals.set(id, ptyProcess)

    ptyProcess.onData((data) => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('terminal:data', id, data)
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      terminals.delete(id)
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('terminal:exit', id, exitCode)
      }
    })

    return { pid: ptyProcess.pid }
  })

  // IPC: Write to terminal
  ipcMain.on('terminal:write', (_event, id: string, data: string) => {
    terminals.get(id)?.write(data)
  })

  // IPC: Resize terminal
  ipcMain.on('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    const ptyProcess = terminals.get(id)
    if (ptyProcess) {
      try {
        ptyProcess.resize(Math.max(cols, 1), Math.max(rows, 1))
      } catch {
        // ignore resize errors
      }
    }
  })

  // IPC: Kill terminal — delayed to survive HMR remounts
  ipcMain.on('terminal:kill', (_event, id: string) => {
    if (killTimers.has(id)) clearTimeout(killTimers.get(id)!)
    const timer = setTimeout(() => {
      killTimers.delete(id)
      const ptyProcess = terminals.get(id)
      if (ptyProcess) {
        ptyProcess.kill()
        terminals.delete(id)
      }
    }, 2000)
    killTimers.set(id, timer)
  })

  // IPC: Append receipt to NDJSON ledger
  ipcMain.handle('receipt:append', (_event, receipt: object) => {
    const receiptsPath = join(app.getPath('userData'), 'receipts.ndjson')
    appendFileSync(receiptsPath, JSON.stringify(receipt) + '\n')
  })

  // IPC: Load receipts from ledger
  ipcMain.handle('receipt:load', () => {
    const receiptsPath = join(app.getPath('userData'), 'receipts.ndjson')
    try {
      const content = readFileSync(receiptsPath, 'utf-8')
      return content.trim().split('\n').filter(Boolean).slice(-200).map((l) => JSON.parse(l))
    } catch {
      return []
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  killTimers.forEach((t) => clearTimeout(t))
  killTimers.clear()
  terminals.forEach((p) => p.kill())
  terminals.clear()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

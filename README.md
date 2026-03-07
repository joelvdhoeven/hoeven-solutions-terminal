# Hoeven Solutions Terminal

A modern, cross-platform terminal emulator built as a weekend project. Inspired by tools like Warp and BridgeSpace — multiple workspaces, pane splitting, themes, and Warp-style command blocks, all in a lightweight Electron app.

## Features

- **Multiple Workspaces** — tabbed workspaces, each with independent terminal sessions
- **Workspace Templates** — click `+` and pick a grid layout (up to 4×4) to open a workspace pre-split into panes instantly
- **Pane Splitting** — split any pane horizontally or vertically, resize with drag handles
- **15 Themes** — dark and light presets: VSCode Dark, Dracula, Nord, Monokai, Synthwave, Cyberpunk, Neon Tokyo, GitHub Light, Solarized Light, and more
- **Custom Shortcuts** — reassign any keyboard shortcut from the settings modal
- **Session Persistence** — workspaces, active tab, theme, and shortcuts are restored on next launch
- **Command Blocks** — shell integration via OSC 133 groups commands into navigable blocks with exit-code colour indicators (green = ok, red = error)
- **Cross-platform** — Windows (PowerShell / pwsh), macOS (zsh), Linux (bash/zsh)

## Shortcuts

| Action | Default |
|--------|---------|
| New workspace | `Ctrl+T` |
| Close workspace | `Ctrl+W` |
| Split pane (side by side) | `Ctrl+\` |
| Split pane (top/bottom) | `Ctrl+-` |

All shortcuts are configurable via **Settings → Shortcuts** (click the ⚙ icon in the status bar).

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install & run

```bash
git clone https://github.com/joelvdhoeven/hoeven-solutions-terminal
cd hoeven-solutions-terminal
npm install
npm run dev
```

### Build

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 39 |
| UI | React 19 + TypeScript |
| Terminal | xterm.js 6 + node-pty |
| Layout | react-resizable-panels |
| Persistence | electron-store |
| Build | electron-vite + Vite 7 |

## License

MIT

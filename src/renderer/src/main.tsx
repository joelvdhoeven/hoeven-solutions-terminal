import './assets/main.css'

import { createRoot } from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './ThemeContext'
import { ShortcutsProvider } from './ShortcutsContext'

async function init(): Promise<void> {
  const session = await window.session.load()

  createRoot(document.getElementById('root')!).render(
    <ShortcutsProvider initialShortcuts={session?.shortcuts as any}>
      <ThemeProvider initialThemeId={session?.themeId}>
        <App initialSession={session as any} />
      </ThemeProvider>
    </ShortcutsProvider>
  )
}

init()

import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { AppTheme, THEMES } from './themes'

interface ThemeContextValue {
  theme: AppTheme
  themeId: string
  setThemeId: (id: string) => void
}

const ThemeContext = createContext<ThemeContextValue>(null!)

export function ThemeProvider({
  children,
  initialThemeId
}: {
  children: ReactNode
  initialThemeId?: string
}): React.JSX.Element {
  const [themeId, setThemeId] = useState(initialThemeId ?? 'vscode-dark')
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]
  return <ThemeContext.Provider value={{ theme, themeId, setThemeId }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}

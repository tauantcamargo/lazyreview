import React, { createContext, useContext } from 'react'
import type { Theme, ThemeName } from './types'
import { themes, defaultTheme } from './themes'

export type { Theme, ThemeColors, ThemeName } from './types'
export { themes, defaultTheme } from './themes'

const ThemeContext = createContext<Theme>(defaultTheme)

export interface ThemeProviderProps {
  readonly theme?: Theme
  readonly children: React.ReactNode
}

export function ThemeProvider({
  theme = defaultTheme,
  children,
}: ThemeProviderProps): React.ReactElement {
  return React.createElement(ThemeContext.Provider, { value: theme }, children)
}

export function useTheme(): Theme {
  return useContext(ThemeContext)
}

export function getThemeByName(name: ThemeName): Theme {
  return themes[name] ?? defaultTheme
}

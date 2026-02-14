import React, { createContext, useContext } from 'react'
import type { Theme, ThemeName, BuiltInThemeName } from './types'
import { BUILT_IN_THEME_NAMES } from './types'
import { themes, defaultTheme } from './themes'
import type { CustomThemeFile } from './custom-themes'
import { resolveTheme } from './custom-themes'

export type { Theme, ThemeColors, ThemeName, BuiltInThemeName } from './types'
export { BUILT_IN_THEME_NAMES } from './types'
export type { CustomThemeFile, ValidationResult, LoadResult } from './custom-themes'
export { loadCustomThemes, validateThemeColors, parseCustomThemeFile, resolveTheme } from './custom-themes'
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

/**
 * Registry of custom themes loaded at startup.
 * Custom themes are appended here after being loaded from
 * `~/.config/lazyreview/themes/`.
 */
let customThemeRegistry: readonly CustomThemeFile[] = []

/**
 * Set the loaded custom themes into the registry.
 * Called once at startup after loadCustomThemes().
 */
export function setCustomThemes(customThemes: readonly CustomThemeFile[]): void {
  customThemeRegistry = customThemes
}

/**
 * Get the current custom theme registry.
 */
export function getCustomThemes(): readonly CustomThemeFile[] {
  return customThemeRegistry
}

/**
 * Get a flat map of all built-in ThemeColors keyed by name.
 */
function getBuiltInColorsMap(): Record<string, import('./types').ThemeColors> {
  const map: Record<string, import('./types').ThemeColors> = {}
  for (const name of BUILT_IN_THEME_NAMES) {
    map[name] = themes[name].colors
  }
  return map
}

/**
 * Get the ordered list of all available theme names (built-in + custom).
 */
export function getAllThemeNames(): readonly string[] {
  const builtIn: readonly string[] = [...BUILT_IN_THEME_NAMES]
  const custom = customThemeRegistry.map((t) => t.name)
  return [...builtIn, ...custom]
}

/**
 * Check whether a theme name is a custom theme.
 */
export function isCustomTheme(name: string): boolean {
  return customThemeRegistry.some((t) => t.name === name)
}

/**
 * Get the custom theme metadata (e.g. extends info) if it exists.
 */
export function getCustomThemeMeta(name: string): CustomThemeFile | undefined {
  return customThemeRegistry.find((t) => t.name === name)
}

/**
 * Resolve a theme by name from built-in or custom themes.
 * Falls back to the default theme if not found.
 */
export function getThemeByName(name: ThemeName): Theme {
  // Check built-in themes first
  if (BUILT_IN_THEME_NAMES.includes(name as BuiltInThemeName)) {
    return themes[name as BuiltInThemeName] ?? defaultTheme
  }

  // Check custom themes
  const custom = customThemeRegistry.find((t) => t.name === name)
  if (custom) {
    const builtInColors = getBuiltInColorsMap()
    const resolved = resolveTheme(custom, builtInColors)
    return { name: custom.name, colors: resolved }
  }

  return defaultTheme
}

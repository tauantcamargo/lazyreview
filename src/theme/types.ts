export interface Theme {
  readonly name: string
  readonly colors: ThemeColors
}

export interface ThemeColors {
  readonly bg: string
  readonly text: string
  readonly accent: string
  readonly muted: string
  readonly border: string
  readonly primary: string
  readonly secondary: string

  readonly success: string
  readonly error: string
  readonly warning: string
  readonly info: string

  readonly diffAdd: string
  readonly diffDel: string
  readonly diffAddHighlight: string
  readonly diffDelHighlight: string

  readonly selection: string
  readonly listSelectedFg: string
  readonly listSelectedBg: string
}

/**
 * Built-in theme names as a string literal union for type safety.
 */
export type BuiltInThemeName = 'tokyo-night' | 'dracula' | 'catppuccin-mocha' | 'gruvbox' | 'high-contrast' | 'github-light'

/**
 * All built-in theme names as a readonly array for iteration.
 */
export const BUILT_IN_THEME_NAMES: readonly BuiltInThemeName[] = [
  'tokyo-night',
  'dracula',
  'catppuccin-mocha',
  'gruvbox',
  'high-contrast',
  'github-light',
] as const

/**
 * Theme name type -- accepts both built-in and custom theme names.
 * Use BuiltInThemeName when you need to narrow to built-in themes only.
 */
export type ThemeName = string

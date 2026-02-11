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

  readonly selection: string
  readonly listSelectedFg: string
  readonly listSelectedBg: string
}

export type ThemeName = 'tokyo-night' | 'dracula' | 'catppuccin-mocha'

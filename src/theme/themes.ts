import type { Theme, ThemeName } from './types'

const tokyoNight: Theme = {
  name: 'tokyo-night',
  colors: {
    bg: '#1a1b26',
    text: '#c0caf5',
    accent: '#7aa2f7',
    muted: '#565f89',
    border: '#3b4261',
    primary: '#7aa2f7',
    secondary: '#bb9af7',

    success: '#9ece6a',
    error: '#f7768e',
    warning: '#e0af68',
    info: '#7dcfff',

    diffAdd: '#9ece6a',
    diffDel: '#f7768e',

    selection: '#283457',
    listSelectedFg: '#c0caf5',
    listSelectedBg: '#283457',
  },
}

const dracula: Theme = {
  name: 'dracula',
  colors: {
    bg: '#282a36',
    text: '#f8f8f2',
    accent: '#bd93f9',
    muted: '#6272a4',
    border: '#44475a',
    primary: '#bd93f9',
    secondary: '#ff79c6',

    success: '#50fa7b',
    error: '#ff5555',
    warning: '#f1fa8c',
    info: '#8be9fd',

    diffAdd: '#50fa7b',
    diffDel: '#ff5555',

    selection: '#44475a',
    listSelectedFg: '#f8f8f2',
    listSelectedBg: '#44475a',
  },
}

const catppuccinMocha: Theme = {
  name: 'catppuccin-mocha',
  colors: {
    bg: '#1e1e2e',
    text: '#cdd6f4',
    accent: '#89b4fa',
    muted: '#6c7086',
    border: '#313244',
    primary: '#89b4fa',
    secondary: '#cba6f7',

    success: '#a6e3a1',
    error: '#f38ba8',
    warning: '#f9e2af',
    info: '#89dceb',

    diffAdd: '#a6e3a1',
    diffDel: '#f38ba8',

    selection: '#313244',
    listSelectedFg: '#cdd6f4',
    listSelectedBg: '#313244',
  },
}

export const themes: Record<ThemeName, Theme> = {
  'tokyo-night': tokyoNight,
  dracula,
  'catppuccin-mocha': catppuccinMocha,
}

export const defaultTheme: Theme = tokyoNight

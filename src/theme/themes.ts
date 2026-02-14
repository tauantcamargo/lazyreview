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
    diffAddHighlight: '#1a3a1a',
    diffDelHighlight: '#3a1a1a',

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
    diffAddHighlight: '#1a3a1a',
    diffDelHighlight: '#3a1a1a',

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
    diffAddHighlight: '#1a3a1a',
    diffDelHighlight: '#3a1a1a',

    selection: '#313244',
    listSelectedFg: '#cdd6f4',
    listSelectedBg: '#313244',
  },
}

const gruvbox: Theme = {
  name: 'gruvbox',
  colors: {
    bg: '#282828',
    text: '#ebdbb2',
    accent: '#458588',
    muted: '#928374',
    border: '#3c3836',
    primary: '#458588',
    secondary: '#b16286',

    success: '#98971a',
    error: '#cc241d',
    warning: '#d79921',
    info: '#689d6a',

    diffAdd: '#98971a',
    diffDel: '#cc241d',
    diffAddHighlight: '#2a3a1a',
    diffDelHighlight: '#3a1a1a',

    selection: '#3c3836',
    listSelectedFg: '#ebdbb2',
    listSelectedBg: '#3c3836',
  },
}

const highContrast: Theme = {
  name: 'high-contrast',
  colors: {
    bg: '#000000',
    text: '#ffffff',
    accent: '#00ffff',
    muted: '#bbbbbb',
    border: '#ffffff',
    primary: '#00ffff',
    secondary: '#ff00ff',

    success: '#00ff00',
    error: '#ff0000',
    warning: '#ffff00',
    info: '#5555ff',

    diffAdd: '#58a6ff',
    diffDel: '#d29922',
    diffAddHighlight: '#0a3a0a',
    diffDelHighlight: '#3a0a0a',

    selection: '#333333',
    listSelectedFg: '#ffffff',
    listSelectedBg: '#333333',
  },
}

const githubLight: Theme = {
  name: 'github-light',
  colors: {
    bg: '#ffffff',
    text: '#1f2328',
    accent: '#0969da',
    muted: '#656d76',
    border: '#d0d7de',
    primary: '#0969da',
    secondary: '#8250df',

    success: '#1a7f37',
    error: '#cf222e',
    warning: '#9a6700',
    info: '#0969da',

    diffAdd: '#1a7f37',
    diffDel: '#cf222e',
    diffAddHighlight: '#ccffd8',
    diffDelHighlight: '#ffd7d5',

    selection: '#ddf4ff',
    listSelectedFg: '#1f2328',
    listSelectedBg: '#ddf4ff',
  },
}

export const themes: Record<ThemeName, Theme> = {
  'tokyo-night': tokyoNight,
  dracula,
  'catppuccin-mocha': catppuccinMocha,
  gruvbox,
  'high-contrast': highContrast,
  'github-light': githubLight,
}

export const defaultTheme: Theme = tokyoNight

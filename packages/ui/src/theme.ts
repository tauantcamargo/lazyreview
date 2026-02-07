export type Theme = {
  name: string;
  // List component colors
  listTitle: string;
  listSelectedForeground: string;
  listSelectedBackground: string;
  listNormalForeground: string;
  listNormalSecondary: string;
  // Diff colors
  diffAdd: string;
  diffDel: string;
  diffHunk: string;
  diffHeader: string;
  // General UI colors
  accent: string;
  muted: string;
  border: string;
  text: string;
  bg: string;
  // Status colors
  added: string;
  removed: string;
  modified: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  selection: string;
  primary: string;
  secondary: string;
};

function createTheme(
  name: string,
  accent: string,
  overrides: Partial<Theme> = {}
): Theme {
  return {
    name,
    listTitle: accent,
    listSelectedForeground: 'black',
    listSelectedBackground: accent,
    listNormalForeground: 'white',
    listNormalSecondary: 'gray',
    diffAdd: 'green',
    diffDel: 'red',
    diffHunk: 'yellow',
    diffHeader: accent,
    accent,
    muted: 'gray',
    border: 'gray',
    text: 'white',
    bg: 'black',
    added: 'green',
    removed: 'red',
    modified: 'yellow',
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'cyan',
    selection: accent,
    primary: accent,
    secondary: 'gray',
    ...overrides,
  };
}

export const themes: Record<string, Theme> = {
  lazygit: createTheme('lazygit', 'magenta'),
  darcula: createTheme('darcula', 'cyan'),
  tokyonight: createTheme('tokyonight', '#7aa2f7', {
    muted: '#565f89',
    text: '#c0caf5',
    border: '#3b4261',
    accent: '#7aa2f7',
    added: '#9ece6a',
    removed: '#f7768e',
    modified: '#e0af68',
    warning: '#e0af68',
    info: '#7dcfff',
    success: '#9ece6a',
    error: '#f7768e',
    primary: '#7aa2f7',
    secondary: '#565f89',
    selection: '#33467c',
  }),
  gruvbox: createTheme('gruvbox', 'yellow', {
    muted: '#928374',
    added: '#b8bb26',
    removed: '#fb4934',
  }),
  catppuccin: createTheme('catppuccin', '#cba6f7', {
    muted: '#6c7086',
    accent: '#cba6f7',
    border: '#45475a',
    text: '#cdd6f4',
    added: '#a6e3a1',
    removed: '#f38ba8',
    modified: '#f9e2af',
    info: '#89dceb',
    primary: '#cba6f7',
  }),
  auto: createTheme('auto', 'magenta'),
  nord: createTheme('nord', '#88c0d0', {
    muted: '#4c566a',
    accent: '#88c0d0',
    text: '#eceff4',
    border: '#3b4252',
  }),
  dracula: createTheme('dracula', '#bd93f9', {
    muted: '#6272a4',
    accent: '#bd93f9',
    added: '#50fa7b',
    removed: '#ff5555',
    border: '#44475a',
    text: '#f8f8f2',
  }),
  // Modern GitHub-inspired dark theme
  github: createTheme('github', '#58a6ff', {
    muted: '#8b949e',
    text: '#e6edf3',
    border: '#30363d',
    accent: '#58a6ff',
    added: '#3fb950',
    removed: '#f85149',
    modified: '#d29922',
    success: '#3fb950',
    error: '#f85149',
    warning: '#d29922',
    info: '#58a6ff',
    primary: '#58a6ff',
    secondary: '#8b949e',
    selection: '#388bfd26',
    listSelectedBackground: '#388bfd',
  }),
};

// Use tokyonight as default for a more modern look
export const defaultTheme: Theme = themes.tokyonight ?? createTheme('tokyonight', '#7aa2f7');

export function getTheme(name?: string): Theme {
  if (!name) {
    return defaultTheme;
  }
  const theme = themes[name.toLowerCase()];
  return theme ?? defaultTheme;
}

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
    ...overrides,
  };
}

export const themes: Record<string, Theme> = {
  lazygit: createTheme('lazygit', 'magenta'),
  darcula: createTheme('darcula', 'cyan'),
  tokyonight: createTheme('tokyonight', 'blue', {
    muted: '#565f89',
    text: '#c0caf5',
  }),
  gruvbox: createTheme('gruvbox', 'yellow', {
    muted: '#928374',
    added: '#b8bb26',
    removed: '#fb4934',
  }),
  catppuccin: createTheme('catppuccin', 'magenta', {
    muted: '#6c7086',
    accent: '#cba6f7',
  }),
  auto: createTheme('auto', 'magenta'),
  nord: createTheme('nord', 'cyan', {
    muted: '#4c566a',
    accent: '#88c0d0',
    text: '#eceff4',
  }),
  dracula: createTheme('dracula', 'magenta', {
    muted: '#6272a4',
    accent: '#bd93f9',
    added: '#50fa7b',
    removed: '#ff5555',
  }),
};

export const defaultTheme: Theme = themes.lazygit ?? createTheme('lazygit', 'magenta');

export function getTheme(name?: string): Theme {
  if (!name) {
    return defaultTheme;
  }
  const theme = themes[name.toLowerCase()];
  return theme ?? defaultTheme;
}

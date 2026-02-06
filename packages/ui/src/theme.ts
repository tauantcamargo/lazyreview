export type Theme = {
  name: string;
  listTitle: string;
  listSelectedForeground: string;
  listSelectedBackground: string;
  listNormalForeground: string;
  listNormalSecondary: string;
  diffAdd: string;
  diffDel: string;
  diffHunk: string;
  diffHeader: string;
};

export const themes: Record<string, Theme> = {
  lazygit: {
    name: 'lazygit',
    listTitle: 'magenta',
    listSelectedForeground: 'black',
    listSelectedBackground: 'magenta',
    listNormalForeground: 'white',
    listNormalSecondary: 'gray',
    diffAdd: 'green',
    diffDel: 'red',
    diffHunk: 'yellow',
    diffHeader: 'magenta',
  },
  darcula: {
    name: 'darcula',
    listTitle: 'cyan',
    listSelectedForeground: 'black',
    listSelectedBackground: 'cyan',
    listNormalForeground: 'white',
    listNormalSecondary: 'gray',
    diffAdd: 'green',
    diffDel: 'red',
    diffHunk: 'yellow',
    diffHeader: 'cyan',
  },
  tokyonight: {
    name: 'tokyonight',
    listTitle: 'blue',
    listSelectedForeground: 'black',
    listSelectedBackground: 'blue',
    listNormalForeground: 'white',
    listNormalSecondary: 'gray',
    diffAdd: 'green',
    diffDel: 'red',
    diffHunk: 'yellow',
    diffHeader: 'blue',
  },
  gruvbox: {
    name: 'gruvbox',
    listTitle: 'yellow',
    listSelectedForeground: 'black',
    listSelectedBackground: 'yellow',
    listNormalForeground: 'white',
    listNormalSecondary: 'gray',
    diffAdd: 'green',
    diffDel: 'red',
    diffHunk: 'yellow',
    diffHeader: 'yellow',
  },
  catppuccin: {
    name: 'catppuccin',
    listTitle: 'magenta',
    listSelectedForeground: 'black',
    listSelectedBackground: 'magenta',
    listNormalForeground: 'white',
    listNormalSecondary: 'gray',
    diffAdd: 'green',
    diffDel: 'red',
    diffHunk: 'yellow',
    diffHeader: 'magenta',
  },
  auto: {
    name: 'auto',
    listTitle: 'magenta',
    listSelectedForeground: 'black',
    listSelectedBackground: 'magenta',
    listNormalForeground: 'white',
    listNormalSecondary: 'gray',
    diffAdd: 'green',
    diffDel: 'red',
    diffHunk: 'yellow',
    diffHeader: 'magenta',
  },
};

const defaultTheme: Theme = {
  name: 'lazygit',
  listTitle: 'magenta',
  listSelectedForeground: 'black',
  listSelectedBackground: 'magenta',
  listNormalForeground: 'white',
  listNormalSecondary: 'gray',
  diffAdd: 'green',
  diffDel: 'red',
  diffHunk: 'yellow',
  diffHeader: 'magenta',
};

export function getTheme(name?: string): Theme {
  if (!name) {
    return defaultTheme;
  }
  const theme = themes[name.toLowerCase()];
  return theme ?? defaultTheme;
}

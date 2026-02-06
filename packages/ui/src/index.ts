// Components
export { VirtualList } from './components/VirtualList';
export type { VirtualListItem } from './components/VirtualList';
export { DiffView } from './components/DiffView';
export { Sidebar } from './components/Sidebar';
export type { SidebarItem, SidebarProps } from './components/Sidebar';
export { FileTree } from './components/FileTree';
export type { FileChange, FileTreeProps } from './components/FileTree';
export { StatusBar } from './components/StatusBar';
export type { KeyBinding, StatusBarProps } from './components/StatusBar';
export { CommandPalette } from './components/CommandPalette';
export type { Command, CommandPaletteProps } from './components/CommandPalette';
export { Spinner } from './components/Spinner';
export type { SpinnerProps } from './components/Spinner';
export { ErrorMessage } from './components/ErrorMessage';
export type { ErrorMessageProps } from './components/ErrorMessage';

// Hooks
export { useChord, defaultChords } from './hooks/useChord';
export type { ChordDefinition, ChordState, UseChordOptions, UseChordResult } from './hooks/useChord';

// Theme
export { getTheme, themes, defaultTheme } from './theme';
export type { Theme } from './theme';

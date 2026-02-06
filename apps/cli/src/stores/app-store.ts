import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { PullRequest } from '@lazyreview/core';

// View types
export type ViewType = 'list' | 'detail' | 'dashboard' | 'settings' | 'workspaces' | 'ai';
export type PanelType = 'sidebar' | 'content' | 'detail';
export type SidebarMode = 'repos' | 'filters' | 'workspaces';
export type DetailTab = 'files' | 'comments' | 'timeline' | 'description';

export interface PRFilter {
  state?: 'open' | 'closed' | 'merged' | 'all';
  author?: string;
  assignee?: string;
  reviewRequested?: string;
  labels?: string[];
  searchQuery?: string;
}

export interface User {
  id: string;
  login: string;
  name?: string;
  avatarUrl?: string;
}

export interface RepoRef {
  provider: string;
  owner: string;
  repo: string;
}

interface AppState {
  // Navigation
  currentView: ViewType;
  currentPanel: PanelType;
  sidebarMode: SidebarMode;
  detailTab: DetailTab;

  // Selection
  selectedRepo: RepoRef | null;
  selectedPRNumber: number | null;
  selectedFileIndex: number;
  selectedCommentId: string | null;

  // UI State
  searchQuery: string;
  filters: PRFilter;
  isCommandPaletteOpen: boolean;
  isHelpOpen: boolean;
  isLoading: boolean;
  errorMessage: string | null;

  // User
  currentUser: User | null;

  // Keyboard
  chordBuffer: string;
  chordTimeout: NodeJS.Timeout | null;

  // Actions
  setView: (view: ViewType) => void;
  setPanel: (panel: PanelType) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setDetailTab: (tab: DetailTab) => void;
  selectRepo: (repo: RepoRef | null) => void;
  selectPR: (number: number | null) => void;
  selectFile: (index: number) => void;
  selectComment: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<PRFilter>) => void;
  clearFilters: () => void;
  toggleCommandPalette: () => void;
  toggleHelp: () => void;
  setLoading: (loading: boolean) => void;
  setError: (message: string | null) => void;
  setCurrentUser: (user: User | null) => void;
  setChordBuffer: (buffer: string, timeout: NodeJS.Timeout | null) => void;
  clearChordBuffer: () => void;
  reset: () => void;
}

const initialState = {
  currentView: 'list' as ViewType,
  currentPanel: 'content' as PanelType,
  sidebarMode: 'repos' as SidebarMode,
  detailTab: 'files' as DetailTab,
  selectedRepo: null,
  selectedPRNumber: null,
  selectedFileIndex: 0,
  selectedCommentId: null,
  searchQuery: '',
  filters: {},
  isCommandPaletteOpen: false,
  isHelpOpen: false,
  isLoading: false,
  errorMessage: null,
  currentUser: null,
  chordBuffer: '',
  chordTimeout: null,
};

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setView: (view) =>
      set({
        currentView: view,
        // Reset some state when changing views
        selectedFileIndex: 0,
        selectedCommentId: null,
      }),

    setPanel: (panel) => set({ currentPanel: panel }),

    setSidebarMode: (mode) => set({ sidebarMode: mode }),

    setDetailTab: (tab) =>
      set({
        detailTab: tab,
        selectedFileIndex: 0,
        selectedCommentId: null,
      }),

    selectRepo: (repo) =>
      set({
        selectedRepo: repo,
        selectedPRNumber: null, // Reset PR selection when changing repo
        currentView: 'list',
      }),

    selectPR: (number) =>
      set({
        selectedPRNumber: number,
        currentView: number ? 'detail' : 'list',
        detailTab: 'files',
        selectedFileIndex: 0,
      }),

    selectFile: (index) => set({ selectedFileIndex: index }),

    selectComment: (id) => set({ selectedCommentId: id }),

    setSearchQuery: (query) => set({ searchQuery: query }),

    setFilters: (filters) =>
      set((state) => ({
        filters: { ...state.filters, ...filters },
      })),

    clearFilters: () => set({ filters: {}, searchQuery: '' }),

    toggleCommandPalette: () =>
      set((state) => ({
        isCommandPaletteOpen: !state.isCommandPaletteOpen,
      })),

    toggleHelp: () =>
      set((state) => ({
        isHelpOpen: !state.isHelpOpen,
      })),

    setLoading: (loading) => set({ isLoading: loading }),

    setError: (message) => set({ errorMessage: message }),

    setCurrentUser: (user) => set({ currentUser: user }),

    setChordBuffer: (buffer, timeout) => {
      const current = get().chordTimeout;
      if (current) {
        clearTimeout(current);
      }
      set({ chordBuffer: buffer, chordTimeout: timeout });
    },

    clearChordBuffer: () => {
      const current = get().chordTimeout;
      if (current) {
        clearTimeout(current);
      }
      set({ chordBuffer: '', chordTimeout: null });
    },

    reset: () => {
      const current = get().chordTimeout;
      if (current) {
        clearTimeout(current);
      }
      set(initialState);
    },
  }))
);

// Selector hooks for better performance
export const useCurrentView = () => useAppStore((s) => s.currentView);
export const useSelectedRepo = () => useAppStore((s) => s.selectedRepo);
export const useSelectedPR = () => useAppStore((s) => s.selectedPRNumber);
export const useFilters = () => useAppStore((s) => s.filters);
export const useIsLoading = () => useAppStore((s) => s.isLoading);
export const useErrorMessage = () => useAppStore((s) => s.errorMessage);
export const useCurrentUser = () => useAppStore((s) => s.currentUser);
export const useChordBuffer = () => useAppStore((s) => s.chordBuffer);

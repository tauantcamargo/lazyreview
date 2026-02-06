import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { PullRequest } from '@lazyreview/core';

export type ViewType = 'list' | 'detail' | 'dashboard' | 'settings' | 'files' | 'ai';
export type PanelType = 'sidebar' | 'content' | 'detail';
export type SidebarMode = 'repos' | 'filters';

export interface PRFilter {
  state?: 'open' | 'closed' | 'all';
  author?: string;
  search?: string;
}

interface AppState {
  // Navigation
  currentView: ViewType;
  currentPanel: PanelType;
  sidebarMode: SidebarMode;

  // Selection
  selectedRepo: { owner: string; repo: string; provider: string } | null;
  selectedPRNumber: number | null;
  selectedFileIndex: number;
  selectedListIndex: number;

  // Data
  pullRequests: PullRequest[];
  currentDiff: string;

  // UI State
  searchQuery: string;
  filters: PRFilter;
  isCommandPaletteOpen: boolean;
  isHelpOpen: boolean;
  isSidebarVisible: boolean;

  // Status
  status: 'idle' | 'loading' | 'ready' | 'error';
  errorMessage: string | null;
  demoMode: boolean;

  // Actions
  setView: (view: ViewType) => void;
  setPanel: (panel: PanelType) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  selectRepo: (owner: string, repo: string, provider: string) => void;
  selectPR: (number: number) => void;
  setSelectedListIndex: (index: number) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<PRFilter>) => void;
  toggleCommandPalette: () => void;
  toggleHelp: () => void;
  toggleSidebar: () => void;
  setPullRequests: (prs: PullRequest[]) => void;
  setCurrentDiff: (diff: string) => void;
  setStatus: (status: 'idle' | 'loading' | 'ready' | 'error') => void;
  setErrorMessage: (message: string | null) => void;
  setDemoMode: (demo: boolean) => void;
  reset: () => void;
}

const initialState = {
  currentView: 'list' as ViewType,
  currentPanel: 'content' as PanelType,
  sidebarMode: 'repos' as SidebarMode,
  selectedRepo: null,
  selectedPRNumber: null,
  selectedFileIndex: 0,
  selectedListIndex: 0,
  pullRequests: [],
  currentDiff: '',
  searchQuery: '',
  filters: {},
  isCommandPaletteOpen: false,
  isHelpOpen: false,
  isSidebarVisible: true,
  status: 'idle' as const,
  errorMessage: null,
  demoMode: true,
};

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    setView: (view) => set({ currentView: view }),

    setPanel: (panel) => set({ currentPanel: panel }),

    setSidebarMode: (mode) => set({ sidebarMode: mode }),

    selectRepo: (owner, repo, provider) =>
      set({
        selectedRepo: { owner, repo, provider },
        selectedPRNumber: null,
        selectedListIndex: 0,
      }),

    selectPR: (number) =>
      set({
        selectedPRNumber: number,
        currentView: 'detail',
      }),

    setSelectedListIndex: (index) => set({ selectedListIndex: index }),

    setSearchQuery: (query) => set({ searchQuery: query }),

    setFilters: (filters) =>
      set((state) => ({
        filters: { ...state.filters, ...filters },
      })),

    toggleCommandPalette: () =>
      set((state) => ({
        isCommandPaletteOpen: !state.isCommandPaletteOpen,
      })),

    toggleHelp: () =>
      set((state) => ({
        isHelpOpen: !state.isHelpOpen,
      })),

    toggleSidebar: () =>
      set((state) => ({
        isSidebarVisible: !state.isSidebarVisible,
      })),

    setPullRequests: (prs) => set({ pullRequests: prs }),

    setCurrentDiff: (diff) => set({ currentDiff: diff }),

    setStatus: (status) => set({ status }),

    setErrorMessage: (message) => set({ errorMessage: message }),

    setDemoMode: (demo) => set({ demoMode: demo }),

    reset: () => set(initialState),
  }))
);

// Selector hooks for better performance
export const useCurrentView = () => useAppStore((s) => s.currentView);
export const useSelectedRepo = () => useAppStore((s) => s.selectedRepo);
export const useSelectedPR = () => useAppStore((s) => s.selectedPRNumber);
export const useFilters = () => useAppStore((s) => s.filters);
export const usePullRequests = () => useAppStore((s) => s.pullRequests);
export const useStatus = () => useAppStore((s) => s.status);
export const useIsSidebarVisible = () => useAppStore((s) => s.isSidebarVisible);
export const useIsCommandPaletteOpen = () => useAppStore((s) => s.isCommandPaletteOpen);

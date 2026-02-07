import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { PullRequest } from '@lazyreview/core';

export type ViewType = 'list' | 'detail' | 'dashboard' | 'settings' | 'files' | 'ai';

// Demo data for testing the TUI
const DEMO_PULL_REQUESTS: PullRequest[] = [
  {
    id: '1',
    number: 42,
    title: 'feat: Add user authentication with OAuth2',
    body: 'This PR implements OAuth2 authentication flow.\n\n## Changes\n- Add OAuth2 provider\n- Add login/logout endpoints\n- Add session management',
    state: 'open',
    isDraft: false,
    author: { login: 'alice', avatarUrl: '' },
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000),
    baseRef: 'main',
    headRef: 'feat/oauth2-auth',
    url: 'https://github.com/org/repo/pull/42',
    labels: [{ name: 'enhancement', color: '00ff00' }],
    reviewDecision: 'REVIEW_REQUIRED',
    repository: { owner: 'lazyreview', name: 'demo' },
    files: [
      { path: 'src/auth/oauth.ts', status: 'added', additions: 150, deletions: 0 },
      { path: 'src/auth/session.ts', status: 'added', additions: 80, deletions: 0 },
      { path: 'src/routes/auth.ts', status: 'modified', additions: 45, deletions: 10 },
      { path: 'src/config.ts', status: 'modified', additions: 5, deletions: 2 },
    ],
    comments: [
      { id: 1, author: { login: 'bob', avatarUrl: '' }, body: 'Looks good! Just a few questions about the session handling.', createdAt: new Date(Date.now() - 60 * 60 * 1000), isResolved: false },
      { id: 2, author: { login: 'alice', avatarUrl: '' }, body: 'Good catch, updated the session expiry logic.', createdAt: new Date(Date.now() - 45 * 60 * 1000), isResolved: true },
    ],
    reviews: [
      { id: 1, author: { login: 'bob', avatarUrl: '' }, state: 'commented', body: 'Left some comments', submittedAt: new Date(Date.now() - 60 * 60 * 1000) },
    ],
    timeline: [
      { id: 1, type: 'opened', actor: { login: 'alice', avatarUrl: '' }, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), message: 'Opened pull request' },
      { id: 2, type: 'commented', actor: { login: 'bob', avatarUrl: '' }, createdAt: new Date(Date.now() - 60 * 60 * 1000), message: 'Left some comments' },
      { id: 3, type: 'committed', actor: { login: 'alice', avatarUrl: '' }, createdAt: new Date(Date.now() - 45 * 60 * 1000), message: 'Fixed session expiry logic' },
    ],
  },
  {
    id: '2',
    number: 41,
    title: 'fix: Resolve memory leak in cache layer',
    body: 'Fixed memory leak caused by unclosed connections.\n\n## Root Cause\nConnections were not being properly closed in error paths.',
    state: 'open',
    isDraft: false,
    author: { login: 'bob', avatarUrl: '' },
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    baseRef: 'main',
    headRef: 'fix/memory-leak',
    url: 'https://github.com/org/repo/pull/41',
    labels: [{ name: 'bug', color: 'ff0000' }],
    reviewDecision: 'APPROVED',
    repository: { owner: 'lazyreview', name: 'demo' },
    files: [
      { path: 'src/cache/redis.ts', status: 'modified', additions: 25, deletions: 8 },
      { path: 'src/cache/memory.ts', status: 'modified', additions: 15, deletions: 5 },
      { path: 'tests/cache.test.ts', status: 'modified', additions: 40, deletions: 0 },
    ],
    reviews: [
      { id: 2, author: { login: 'charlie', avatarUrl: '' }, state: 'approved', body: 'LGTM! Good fix.', submittedAt: new Date(Date.now() - 8 * 60 * 60 * 1000) },
    ],
  },
  {
    id: '3',
    number: 40,
    title: 'refactor: Improve database query performance',
    body: 'Optimized queries for faster response times.',
    state: 'open',
    isDraft: true,
    author: { login: 'charlie', avatarUrl: '' },
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    baseRef: 'main',
    headRef: 'refactor/db-perf',
    url: 'https://github.com/org/repo/pull/40',
    labels: [{ name: 'performance', color: 'ff9900' }],
    repository: { owner: 'lazyreview', name: 'demo' },
  },
  {
    id: '4',
    number: 39,
    title: 'docs: Update API documentation',
    body: 'Updated REST API docs with new endpoints.',
    state: 'open',
    isDraft: false,
    author: { login: 'dave', avatarUrl: '' },
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    baseRef: 'main',
    headRef: 'docs/api-update',
    url: 'https://github.com/org/repo/pull/39',
    labels: [{ name: 'documentation', color: '0066ff' }],
    reviewDecision: 'CHANGES_REQUESTED',
    repository: { owner: 'lazyreview', name: 'demo' },
  },
  {
    id: '5',
    number: 38,
    title: 'test: Add integration tests for auth module',
    body: 'Comprehensive integration tests for authentication.',
    state: 'merged',
    isDraft: false,
    author: { login: 'eve', avatarUrl: '' },
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    baseRef: 'main',
    headRef: 'test/auth-integration',
    url: 'https://github.com/org/repo/pull/38',
    labels: [{ name: 'testing', color: '9900ff' }],
    reviewDecision: 'APPROVED',
    repository: { owner: 'lazyreview', name: 'demo' },
  },
];
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
  initDemoMode: () => void;
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

    initDemoMode: () =>
      set({
        demoMode: true,
        pullRequests: DEMO_PULL_REQUESTS,
        selectedRepo: { owner: 'lazyreview', repo: 'demo', provider: 'github' },
        status: 'ready',
      }),

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

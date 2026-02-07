import React from 'react';
import { Text, Box } from 'ink';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './app.js';

// Create a test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
  },
});

// Wrapper component that provides QueryClient
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Mock the store
vi.mock('./stores/app-store.js', () => {
  const mockState = {
    currentView: 'list' as const,
    isSidebarVisible: true,
    isCommandPaletteOpen: false,
    isHelpOpen: false,
    selectedRepo: { owner: 'lazyreview', repo: 'demo', provider: 'github' },
    demoMode: true,
    searchQuery: '',
    setView: vi.fn(),
    toggleSidebar: vi.fn(),
    toggleHelp: vi.fn(),
    toggleCommandPalette: vi.fn(),
    setSearchQuery: vi.fn(),
  };
  return {
    useAppStore: vi.fn((selector: any) => selector ? selector(mockState) : mockState),
    useCurrentView: vi.fn(() => 'list'),
    useIsSidebarVisible: vi.fn(() => true),
    useIsCommandPaletteOpen: vi.fn(() => false),
    usePullRequests: vi.fn(() => []),
  };
});

// Mock hooks
vi.mock('./hooks/index.js', () => ({
  useToast: vi.fn(() => ({
    toasts: [],
    addToast: vi.fn(),
    removeToast: vi.fn(),
  })),
  useConfig: vi.fn(() => ({
    config: { version: '1.0.0' },
    isVimMode: true,
  })),
}));

// Mock screens
vi.mock('./screens/index.js', () => ({
  PRListScreen: () => React.createElement(Text, null, 'PR List Screen'),
  PRDetailScreen: () => React.createElement(Text, null, 'PR Detail Screen'),
  DiffScreen: () => React.createElement(Text, null, 'Diff Screen'),
  DashboardScreen: () => React.createElement(Text, null, 'Dashboard Screen'),
  SettingsScreen: () => React.createElement(Text, null, 'Settings Screen'),
  AIReviewScreen: () => React.createElement(Text, null, 'AI Review Screen'),
}));

// Mock UI components
vi.mock('@lazyreview/ui', () => ({
  Layout: ({ children }: any) => React.createElement(Box, null, children),
  Sidebar: ({ title, items }: any) =>
    React.createElement(Text, null, `Sidebar: ${title} (${items?.length ?? 0} items)`),
  StatusBar: ({ left, right }: any) =>
    React.createElement(Text, null, `Status: ${left} | ${right}`),
  HelpPanel: ({ sections, width, height }: any) =>
    React.createElement(Text, null, `Help Panel: ${sections?.length ?? 0} sections (${width}x${height})`),
  CommandPalette: ({ commands }: any) =>
    React.createElement(Text, null, `Command Palette: ${commands?.length ?? 0} commands`),
  ToastContainer: ({ toasts }: any) =>
    React.createElement(Text, null, `Toasts: ${toasts?.length ?? 0}`),
  Panel: ({ children }: any) => React.createElement(Box, null, children),
  ChordIndicator: ({ pendingKeys }: any) =>
    React.createElement(Text, null, `Chord: ${pendingKeys?.join('') ?? ''}`),
  TextArea: ({ value, placeholder }: any) =>
    React.createElement(Text, null, value || placeholder),
  ConfirmDialog: ({ title, message }: any) =>
    React.createElement(Text, null, `${title}: ${message}`),
  useChord: vi.fn(() => ({
    handleInput: vi.fn(() => false),
    state: { buffer: '', isActive: false, pendingChords: [] },
    reset: vi.fn(),
  })),
}));

// Mock components
vi.mock('./components/index.js', () => ({
  PRActionDialogs: () => null,
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toBeDefined();
  });

  it('renders with custom dimensions', () => {
    const { lastFrame } = render(<TestWrapper><App width={120} height={40} /></TestWrapper>);
    expect(lastFrame()).toBeDefined();
  });

  it('renders header bar with LazyReview title', () => {
    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('LazyReview');
  });

  it('renders tab bar', () => {
    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('All');
    expect(lastFrame()).toContain('Recent');
    expect(lastFrame()).toContain('My PRs');
  });

  it('renders Navigation panel when sidebar visible', async () => {
    const { useIsSidebarVisible } = await import('./stores/app-store.js');
    vi.mocked(useIsSidebarVisible).mockReturnValue(true);

    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('Navigation');
  });

  it('renders Pull Requests panel', () => {
    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('Pull Requests');
  });

  it('renders PR list screen by default', async () => {
    const { useCurrentView } = await import('./stores/app-store.js');
    vi.mocked(useCurrentView).mockReturnValue('list');

    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('PR List Screen');
  });

  it('renders dashboard screen when view is dashboard', async () => {
    const { useCurrentView } = await import('./stores/app-store.js');
    vi.mocked(useCurrentView).mockReturnValue('dashboard');

    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('Dashboard Screen');
  });

  it('renders settings screen when view is settings', async () => {
    const { useCurrentView } = await import('./stores/app-store.js');
    vi.mocked(useCurrentView).mockReturnValue('settings');

    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('Settings Screen');
  });

  it('renders detail screen when view is detail', async () => {
    const { useCurrentView } = await import('./stores/app-store.js');
    vi.mocked(useCurrentView).mockReturnValue('detail');

    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('PR Detail Screen');
  });

  it('renders diff screen when view is files', async () => {
    const { useCurrentView } = await import('./stores/app-store.js');
    vi.mocked(useCurrentView).mockReturnValue('files');

    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('Diff Screen');
  });

  it('renders AI review screen when view is ai', async () => {
    const { useCurrentView } = await import('./stores/app-store.js');
    vi.mocked(useCurrentView).mockReturnValue('ai');

    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('AI Review Screen');
  });

  it('renders loaded message', () => {
    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('Loaded');
  });

  it('renders toast container', () => {
    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('Toasts:');
  });

  it('shows help panel when isHelpOpen is true', async () => {
    const { useAppStore } = await import('./stores/app-store.js');
    const mockState = {
      currentView: 'list' as const,
      isSidebarVisible: true,
      isCommandPaletteOpen: false,
      isHelpOpen: true,
      selectedRepo: { owner: 'lazyreview', repo: 'demo', provider: 'github' },
      demoMode: true,
      setView: vi.fn(),
      toggleSidebar: vi.fn(),
      toggleHelp: vi.fn(),
      toggleCommandPalette: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );

    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('Help Panel');
  });

  it('shows command palette when isCommandPaletteOpen is true', async () => {
    const { useAppStore, useIsCommandPaletteOpen } = await import('./stores/app-store.js');
    vi.mocked(useIsCommandPaletteOpen).mockReturnValue(true);
    const mockState = {
      currentView: 'list' as const,
      isSidebarVisible: true,
      isCommandPaletteOpen: true,
      isHelpOpen: false,
      selectedRepo: { owner: 'lazyreview', repo: 'demo', provider: 'github' },
      demoMode: true,
      setView: vi.fn(),
      toggleSidebar: vi.fn(),
      toggleHelp: vi.fn(),
      toggleCommandPalette: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );

    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('Command Palette');
  });

  it('shows PR count in header', async () => {
    const { usePullRequests, useCurrentView } = await import('./stores/app-store.js');
    vi.mocked(useCurrentView).mockReturnValue('list');
    vi.mocked(usePullRequests).mockReturnValue([
      {
        id: '1',
        number: 1,
        title: 'Test PR',
        body: '',
        state: 'open',
        isDraft: false,
        author: { login: 'alice', avatarUrl: '' },
        createdAt: new Date(),
        updatedAt: new Date(),
        baseRef: 'main',
        headRef: 'feature',
        url: '',
        labels: [],
        repository: { owner: 'org', name: 'repo' },
      },
    ]);

    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('My PRs (1)');
  });

  it('shows vim navigation hints when in vim mode', async () => {
    const { useAppStore } = await import('./stores/app-store.js');
    const { useConfig } = await import('./hooks/index.js');

    const mockState = {
      currentView: 'list' as const,
      isSidebarVisible: true,
      isCommandPaletteOpen: false,
      isHelpOpen: false,
      selectedRepo: { owner: 'lazyreview', repo: 'demo', provider: 'github' },
      demoMode: true,
      setView: vi.fn(),
      toggleSidebar: vi.fn(),
      toggleHelp: vi.fn(),
      toggleCommandPalette: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(useConfig).mockReturnValue({
      config: { version: '1.0.0' },
      isVimMode: true,
    });

    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('↑/k up');
  });

  it('shows arrow key hints when not in vim mode', async () => {
    const { useAppStore } = await import('./stores/app-store.js');
    const { useConfig } = await import('./hooks/index.js');

    const mockState = {
      currentView: 'list' as const,
      isSidebarVisible: true,
      isCommandPaletteOpen: false,
      isHelpOpen: false,
      selectedRepo: { owner: 'lazyreview', repo: 'demo', provider: 'github' },
      demoMode: true,
      setView: vi.fn(),
      toggleSidebar: vi.fn(),
      toggleHelp: vi.fn(),
      toggleCommandPalette: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(useConfig).mockReturnValue({
      config: { version: '1.0.0' },
      isVimMode: false,
    });

    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('↑ up');
  });

  it('renders branch info', () => {
    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('branch');
  });

  it('shows / filter hint in status bar', async () => {
    const { useAppStore, useCurrentView } = await import('./stores/app-store.js');
    vi.mocked(useCurrentView).mockReturnValue('list');
    const mockState = {
      currentView: 'list' as const,
      isSidebarVisible: true,
      isCommandPaletteOpen: false,
      isHelpOpen: false,
      selectedRepo: { owner: 'lazyreview', repo: 'demo', provider: 'github' },
      demoMode: true,
      searchQuery: '',
      setView: vi.fn(),
      toggleSidebar: vi.fn(),
      toggleHelp: vi.fn(),
      toggleCommandPalette: vi.fn(),
      setSearchQuery: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );

    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('/ filter');
  });

  it('shows filter text when search query is set', async () => {
    const { useAppStore, useCurrentView, usePullRequests } = await import('./stores/app-store.js');
    vi.mocked(useCurrentView).mockReturnValue('list');
    vi.mocked(usePullRequests).mockReturnValue([
      {
        id: '1',
        number: 1,
        title: 'Test PR',
        body: '',
        state: 'open',
        isDraft: false,
        author: { login: 'alice', avatarUrl: '' },
        createdAt: new Date(),
        updatedAt: new Date(),
        baseRef: 'main',
        headRef: 'feature',
        url: '',
        labels: [],
        repository: { owner: 'org', name: 'repo' },
      },
    ]);
    const mockState = {
      currentView: 'list' as const,
      isSidebarVisible: true,
      isCommandPaletteOpen: false,
      isHelpOpen: false,
      selectedRepo: { owner: 'lazyreview', repo: 'demo', provider: 'github' },
      demoMode: true,
      searchQuery: 'test',
      setView: vi.fn(),
      toggleSidebar: vi.fn(),
      toggleHelp: vi.fn(),
      toggleCommandPalette: vi.fn(),
      setSearchQuery: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );

    const { lastFrame } = render(<TestWrapper><App /></TestWrapper>);
    expect(lastFrame()).toContain('Filter:');
    expect(lastFrame()).toContain('test');
  });
});

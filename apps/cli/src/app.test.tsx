import React from 'react';
import { Text, Box } from 'ink';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from './app.js';

// Mock the store
vi.mock('./stores/app-store.js', () => {
  const mockState = {
    currentView: 'list' as const,
    isSidebarVisible: true,
    isCommandPaletteOpen: false,
    isHelpOpen: false,
    selectedRepo: null,
    setView: vi.fn(),
    toggleSidebar: vi.fn(),
    toggleHelp: vi.fn(),
    toggleCommandPalette: vi.fn(),
    selectRepo: vi.fn(),
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
  HelpPanel: ({ sections }: any) =>
    React.createElement(Text, null, `Help Panel: ${sections?.length ?? 0} sections`),
  CommandPalette: ({ commands }: any) =>
    React.createElement(Text, null, `Command Palette: ${commands?.length ?? 0} commands`),
  ToastContainer: ({ toasts }: any) =>
    React.createElement(Text, null, `Toasts: ${toasts?.length ?? 0}`),
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toBeDefined();
  });

  it('renders with custom dimensions', () => {
    const { lastFrame } = render(<App width={120} height={40} />);
    expect(lastFrame()).toBeDefined();
  });

  it('renders sidebar when visible', async () => {
    const { useIsSidebarVisible } = await import('./stores/app-store.js');
    vi.mocked(useIsSidebarVisible).mockReturnValue(true);

    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('Sidebar');
  });

  it('hides sidebar when not visible', async () => {
    const { useIsSidebarVisible } = await import('./stores/app-store.js');
    vi.mocked(useIsSidebarVisible).mockReturnValue(false);

    const { lastFrame } = render(<App />);
    // Sidebar component shouldn't be rendered
    expect(lastFrame()).not.toContain('Sidebar:');
  });

  it('renders PR list screen by default', async () => {
    const { useCurrentView } = await import('./stores/app-store.js');
    vi.mocked(useCurrentView).mockReturnValue('list');

    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('PR List Screen');
  });

  it('renders dashboard screen when view is dashboard', async () => {
    const { useCurrentView } = await import('./stores/app-store.js');
    vi.mocked(useCurrentView).mockReturnValue('dashboard');

    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('Dashboard Screen');
  });

  it('renders settings screen when view is settings', async () => {
    const { useCurrentView } = await import('./stores/app-store.js');
    vi.mocked(useCurrentView).mockReturnValue('settings');

    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('Settings Screen');
  });

  it('renders detail screen when view is detail', async () => {
    const { useCurrentView } = await import('./stores/app-store.js');
    vi.mocked(useCurrentView).mockReturnValue('detail');

    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('PR Detail Screen');
  });

  it('renders diff screen when view is files', async () => {
    const { useCurrentView } = await import('./stores/app-store.js');
    vi.mocked(useCurrentView).mockReturnValue('files');

    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('Diff Screen');
  });

  it('renders AI review screen when view is ai', async () => {
    const { useCurrentView } = await import('./stores/app-store.js');
    vi.mocked(useCurrentView).mockReturnValue('ai');

    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('AI Review Screen');
  });

  it('renders status bar', () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('Status:');
  });

  it('renders toast container', () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('Toasts:');
  });

  it('shows help panel when isHelpOpen is true', async () => {
    const { useAppStore } = await import('./stores/app-store.js');
    const mockState = {
      currentView: 'list' as const,
      isSidebarVisible: true,
      isCommandPaletteOpen: false,
      isHelpOpen: true,
      selectedRepo: null,
      setView: vi.fn(),
      toggleSidebar: vi.fn(),
      toggleHelp: vi.fn(),
      toggleCommandPalette: vi.fn(),
      selectRepo: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );

    const { lastFrame } = render(<App />);
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
      selectedRepo: null,
      setView: vi.fn(),
      toggleSidebar: vi.fn(),
      toggleHelp: vi.fn(),
      toggleCommandPalette: vi.fn(),
      selectRepo: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );

    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('Command Palette');
  });

  it('calculates sidebar items from pull requests', async () => {
    const { usePullRequests, useIsSidebarVisible, useCurrentView } = await import('./stores/app-store.js');
    vi.mocked(useIsSidebarVisible).mockReturnValue(true);
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

    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('Sidebar');
    // Sidebar should have "All" plus repo items
    expect(lastFrame()).toContain('items');
  });

  it('shows vim navigation hints in status bar', async () => {
    const { useConfig } = await import('./hooks/index.js');
    vi.mocked(useConfig).mockReturnValue({
      config: { version: '1.0.0' },
      isVimMode: true,
    });

    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('j/k:scroll');
  });

  it('shows arrow key hints when not in vim mode', async () => {
    const { useConfig } = await import('./hooks/index.js');
    vi.mocked(useConfig).mockReturnValue({
      config: { version: '1.0.0' },
      isVimMode: false,
    });

    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('↑/↓:scroll');
  });
});

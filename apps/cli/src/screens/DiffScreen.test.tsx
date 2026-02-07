import React from 'react';
import { Text, Box } from 'ink';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { DiffScreen } from './DiffScreen.js';
import type { PullRequest } from '@lazyreview/core';

// Mock the store - useAppStore is a zustand store that takes a selector
vi.mock('../stores/app-store.js', () => {
  const mockState = {
    currentDiff: '',
    setView: vi.fn(),
    selectedFileIndex: 0,
    setSelectedListIndex: vi.fn(),
    demoMode: true,
    setCurrentDiff: vi.fn(),
  };
  return {
    useAppStore: vi.fn((selector: any) => selector ? selector(mockState) : mockState),
    usePullRequests: vi.fn(() => []),
    useSelectedPR: vi.fn(() => null),
    useSelectedRepo: vi.fn(() => ({ owner: 'org', repo: 'repo', provider: 'github' })),
    useStatus: vi.fn(() => 'ready'),
  };
});

// Mock hooks
vi.mock('../hooks/index.js', () => ({
  useDiff: vi.fn(() => ({
    currentLine: 0,
    selectedLines: [],
    navigateUp: vi.fn(),
    navigateDown: vi.fn(),
    navigateToNextHunk: vi.fn(),
    navigateToPrevHunk: vi.fn(),
    toggleLineSelection: vi.fn(),
  })),
  usePullRequestDiff: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

// Mock UI components with proper Ink-compatible output
vi.mock('@lazyreview/ui', () => ({
  DiffView: ({ diff }: any) =>
    React.createElement(Text, null, `Diff: ${typeof diff === 'string' ? diff.substring(0, 20) : ''}...`),
  FileTree: ({ files }: any) =>
    React.createElement(Text, null, files?.map((f: any) => f.path).join(', ') ?? ''),
  Spinner: ({ label }: any) =>
    React.createElement(Text, null, label),
  EmptyState: ({ title, message }: any) =>
    React.createElement(Text, null, `${title}: ${message}`),
  SplitPane: ({ children }: any) =>
    React.createElement(Box, null, children),
}));

const mockDiff = `diff --git a/src/index.ts b/src/index.ts
index abc123..def456 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,5 +1,7 @@
 const x = 1;
+const y = 2;
 console.log(x);
+console.log(y);`;

const mockPR: PullRequest = {
  id: '1',
  number: 42,
  title: 'Fix important bug',
  body: 'This PR fixes an important bug',
  state: 'open',
  isDraft: false,
  author: { login: 'alice', avatarUrl: '' },
  createdAt: new Date('2026-02-01'),
  updatedAt: new Date('2026-02-05'),
  baseRef: 'main',
  headRef: 'fix/bug',
  url: 'https://github.com/org/repo/pull/42',
  labels: [],
  files: [
    { path: 'src/index.ts', status: 'modified', additions: 10, deletions: 5 },
    { path: 'src/utils.ts', status: 'added', additions: 50, deletions: 0 },
  ],
};

describe('DiffScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', async () => {
    const { useAppStore, usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');

    const mockState = {
      currentDiff: '',
      setView: vi.fn(),
      selectedFileIndex: 0,
      setSelectedListIndex: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('loading');

    const { lastFrame } = render(<DiffScreen />);
    expect(lastFrame()).toContain('Loading diff');
  });

  it('shows empty state when no PR selected', async () => {
    const { useAppStore, usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');

    const mockState = {
      currentDiff: '',
      setView: vi.fn(),
      selectedFileIndex: 0,
      setSelectedListIndex: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(null);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<DiffScreen />);
    expect(lastFrame()).toContain('No PR Selected');
  });

  it('shows empty state when no files', async () => {
    const { useAppStore, usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');

    const prWithNoFiles = { ...mockPR, files: [] };
    const mockState = {
      currentDiff: '',
      setView: vi.fn(),
      selectedFileIndex: 0,
      setSelectedListIndex: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue([prWithNoFiles]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<DiffScreen />);
    expect(lastFrame()).toContain('No Changed Files');
  });

  it('renders file header with path', async () => {
    const { useAppStore, usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');

    const mockState = {
      currentDiff: mockDiff,
      setView: vi.fn(),
      selectedFileIndex: 0,
      setSelectedListIndex: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<DiffScreen />);
    expect(lastFrame()).toContain('src/index.ts');
  });

  it('shows file stats in header', async () => {
    const { useAppStore, usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');

    const mockState = {
      currentDiff: mockDiff,
      setView: vi.fn(),
      selectedFileIndex: 0,
      setSelectedListIndex: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<DiffScreen />);
    expect(lastFrame()).toContain('+10');
    expect(lastFrame()).toContain('-5');
  });

  it('renders diff view when diff available', async () => {
    const { useAppStore, usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');

    const mockState = {
      currentDiff: mockDiff,
      setView: vi.fn(),
      selectedFileIndex: 0,
      setSelectedListIndex: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<DiffScreen />);
    expect(lastFrame()).toContain('Diff:');
  });

  it('shows keyboard shortcuts in status bar', async () => {
    const { useAppStore, usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');

    const mockState = {
      currentDiff: mockDiff,
      setView: vi.fn(),
      selectedFileIndex: 0,
      setSelectedListIndex: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<DiffScreen />);
    expect(lastFrame()).toContain('j/k:scroll');
    expect(lastFrame()).toContain('n/N:hunks');
  });
});

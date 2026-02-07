import React from 'react';
import { Text, Box } from 'ink';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { AIReviewScreen } from './AIReviewScreen.js';
import type { PullRequest } from '@lazyreview/core';

// Mock the store - useAppStore is a zustand store that takes a selector
vi.mock('../stores/app-store.js', () => {
  const mockState = {
    currentDiff: '',
    setView: vi.fn(),
  };
  return {
    useAppStore: vi.fn((selector: any) => selector ? selector(mockState) : mockState),
    usePullRequests: vi.fn(() => []),
    useSelectedPR: vi.fn(() => null),
    useStatus: vi.fn(() => 'ready'),
  };
});

// Mock hooks
vi.mock('../hooks/index.js', () => ({
  useAIReview: vi.fn(() => ({
    review: null,
    isLoading: false,
    error: null,
    progress: 0,
    startReview: vi.fn(),
    cancelReview: vi.fn(),
    clearReview: vi.fn(),
  })),
}));

// Mock UI components with proper Ink-compatible output
vi.mock('@lazyreview/ui', () => ({
  Spinner: ({ label }: any) =>
    React.createElement(Text, null, label),
  EmptyState: ({ title, message }: any) =>
    React.createElement(Text, null, `${title}: ${message}`),
  ProgressBar: ({ progress }: any) =>
    React.createElement(Text, null, `Progress: ${progress}%`),
  Card: ({ children }: any) =>
    React.createElement(Box, null, children),
  Section: ({ title, children }: any) =>
    React.createElement(Text, null, `${title}: ${children}`),
  StatusBadge: ({ status }: any) =>
    React.createElement(Text, null, `[${status}]`),
  Markdown: ({ content }: any) =>
    React.createElement(Text, null, content),
}));

const mockPR: PullRequest = {
  id: '1',
  number: 42,
  title: 'Fix important bug',
  body: '',
  state: 'open',
  isDraft: false,
  author: { login: 'alice', avatarUrl: '' },
  createdAt: new Date(),
  updatedAt: new Date(),
  baseRef: 'main',
  headRef: 'fix/bug',
  url: '',
  labels: [],
};

const mockDiff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,5 @@
 const x = 1;
+const y = 2;
 console.log(x);`;

describe('AIReviewScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state when app is loading', async () => {
    const { useAppStore, usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');

    const mockState = {
      currentDiff: mockDiff,
      setView: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('loading');

    const { lastFrame } = render(<AIReviewScreen />);
    expect(lastFrame()).toContain('Loading');
  });

  it('shows empty state when no PR selected', async () => {
    const { useAppStore, usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');

    const mockState = {
      currentDiff: '',
      setView: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(null);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<AIReviewScreen />);
    expect(lastFrame()).toContain('No PR Selected');
  });

  it('shows empty state when no diff available', async () => {
    const { useAppStore, usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');

    const mockState = {
      currentDiff: '',
      setView: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<AIReviewScreen />);
    expect(lastFrame()).toContain('No Diff Available');
  });

  it('shows AI review loading state with progress', async () => {
    const { useAppStore, usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');
    const { useAIReview } = await import('../hooks/index.js');

    const mockState = {
      currentDiff: mockDiff,
      setView: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('ready');
    vi.mocked(useAIReview).mockReturnValue({
      review: null,
      isLoading: true,
      error: null,
      progress: 50,
      startReview: vi.fn(),
      cancelReview: vi.fn(),
      clearReview: vi.fn(),
    });

    const { lastFrame } = render(<AIReviewScreen />);
    expect(lastFrame()).toContain('Analyzing code');
    expect(lastFrame()).toContain('Progress: 50%');
  });

  it('shows error state when review fails', async () => {
    const { useAppStore, usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');
    const { useAIReview } = await import('../hooks/index.js');

    const mockState = {
      currentDiff: mockDiff,
      setView: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('ready');
    vi.mocked(useAIReview).mockReturnValue({
      review: null,
      isLoading: false,
      error: 'API error occurred',
      progress: 0,
      startReview: vi.fn(),
      cancelReview: vi.fn(),
      clearReview: vi.fn(),
    });

    const { lastFrame } = render(<AIReviewScreen />);
    expect(lastFrame()).toContain('Review Failed');
    expect(lastFrame()).toContain('API error occurred');
    expect(lastFrame()).toContain('r:retry');
  });

  it('shows review results when available', async () => {
    const { useAppStore, usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');
    const { useAIReview } = await import('../hooks/index.js');

    const mockState = {
      currentDiff: mockDiff,
      setView: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('ready');
    vi.mocked(useAIReview).mockReturnValue({
      review: {
        issues: [
          { title: 'Missing error handling', severity: 'warning', description: 'Add try-catch' },
          { title: 'Good variable naming', severity: 'praise', description: 'Nice work!' },
        ],
        summary: {
          critical: 0,
          warnings: 1,
          suggestions: 0,
          praise: 1,
        },
      },
      isLoading: false,
      error: null,
      progress: 100,
      startReview: vi.fn(),
      cancelReview: vi.fn(),
      clearReview: vi.fn(),
    });

    const { lastFrame } = render(<AIReviewScreen />);
    expect(lastFrame()).toContain('AI Review');
    expect(lastFrame()).toContain('2 issues found');
    expect(lastFrame()).toContain('Warning: 1');
    expect(lastFrame()).toContain('Praise: 1');
  });

  it('shows issue titles in list', async () => {
    const { useAppStore, usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');
    const { useAIReview } = await import('../hooks/index.js');

    const mockState = {
      currentDiff: mockDiff,
      setView: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('ready');
    vi.mocked(useAIReview).mockReturnValue({
      review: {
        issues: [
          { title: 'Missing error handling', severity: 'warning', description: 'Add try-catch' },
        ],
        summary: { critical: 0, warnings: 1, suggestions: 0, praise: 0 },
      },
      isLoading: false,
      error: null,
      progress: 100,
      startReview: vi.fn(),
      cancelReview: vi.fn(),
      clearReview: vi.fn(),
    });

    const { lastFrame } = render(<AIReviewScreen />);
    expect(lastFrame()).toContain('Missing error handling');
  });

  it('shows keyboard shortcuts', async () => {
    const { useAppStore, usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');
    const { useAIReview } = await import('../hooks/index.js');

    const mockState = {
      currentDiff: mockDiff,
      setView: vi.fn(),
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('ready');
    vi.mocked(useAIReview).mockReturnValue({
      review: {
        issues: [{ title: 'Test', severity: 'info', description: 'Test' }],
        summary: { critical: 0, warnings: 0, suggestions: 0, praise: 0 },
      },
      isLoading: false,
      error: null,
      progress: 100,
      startReview: vi.fn(),
      cancelReview: vi.fn(),
      clearReview: vi.fn(),
    });

    const { lastFrame } = render(<AIReviewScreen />);
    expect(lastFrame()).toContain('j/k:navigate');
    expect(lastFrame()).toContain('r:re-run');
    expect(lastFrame()).toContain('q:back');
  });
});

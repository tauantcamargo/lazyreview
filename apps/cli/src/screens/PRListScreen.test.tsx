import React from 'react';
import { Text, Box } from 'ink';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { PRListScreen } from './PRListScreen.js';
import type { PullRequest } from '@lazyreview/core';

// Mock the store - useAppStore is a zustand store that takes a selector
vi.mock('../stores/app-store.js', () => {
  const mockState = {
    selectPR: vi.fn(),
    selectedListIndex: 0,
    setSelectedListIndex: vi.fn(),
    searchQuery: '',
  };
  return {
    useAppStore: vi.fn((selector: any) => selector ? selector(mockState) : mockState),
    usePullRequests: vi.fn(() => []),
    useSelectedRepo: vi.fn(() => null),
    useStatus: vi.fn(() => 'ready'),
  };
});

// Mock hooks
vi.mock('../hooks/index.js', () => ({
  useNavigation: vi.fn(() => ({
    navigateUp: vi.fn(),
    navigateDown: vi.fn(),
    navigateToTop: vi.fn(),
    navigateToBottom: vi.fn(),
  })),
  useKeyboard: vi.fn(() => ({})),
}));

// Mock UI components with proper Ink-compatible output
vi.mock('@lazyreview/ui', () => ({
  VirtualList: ({ items, renderItem }: any) =>
    React.createElement(Box, { flexDirection: 'column' },
      items.map((item: any, idx: number) =>
        React.createElement(Box, { key: idx }, renderItem(item, idx))
      )
    ),
  PRListItem: ({ title, number }: any) =>
    React.createElement(Text, null, `#${number} ${title}`),
  EmptyState: ({ title, message }: any) =>
    React.createElement(Text, null, `${title}: ${message}`),
  Spinner: ({ label }: any) =>
    React.createElement(Text, null, label),
}));

const mockPRs: PullRequest[] = [
  {
    id: '1',
    number: 1,
    title: 'Fix authentication bug',
    body: 'This fixes the auth issue',
    state: 'open',
    isDraft: false,
    author: { login: 'alice', avatarUrl: '' },
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-05'),
    baseRef: 'main',
    headRef: 'fix/auth',
    url: 'https://github.com/org/repo/pull/1',
    labels: [],
  },
  {
    id: '2',
    number: 2,
    title: 'Add new feature',
    body: 'New feature implementation',
    state: 'open',
    isDraft: true,
    author: { login: 'bob', avatarUrl: '' },
    createdAt: new Date('2026-02-02'),
    updatedAt: new Date('2026-02-04'),
    baseRef: 'main',
    headRef: 'feat/new',
    url: 'https://github.com/org/repo/pull/2',
    labels: [{ name: 'enhancement', color: '00ff00' }],
  },
];

describe('PRListScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', async () => {
    const { usePullRequests, useSelectedRepo, useStatus } =
      await import('../stores/app-store.js');

    vi.mocked(usePullRequests).mockReturnValue([]);
    vi.mocked(useSelectedRepo).mockReturnValue({ owner: 'org', repo: 'repo', provider: 'github' });
    vi.mocked(useStatus).mockReturnValue('loading');

    const { lastFrame } = render(<PRListScreen />);
    expect(lastFrame()).toContain('Loading pull requests');
  });

  it('shows empty state when no repo selected', async () => {
    const { usePullRequests, useSelectedRepo, useStatus } =
      await import('../stores/app-store.js');

    vi.mocked(usePullRequests).mockReturnValue([]);
    vi.mocked(useSelectedRepo).mockReturnValue(null);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<PRListScreen />);
    expect(lastFrame()).toContain('No Repository Selected');
  });

  it('shows empty state when no PRs', async () => {
    const { usePullRequests, useSelectedRepo, useStatus } =
      await import('../stores/app-store.js');

    vi.mocked(usePullRequests).mockReturnValue([]);
    vi.mocked(useSelectedRepo).mockReturnValue({ owner: 'org', repo: 'repo', provider: 'github' });
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<PRListScreen />);
    expect(lastFrame()).toContain('No Pull Requests');
  });

  it('renders PR list header with count', async () => {
    const { useAppStore, usePullRequests, useSelectedRepo, useStatus } =
      await import('../stores/app-store.js');

    const mockState = {
      selectPR: vi.fn(),
      selectedListIndex: 0,
      setSelectedListIndex: vi.fn(),
      searchQuery: '',
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue(mockPRs);
    vi.mocked(useSelectedRepo).mockReturnValue({ owner: 'org', repo: 'repo', provider: 'github' });
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<PRListScreen />);
    expect(lastFrame()).toContain('Pull Requests (2)');
  });

  it('filters PRs by search query', async () => {
    const { useAppStore, usePullRequests, useSelectedRepo, useStatus } =
      await import('../stores/app-store.js');

    const mockState = {
      selectPR: vi.fn(),
      selectedListIndex: 0,
      setSelectedListIndex: vi.fn(),
      searchQuery: 'auth',
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue(mockPRs);
    vi.mocked(useSelectedRepo).mockReturnValue({ owner: 'org', repo: 'repo', provider: 'github' });
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<PRListScreen />);
    expect(lastFrame()).toContain('filtered by "auth"');
  });

  it('shows no matching PRs for search', async () => {
    const { useAppStore, usePullRequests, useSelectedRepo, useStatus } =
      await import('../stores/app-store.js');

    const mockState = {
      selectPR: vi.fn(),
      selectedListIndex: 0,
      setSelectedListIndex: vi.fn(),
      searchQuery: 'nonexistent',
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    );
    vi.mocked(usePullRequests).mockReturnValue(mockPRs);
    vi.mocked(useSelectedRepo).mockReturnValue({ owner: 'org', repo: 'repo', provider: 'github' });
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<PRListScreen />);
    expect(lastFrame()).toContain('No Matching PRs');
  });
});

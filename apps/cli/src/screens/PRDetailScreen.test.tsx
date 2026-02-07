import React from 'react';
import { Text, Box } from 'ink';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { PRDetailScreen } from './PRDetailScreen.js';
import type { PullRequest } from '@lazyreview/core';

// Mock the store
vi.mock('../stores/app-store.js', () => ({
  useAppStore: vi.fn(() => ({
    setView: vi.fn(),
    selectedFileIndex: 0,
  })),
  usePullRequests: vi.fn(() => []),
  useSelectedPR: vi.fn(() => null),
  useStatus: vi.fn(() => 'ready'),
}));

// Mock UI components with proper Ink-compatible output
vi.mock('@lazyreview/ui', () => ({
  PRDetail: ({ title }: any) => React.createElement(Text, null, title),
  Tabs: ({ tabs, activeTab }: any) =>
    React.createElement(Text, null,
      tabs.map((t: any) => `[${t.id === activeTab ? '*' : ' '}${t.label}]`).join(' ')
    ),
  FileTree: ({ files }: any) =>
    React.createElement(Text, null, files.map((f: any) => f.path).join(', ')),
  CommentsPanel: ({ comments }: any) =>
    React.createElement(Text, null, `${comments.length} comments`),
  ReviewPanel: ({ reviews }: any) =>
    React.createElement(Text, null, `${reviews.length} reviews`),
  Timeline: ({ events }: any) =>
    React.createElement(Text, null, `${events.length} events`),
  Spinner: ({ label }: any) =>
    React.createElement(Text, null, label),
  EmptyState: ({ title, message }: any) =>
    React.createElement(Text, null, `${title}: ${message}`),
}));

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
  comments: [
    { id: 1, author: { login: 'bob' }, body: 'Looks good!', createdAt: new Date() },
  ],
  reviews: [
    { id: 1, author: { login: 'charlie' }, state: 'approved', body: 'LGTM', submittedAt: new Date() },
  ],
  timeline: [
    { id: 1, type: 'commit', actor: { login: 'alice' }, createdAt: new Date(), message: 'Initial commit' },
  ],
};

describe('PRDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', async () => {
    const { usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');

    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('loading');

    const { lastFrame } = render(<PRDetailScreen />);
    expect(lastFrame()).toContain('Loading PR details');
  });

  it('shows empty state when no PR selected', async () => {
    const { usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');

    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(null);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<PRDetailScreen />);
    expect(lastFrame()).toContain('No PR Selected');
  });

  it('renders PR header with number and title', async () => {
    const { usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');

    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<PRDetailScreen />);
    expect(lastFrame()).toContain('#42');
    expect(lastFrame()).toContain('Fix important bug');
  });

  it('renders author and branch info', async () => {
    const { usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');

    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<PRDetailScreen />);
    expect(lastFrame()).toContain('@alice');
    expect(lastFrame()).toContain('fix/bug');
    expect(lastFrame()).toContain('main');
  });

  it('renders tabs for files, comments, timeline, reviews', async () => {
    const { usePullRequests, useSelectedPR, useStatus } =
      await import('../stores/app-store.js');

    vi.mocked(usePullRequests).mockReturnValue([mockPR]);
    vi.mocked(useSelectedPR).mockReturnValue(42);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<PRDetailScreen />);
    expect(lastFrame()).toContain('Files');
    expect(lastFrame()).toContain('Comments');
    expect(lastFrame()).toContain('Timeline');
    expect(lastFrame()).toContain('Reviews');
  });
});

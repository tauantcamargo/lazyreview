import React from 'react';
import { Text, Box } from 'ink';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { DashboardScreen } from './DashboardScreen.js';
import type { PullRequest } from '@lazyreview/core';

// Mock the store
vi.mock('../stores/app-store.js', () => ({
  useAppStore: vi.fn(() => ({
    setView: vi.fn(),
    setFilters: vi.fn(),
  })),
  usePullRequests: vi.fn(() => []),
  useStatus: vi.fn(() => 'ready'),
}));

// Mock UI components with proper Ink-compatible output
vi.mock('@lazyreview/ui', () => ({
  Dashboard: ({ sections }: any) =>
    React.createElement(Text, null, sections.map((s: any) => s.title).join(', ')),
  StatusBadge: ({ status }: any) =>
    React.createElement(Text, null, status),
  CountBadge: ({ count }: any) =>
    React.createElement(Text, null, String(count)),
  Spinner: ({ label }: any) =>
    React.createElement(Text, null, label),
  EmptyState: ({ title, message }: any) =>
    React.createElement(Text, null, `${title}: ${message}`),
}));

const mockPRs: PullRequest[] = [
  {
    id: '1',
    number: 1,
    title: 'Fix auth bug',
    body: '',
    state: 'open',
    isDraft: false,
    author: { login: 'alice', avatarUrl: '' },
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-05'),
    baseRef: 'main',
    headRef: 'fix/auth',
    url: '',
    labels: [],
  },
  {
    id: '2',
    number: 2,
    title: 'Add feature',
    body: '',
    state: 'open',
    isDraft: true,
    author: { login: 'bob', avatarUrl: '' },
    createdAt: new Date('2026-02-02'),
    updatedAt: new Date('2026-02-04'),
    baseRef: 'main',
    headRef: 'feat/new',
    url: '',
    labels: [],
  },
  {
    id: '3',
    number: 3,
    title: 'Merged PR',
    body: '',
    state: 'merged',
    isDraft: false,
    author: { login: 'charlie', avatarUrl: '' },
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-20'),
    baseRef: 'main',
    headRef: 'feat/merged',
    url: '',
    labels: [],
    reviewDecision: 'APPROVED',
  },
];

describe('DashboardScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', async () => {
    const { usePullRequests, useStatus } =
      await import('../stores/app-store.js');

    vi.mocked(usePullRequests).mockReturnValue([]);
    vi.mocked(useStatus).mockReturnValue('loading');

    const { lastFrame } = render(<DashboardScreen />);
    expect(lastFrame()).toContain('Loading dashboard');
  });

  it('shows empty state when no PRs', async () => {
    const { usePullRequests, useStatus } =
      await import('../stores/app-store.js');

    vi.mocked(usePullRequests).mockReturnValue([]);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<DashboardScreen />);
    expect(lastFrame()).toContain('No Pull Requests');
  });

  it('renders dashboard title', async () => {
    const { usePullRequests, useStatus } =
      await import('../stores/app-store.js');

    vi.mocked(usePullRequests).mockReturnValue(mockPRs);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<DashboardScreen />);
    expect(lastFrame()).toContain('Dashboard');
  });

  it('shows status statistics', async () => {
    const { usePullRequests, useStatus } =
      await import('../stores/app-store.js');

    vi.mocked(usePullRequests).mockReturnValue(mockPRs);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<DashboardScreen />);
    expect(lastFrame()).toContain('Status');
    expect(lastFrame()).toContain('Open');
    expect(lastFrame()).toContain('Draft');
    expect(lastFrame()).toContain('Merged');
  });

  it('shows reviews statistics', async () => {
    const { usePullRequests, useStatus } =
      await import('../stores/app-store.js');

    vi.mocked(usePullRequests).mockReturnValue(mockPRs);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<DashboardScreen />);
    expect(lastFrame()).toContain('Reviews');
    expect(lastFrame()).toContain('Needs Review');
    expect(lastFrame()).toContain('Approved');
  });

  it('shows recent activity section', async () => {
    const { usePullRequests, useStatus } =
      await import('../stores/app-store.js');

    vi.mocked(usePullRequests).mockReturnValue(mockPRs);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<DashboardScreen />);
    expect(lastFrame()).toContain('Recent Activity');
  });

  it('shows recent PRs with numbers', async () => {
    const { usePullRequests, useStatus } =
      await import('../stores/app-store.js');

    vi.mocked(usePullRequests).mockReturnValue(mockPRs);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<DashboardScreen />);
    expect(lastFrame()).toContain('#1');
    expect(lastFrame()).toContain('#2');
  });

  it('shows keyboard shortcuts', async () => {
    const { usePullRequests, useStatus } =
      await import('../stores/app-store.js');

    vi.mocked(usePullRequests).mockReturnValue(mockPRs);
    vi.mocked(useStatus).mockReturnValue('ready');

    const { lastFrame } = render(<DashboardScreen />);
    expect(lastFrame()).toContain('1:Open PRs');
    expect(lastFrame()).toContain('2:All PRs');
    expect(lastFrame()).toContain('q:Back');
  });
});

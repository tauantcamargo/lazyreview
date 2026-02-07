import React from 'react';
import { Text, Box } from 'ink';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { PRActionDialogs, type PRActionType } from './PRActionDialogs.js';

// Mock the store
vi.mock('../stores/app-store.js', () => {
  const mockState = {
    selectedPRNumber: 42,
  };
  return {
    useAppStore: vi.fn((selector: any) => selector ? selector(mockState) : mockState),
    usePullRequests: vi.fn(() => [{
      id: '1',
      number: 42,
      title: 'Test PR',
      author: { login: 'alice', avatarUrl: '' },
      state: 'open',
    }]),
    useSelectedPR: vi.fn(() => 42),
    useSelectedRepo: vi.fn(() => ({ owner: 'org', repo: 'repo', provider: 'github' })),
  };
});

// Mock hooks
vi.mock('../hooks/index.js', () => ({
  useApprovePR: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
  })),
  useRequestChanges: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
  })),
  useCreateComment: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock UI components
vi.mock('@lazyreview/ui', () => ({
  TextArea: ({ value, placeholder }: any) =>
    React.createElement(Text, null, `TextArea: ${value || placeholder}`),
  ConfirmDialog: ({ title, message }: any) =>
    React.createElement(Text, null, `ConfirmDialog: ${title} - ${message}`),
}));

describe('PRActionDialogs', () => {
  const defaultProps = {
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when action is null', () => {
    const { lastFrame } = render(
      <PRActionDialogs action={null} {...defaultProps} />
    );
    expect(lastFrame()).toBe('');
  });

  it('renders approve dialog', () => {
    const { lastFrame } = render(
      <PRActionDialogs action="approve" {...defaultProps} />
    );
    expect(lastFrame()).toContain('Approve PR #42');
    expect(lastFrame()).toContain('Test PR');
  });

  it('renders request-changes dialog', () => {
    const { lastFrame } = render(
      <PRActionDialogs action="request-changes" {...defaultProps} />
    );
    expect(lastFrame()).toContain('Request Changes');
    expect(lastFrame()).toContain('#42');
  });

  it('renders comment dialog', () => {
    const { lastFrame } = render(
      <PRActionDialogs action="comment" {...defaultProps} />
    );
    expect(lastFrame()).toContain('Add Comment');
    expect(lastFrame()).toContain('#42');
  });

  it('renders merge dialog', () => {
    const { lastFrame } = render(
      <PRActionDialogs action="merge" {...defaultProps} />
    );
    expect(lastFrame()).toContain('Merge PR #42');
  });

  it('shows PR title in approve dialog', () => {
    const { lastFrame } = render(
      <PRActionDialogs action="approve" {...defaultProps} />
    );
    expect(lastFrame()).toContain('Test PR');
  });

  it('shows submit instructions in approve dialog', () => {
    const { lastFrame } = render(
      <PRActionDialogs action="approve" {...defaultProps} />
    );
    expect(lastFrame()).toContain('Ctrl+Enter');
    expect(lastFrame()).toContain('Esc');
  });

  it('shows merge method options in merge dialog', () => {
    const { lastFrame } = render(
      <PRActionDialogs action="merge" {...defaultProps} />
    );
    expect(lastFrame()).toContain('Merge commit');
    expect(lastFrame()).toContain('Squash');
    expect(lastFrame()).toContain('Rebase');
  });
});

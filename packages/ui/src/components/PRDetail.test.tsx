import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { PRDetail, type PRDetailData } from './PRDetail';

describe('PRDetail', () => {
  const createPR = (overrides: Partial<PRDetailData> = {}): PRDetailData => ({
    id: 'pr-1',
    number: 123,
    title: 'Add new feature',
    repo: 'owner/repo',
    author: 'developer',
    state: 'open',
    sourceBranch: 'feature/new-feature',
    targetBranch: 'main',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  it('renders PR number and title', () => {
    const pr = createPR({ number: 456, title: 'Fix important bug' });
    const { lastFrame } = render(
      <PRDetail pr={pr} width={80} height={30} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('#456');
    expect(frame).toContain('Fix important bug');
  });

  it('renders repo name', () => {
    const pr = createPR({ repo: 'facebook/react' });
    const { lastFrame } = render(
      <PRDetail pr={pr} width={80} height={30} />
    );
    expect(lastFrame()).toContain('facebook/react');
  });

  it('renders author', () => {
    const pr = createPR({ author: 'johndoe' });
    const { lastFrame } = render(
      <PRDetail pr={pr} width={80} height={30} />
    );
    expect(lastFrame()).toContain('johndoe');
  });

  it('renders branch information', () => {
    const pr = createPR({
      sourceBranch: 'feature/auth',
      targetBranch: 'develop',
    });
    const { lastFrame } = render(
      <PRDetail pr={pr} width={80} height={30} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('feature/auth');
    expect(frame).toContain('develop');
  });

  it('shows Open state for open PRs', () => {
    const pr = createPR({ state: 'open' });
    const { lastFrame } = render(
      <PRDetail pr={pr} width={80} height={30} />
    );
    expect(lastFrame()).toContain('Open');
  });

  it('shows Draft state for draft PRs', () => {
    const pr = createPR({ state: 'draft' });
    const { lastFrame } = render(
      <PRDetail pr={pr} width={80} height={30} />
    );
    expect(lastFrame()).toContain('Draft');
  });

  it('shows Merged state for merged PRs', () => {
    const pr = createPR({ state: 'merged' });
    const { lastFrame } = render(
      <PRDetail pr={pr} width={80} height={30} />
    );
    expect(lastFrame()).toContain('Merged');
  });

  it('shows Closed state for closed PRs', () => {
    const pr = createPR({ state: 'closed' });
    const { lastFrame } = render(
      <PRDetail pr={pr} width={80} height={30} />
    );
    expect(lastFrame()).toContain('Closed');
  });

  it('renders change statistics', () => {
    const pr = createPR({
      additions: 150,
      deletions: 50,
      changedFiles: 10,
    });
    const { lastFrame } = render(
      <PRDetail pr={pr} width={80} height={30} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('+150');
    expect(frame).toContain('-50');
    expect(frame).toContain('10 files');
  });

  it('renders labels', () => {
    const pr = createPR({
      labels: ['bug', 'high-priority', 'frontend'],
    });
    const { lastFrame } = render(
      <PRDetail pr={pr} width={80} height={30} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('bug');
    expect(frame).toContain('high-priority');
    expect(frame).toContain('frontend');
  });

  it('renders reviewers', () => {
    const pr = createPR({
      reviewers: ['alice', 'bob'],
    });
    const { lastFrame } = render(
      <PRDetail pr={pr} width={80} height={30} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('alice');
    expect(frame).toContain('bob');
  });

  it('renders body/description', () => {
    const pr = createPR({
      body: 'This PR adds new authentication flow with OAuth support.',
    });
    const { lastFrame } = render(
      <PRDetail pr={pr} width={80} height={30} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Description');
    expect(frame).toContain('authentication flow');
  });

  it('applies custom theme', () => {
    const theme = {
      accent: 'blue',
      muted: 'gray',
      added: 'green',
      removed: 'red',
    };
    const pr = createPR();
    const { lastFrame } = render(
      <PRDetail pr={pr} width={80} height={30} theme={theme} />
    );
    expect(lastFrame()).toBeDefined();
  });
});

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import { PRListItem, PRListHeader } from './PRListItem';

describe('PRListItem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders PR number and title', () => {
    const { lastFrame } = render(
      <PRListItem
        number={42}
        title="Fix authentication bug"
        author="alice"
        repo="org/repo"
        status="open"
        updatedAt="2024-06-15T10:00:00Z"
      />
    );
    const output = lastFrame();

    expect(output).toContain('#42');
    expect(output).toContain('Fix authentication bug');
  });

  it('renders author', () => {
    const { lastFrame } = render(
      <PRListItem
        number={42}
        title="Test PR"
        author="alice"
        repo="org/repo"
        status="open"
        updatedAt="2024-06-15T10:00:00Z"
      />
    );
    const output = lastFrame();

    expect(output).toContain('@alice');
  });

  it('truncates long author names', () => {
    const { lastFrame } = render(
      <PRListItem
        number={42}
        title="Test PR"
        author="verylongusername123"
        repo="org/repo"
        status="open"
        updatedAt="2024-06-15T10:00:00Z"
      />
    );
    const output = lastFrame();

    expect(output).toContain('@verylonguser');
  });

  it('renders open status icon', () => {
    const { lastFrame } = render(
      <PRListItem
        number={42}
        title="Test PR"
        author="alice"
        repo="org/repo"
        status="open"
        updatedAt="2024-06-15T10:00:00Z"
      />
    );
    const output = lastFrame();

    expect(output).toContain('●');
  });

  it('renders draft status icon', () => {
    const { lastFrame } = render(
      <PRListItem
        number={42}
        title="Test PR"
        author="alice"
        repo="org/repo"
        status="draft"
        updatedAt="2024-06-15T10:00:00Z"
      />
    );
    const output = lastFrame();

    expect(output).toContain('◐');
  });

  it('renders merged status icon', () => {
    const { lastFrame } = render(
      <PRListItem
        number={42}
        title="Test PR"
        author="alice"
        repo="org/repo"
        status="merged"
        updatedAt="2024-06-15T10:00:00Z"
      />
    );
    const output = lastFrame();

    expect(output).toContain('◆');
  });

  it('renders closed status icon', () => {
    const { lastFrame } = render(
      <PRListItem
        number={42}
        title="Test PR"
        author="alice"
        repo="org/repo"
        status="closed"
        updatedAt="2024-06-15T10:00:00Z"
      />
    );
    const output = lastFrame();

    expect(output).toContain('○');
  });

  it('renders relative time in minutes', () => {
    const { lastFrame } = render(
      <PRListItem
        number={42}
        title="Test PR"
        author="alice"
        repo="org/repo"
        status="open"
        updatedAt="2024-06-15T11:30:00Z"
      />
    );
    const output = lastFrame();

    expect(output).toContain('30m');
  });

  it('renders relative time in hours', () => {
    const { lastFrame } = render(
      <PRListItem
        number={42}
        title="Test PR"
        author="alice"
        repo="org/repo"
        status="open"
        updatedAt="2024-06-15T10:00:00Z"
      />
    );
    const output = lastFrame();

    expect(output).toContain('2h');
  });

  it('renders relative time in days', () => {
    const { lastFrame } = render(
      <PRListItem
        number={42}
        title="Test PR"
        author="alice"
        repo="org/repo"
        status="open"
        updatedAt="2024-06-13T12:00:00Z"
      />
    );
    const output = lastFrame();

    expect(output).toContain('2d');
  });

  it('renders approved review status', () => {
    const { lastFrame } = render(
      <PRListItem
        number={42}
        title="Test PR"
        author="alice"
        repo="org/repo"
        status="open"
        reviewStatus="approved"
        updatedAt="2024-06-15T10:00:00Z"
      />
    );
    const output = lastFrame();

    expect(output).toContain('✓');
  });

  it('renders changes requested review status', () => {
    const { lastFrame } = render(
      <PRListItem
        number={42}
        title="Test PR"
        author="alice"
        repo="org/repo"
        status="open"
        reviewStatus="changes_requested"
        updatedAt="2024-06-15T10:00:00Z"
      />
    );
    const output = lastFrame();

    expect(output).toContain('✗');
  });

  it('renders comment count', () => {
    const { lastFrame } = render(
      <PRListItem
        number={42}
        title="Test PR"
        author="alice"
        repo="org/repo"
        status="open"
        commentCount={5}
        updatedAt="2024-06-15T10:00:00Z"
      />
    );
    const output = lastFrame();

    expect(output).toContain('💬5');
  });

  it('hides comment count when zero', () => {
    const { lastFrame } = render(
      <PRListItem
        number={42}
        title="Test PR"
        author="alice"
        repo="org/repo"
        status="open"
        commentCount={0}
        updatedAt="2024-06-15T10:00:00Z"
      />
    );
    const output = lastFrame();

    expect(output).not.toContain('💬0');
  });

  it('renders stats when provided', () => {
    const { lastFrame } = render(
      <PRListItem
        number={42}
        title="Test PR"
        author="alice"
        repo="org/repo"
        status="open"
        additions={10}
        deletions={5}
        updatedAt="2024-06-15T10:00:00Z"
      />
    );
    const output = lastFrame();

    expect(output).toContain('+10');
    expect(output).toContain('-5');
  });

  it('truncates long titles', () => {
    const longTitle = 'This is a very long PR title that should be truncated to fit the available width';

    const { lastFrame } = render(
      <PRListItem
        number={42}
        title={longTitle}
        author="alice"
        repo="org/repo"
        status="open"
        updatedAt="2024-06-15T10:00:00Z"
        width={60}
      />
    );
    const output = lastFrame();

    expect(output).toContain('…');
    // Full title should not be present (it's truncated)
    expect(output).not.toContain('available width');
  });

  it('applies custom theme', () => {
    const customTheme = {
      primary: '#ff0000',
      secondary: '#00ff00',
      success: '#00ff00',
      error: '#ff0000',
      warning: '#ffff00',
      info: '#0000ff',
      muted: '#888888',
      text: '#ffffff',
      border: '#333333',
      selection: '#444444',
      accent: '#ff00ff',
    };

    const { lastFrame } = render(
      <PRListItem
        number={42}
        title="Test PR"
        author="alice"
        repo="org/repo"
        status="open"
        updatedAt="2024-06-15T10:00:00Z"
        theme={customTheme}
      />
    );

    expect(lastFrame()).toBeTruthy();
  });
});

describe('PRListHeader', () => {
  it('renders column headers', () => {
    const { lastFrame } = render(<PRListHeader />);
    const output = lastFrame();

    expect(output).toContain('Author');
    expect(output).toContain('Title');
    expect(output).toContain('Updated');
  });

  it('applies custom width', () => {
    const { lastFrame } = render(<PRListHeader width={100} />);

    expect(lastFrame()).toBeTruthy();
  });
});

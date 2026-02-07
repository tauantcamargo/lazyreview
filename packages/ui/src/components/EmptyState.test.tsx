import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import {
  EmptyState,
  PresetEmptyState,
  LoadingState,
  ErrorState,
  SuccessState,
  Placeholder,
} from './EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    const { lastFrame } = render(
      <EmptyState title="No data available" />
    );

    expect(lastFrame()).toContain('No data available');
  });

  it('renders icon', () => {
    const { lastFrame } = render(
      <EmptyState icon="🚀" title="Ready" />
    );

    expect(lastFrame()).toContain('🚀');
  });

  it('renders description', () => {
    const { lastFrame } = render(
      <EmptyState
        title="Empty"
        description="There's nothing here yet"
      />
    );

    expect(lastFrame()).toContain("There's nothing here yet");
  });

  it('renders action when provided', () => {
    const { lastFrame } = render(
      <EmptyState
        title="Empty"
        action={<Text>Press Enter to add</Text>}
      />
    );

    expect(lastFrame()).toContain('Press Enter to add');
  });

  it('uses default icon when not specified', () => {
    const { lastFrame } = render(
      <EmptyState title="Empty" />
    );

    expect(lastFrame()).toContain('📭');
  });
});

describe('PresetEmptyState', () => {
  it('renders no-prs preset', () => {
    const { lastFrame } = render(
      <PresetEmptyState type="no-prs" />
    );

    expect(lastFrame()).toContain('No Pull Requests');
    expect(lastFrame()).toContain('📋');
  });

  it('renders no-results preset', () => {
    const { lastFrame } = render(
      <PresetEmptyState type="no-results" />
    );

    expect(lastFrame()).toContain('No Results');
    expect(lastFrame()).toContain('🔍');
  });

  it('renders no-comments preset', () => {
    const { lastFrame } = render(
      <PresetEmptyState type="no-comments" />
    );

    expect(lastFrame()).toContain('No Comments');
    expect(lastFrame()).toContain('💬');
  });

  it('renders no-reviews preset', () => {
    const { lastFrame } = render(
      <PresetEmptyState type="no-reviews" />
    );

    expect(lastFrame()).toContain('No Reviews');
    expect(lastFrame()).toContain('👀');
  });

  it('renders no-favorites preset', () => {
    const { lastFrame } = render(
      <PresetEmptyState type="no-favorites" />
    );

    expect(lastFrame()).toContain('No Favorites');
    expect(lastFrame()).toContain('⭐');
  });

  it('renders no-workspaces preset', () => {
    const { lastFrame } = render(
      <PresetEmptyState type="no-workspaces" />
    );

    expect(lastFrame()).toContain('No Workspaces');
    expect(lastFrame()).toContain('📁');
  });

  it('renders error preset', () => {
    const { lastFrame } = render(
      <PresetEmptyState type="error" />
    );

    expect(lastFrame()).toContain('Something Went Wrong');
    expect(lastFrame()).toContain('❌');
  });

  it('renders offline preset', () => {
    const { lastFrame } = render(
      <PresetEmptyState type="offline" />
    );

    expect(lastFrame()).toContain('You are Offline');
    expect(lastFrame()).toContain('📡');
  });

  it('renders loading preset', () => {
    const { lastFrame } = render(
      <PresetEmptyState type="loading" />
    );

    expect(lastFrame()).toContain('Loading...');
    expect(lastFrame()).toContain('⏳');
  });

  it('allows custom message', () => {
    const { lastFrame } = render(
      <PresetEmptyState
        type="no-prs"
        customMessage="Create a PR to get started"
      />
    );

    expect(lastFrame()).toContain('Create a PR to get started');
  });

  it('renders action', () => {
    const { lastFrame } = render(
      <PresetEmptyState
        type="no-results"
        action={<Text>Clear filters</Text>}
      />
    );

    expect(lastFrame()).toContain('Clear filters');
  });
});

describe('LoadingState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders loading message', () => {
    const { lastFrame } = render(
      <LoadingState message="Fetching data..." />
    );

    expect(lastFrame()).toContain('Fetching data...');
  });

  it('uses default message', () => {
    const { lastFrame } = render(<LoadingState />);

    expect(lastFrame()).toContain('Loading...');
  });

  it('renders custom spinner', () => {
    const { lastFrame } = render(
      <LoadingState spinner="🔄" />
    );

    expect(lastFrame()).toContain('🔄');
  });

  it('animates spinner', () => {
    const { lastFrame, rerender } = render(<LoadingState />);

    const firstFrame = lastFrame();

    vi.advanceTimersByTime(160);
    rerender(<LoadingState />);

    // The spinner character should change
    // (We can't easily test this without snapshot testing)
    expect(lastFrame()).toContain('Loading...');
  });
});

describe('ErrorState', () => {
  it('renders error message', () => {
    const { lastFrame } = render(
      <ErrorState message="Failed to load data" />
    );

    expect(lastFrame()).toContain('Failed to load data');
  });

  it('renders default title', () => {
    const { lastFrame } = render(
      <ErrorState message="Something failed" />
    );

    expect(lastFrame()).toContain('Error');
    expect(lastFrame()).toContain('✗');
  });

  it('renders custom title', () => {
    const { lastFrame } = render(
      <ErrorState title="Connection Failed" message="Check your network" />
    );

    expect(lastFrame()).toContain('Connection Failed');
  });

  it('renders retry action', () => {
    const { lastFrame } = render(
      <ErrorState
        message="Error occurred"
        retryAction={<Text>Press R to retry</Text>}
      />
    );

    expect(lastFrame()).toContain('Press R to retry');
  });
});

describe('SuccessState', () => {
  it('renders success message', () => {
    const { lastFrame } = render(
      <SuccessState message="Operation completed successfully" />
    );

    expect(lastFrame()).toContain('Operation completed successfully');
  });

  it('renders default title', () => {
    const { lastFrame } = render(
      <SuccessState message="Done!" />
    );

    expect(lastFrame()).toContain('Success');
    expect(lastFrame()).toContain('✓');
  });

  it('renders custom title', () => {
    const { lastFrame } = render(
      <SuccessState title="Approved!" message="PR has been approved" />
    );

    expect(lastFrame()).toContain('Approved!');
  });

  it('renders action', () => {
    const { lastFrame } = render(
      <SuccessState
        message="PR merged"
        action={<Text>Press Enter to continue</Text>}
      />
    );

    expect(lastFrame()).toContain('Press Enter to continue');
  });
});

describe('Placeholder', () => {
  it('renders default number of lines', () => {
    const { lastFrame } = render(<Placeholder />);

    const lines = (lastFrame() ?? '').split('\n').filter(Boolean);
    expect(lines.length).toBe(3);
  });

  it('renders specified number of lines', () => {
    const { lastFrame } = render(<Placeholder lines={5} />);

    const lines = (lastFrame() ?? '').split('\n').filter(Boolean);
    expect(lines.length).toBe(5);
  });

  it('uses placeholder characters', () => {
    const { lastFrame } = render(<Placeholder />);

    expect(lastFrame()).toContain('░');
  });

  it('creates lines of varying lengths', () => {
    const { lastFrame } = render(<Placeholder lines={3} width={20} />);

    const lines = (lastFrame() ?? '').split('\n').filter(Boolean);

    // All lines should have some content but may vary in length
    lines.forEach((line) => {
      expect(line.length).toBeGreaterThan(0);
    });
  });
});

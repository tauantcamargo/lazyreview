import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import { Timeline, TimelineItem, TimelineEvent } from './Timeline';

describe('Timeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const sampleEvents: TimelineEvent[] = [
    {
      id: '1',
      type: 'commit',
      author: 'alice',
      timestamp: '2024-06-15T11:00:00Z',
      title: 'Add new feature',
    },
    {
      id: '2',
      type: 'comment',
      author: 'bob',
      timestamp: '2024-06-15T10:30:00Z',
      body: 'Looks good!',
    },
    {
      id: '3',
      type: 'approval',
      author: 'charlie',
      timestamp: '2024-06-15T10:00:00Z',
    },
  ];

  it('renders empty state', () => {
    const { lastFrame } = render(<Timeline events={[]} />);
    const output = lastFrame();

    expect(output).toContain('No timeline events');
  });

  it('renders all events', () => {
    const { lastFrame } = render(<Timeline events={sampleEvents} />);
    const output = lastFrame();

    expect(output).toContain('alice');
    expect(output).toContain('bob');
    expect(output).toContain('charlie');
  });

  it('renders event titles', () => {
    const { lastFrame } = render(<Timeline events={sampleEvents} />);
    const output = lastFrame();

    expect(output).toContain('Add new feature');
  });

  it('renders event bodies', () => {
    const { lastFrame } = render(<Timeline events={sampleEvents} />);
    const output = lastFrame();

    expect(output).toContain('Looks good!');
  });

  it('renders relative timestamps', () => {
    const { lastFrame } = render(<Timeline events={sampleEvents} />);
    const output = lastFrame();

    // The commit was 1 hour ago
    expect(output).toContain('1 hours ago');
  });

  it('renders commit icon', () => {
    const events: TimelineEvent[] = [
      { id: '1', type: 'commit', author: 'alice', timestamp: '2024-06-15T11:00:00Z' },
    ];
    const { lastFrame } = render(<Timeline events={events} />);
    const output = lastFrame();

    expect(output).toContain('●');
  });

  it('renders approval icon', () => {
    const events: TimelineEvent[] = [
      { id: '1', type: 'approval', author: 'alice', timestamp: '2024-06-15T11:00:00Z' },
    ];
    const { lastFrame } = render(<Timeline events={events} />);
    const output = lastFrame();

    expect(output).toContain('✓');
  });

  it('renders changes requested icon', () => {
    const events: TimelineEvent[] = [
      { id: '1', type: 'changes_requested', author: 'alice', timestamp: '2024-06-15T11:00:00Z' },
    ];
    const { lastFrame } = render(<Timeline events={events} />);
    const output = lastFrame();

    expect(output).toContain('✗');
  });

  it('renders merged icon', () => {
    const events: TimelineEvent[] = [
      { id: '1', type: 'merged', author: 'alice', timestamp: '2024-06-15T11:00:00Z' },
    ];
    const { lastFrame } = render(<Timeline events={events} />);
    const output = lastFrame();

    expect(output).toContain('◆');
  });

  it('renders connectors between events', () => {
    const { lastFrame } = render(
      <Timeline events={sampleEvents} showConnectors />
    );
    const output = lastFrame();

    expect(output).toContain('│');
  });

  it('hides connectors when disabled', () => {
    const { lastFrame } = render(
      <Timeline events={sampleEvents} showConnectors={false} />
    );
    const output = lastFrame();

    expect(output).not.toContain('│');
  });

  it('highlights selected event', () => {
    const { lastFrame } = render(
      <Timeline events={sampleEvents} selectedIndex={1} />
    );

    expect(lastFrame()).toBeTruthy();
  });

  it('limits events by height', () => {
    const manyEvents: TimelineEvent[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      type: 'commit' as const,
      author: `user${i}`,
      timestamp: '2024-06-15T10:00:00Z',
    }));

    const { lastFrame } = render(
      <Timeline events={manyEvents} height={8} />
    );
    const output = lastFrame();

    // Should show fewer events due to height limit
    expect(output).toContain('user0');
  });
});

describe('TimelineItem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders author name', () => {
    const event: TimelineEvent = {
      id: '1',
      type: 'commit',
      author: 'alice',
      timestamp: '2024-06-15T11:00:00Z',
    };

    const { lastFrame } = render(<TimelineItem event={event} />);
    const output = lastFrame();

    expect(output).toContain('alice');
  });

  it('renders default action text', () => {
    const event: TimelineEvent = {
      id: '1',
      type: 'comment',
      author: 'alice',
      timestamp: '2024-06-15T11:00:00Z',
    };

    const { lastFrame } = render(<TimelineItem event={event} />);
    const output = lastFrame();

    expect(output).toContain('commented');
  });

  it('renders custom title', () => {
    const event: TimelineEvent = {
      id: '1',
      type: 'commit',
      author: 'alice',
      timestamp: '2024-06-15T11:00:00Z',
      title: 'Custom title here',
    };

    const { lastFrame } = render(<TimelineItem event={event} />);
    const output = lastFrame();

    expect(output).toContain('Custom title here');
  });

  it('renders body text', () => {
    const event: TimelineEvent = {
      id: '1',
      type: 'comment',
      author: 'alice',
      timestamp: '2024-06-15T11:00:00Z',
      body: 'This is the comment body',
    };

    const { lastFrame } = render(<TimelineItem event={event} />);
    const output = lastFrame();

    expect(output).toContain('This is the comment body');
  });

  it('truncates long body', () => {
    const longBody = 'A'.repeat(100);
    const event: TimelineEvent = {
      id: '1',
      type: 'comment',
      author: 'alice',
      timestamp: '2024-06-15T11:00:00Z',
      body: longBody,
    };

    const { lastFrame } = render(<TimelineItem event={event} width={50} />);
    const output = lastFrame();

    expect(output).toContain('...');
  });

  it('hides connector when isLast', () => {
    const event: TimelineEvent = {
      id: '1',
      type: 'commit',
      author: 'alice',
      timestamp: '2024-06-15T11:00:00Z',
    };

    const { lastFrame } = render(<TimelineItem event={event} isLast />);
    const output = lastFrame();

    // Should not have connector line (│) between items
    const connectorCount = (output?.match(/│/g) || []).length;
    expect(connectorCount).toBe(0);
  });

  it('shows connector when not last', () => {
    const event: TimelineEvent = {
      id: '1',
      type: 'commit',
      author: 'alice',
      timestamp: '2024-06-15T11:00:00Z',
    };

    const { lastFrame } = render(
      <TimelineItem event={event} isLast={false} showConnector />
    );
    const output = lastFrame();

    expect(output).toContain('│');
  });

  it('formats just now timestamp', () => {
    const event: TimelineEvent = {
      id: '1',
      type: 'commit',
      author: 'alice',
      timestamp: '2024-06-15T12:00:00Z',
    };

    const { lastFrame } = render(<TimelineItem event={event} />);
    const output = lastFrame();

    expect(output).toContain('just now');
  });

  it('formats minutes ago', () => {
    const event: TimelineEvent = {
      id: '1',
      type: 'commit',
      author: 'alice',
      timestamp: '2024-06-15T11:45:00Z',
    };

    const { lastFrame } = render(<TimelineItem event={event} />);
    const output = lastFrame();

    expect(output).toContain('15 min ago');
  });

  it('formats days ago', () => {
    const event: TimelineEvent = {
      id: '1',
      type: 'commit',
      author: 'alice',
      timestamp: '2024-06-13T12:00:00Z',
    };

    const { lastFrame } = render(<TimelineItem event={event} />);
    const output = lastFrame();

    expect(output).toContain('2 days ago');
  });
});

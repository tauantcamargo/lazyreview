import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { Dashboard, type DashboardSection } from './Dashboard';

describe('Dashboard', () => {
  const createSection = (overrides: Partial<DashboardSection> = {}): DashboardSection => ({
    id: 'test-section',
    title: 'Test Section',
    items: [],
    ...overrides,
  });

  const createItem = (overrides = {}) => ({
    id: 'item-1',
    repo: 'owner/repo',
    title: 'Test PR Title',
    author: 'testuser',
    status: 'open' as const,
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  it('renders dashboard title', () => {
    const { lastFrame } = render(
      <Dashboard sections={[]} width={80} height={24} />
    );
    expect(lastFrame()).toContain('Dashboard');
  });

  it('renders section titles with item counts', () => {
    const sections: DashboardSection[] = [
      createSection({
        id: 'reviews',
        title: 'Needs Review',
        items: [createItem({ id: '1' }), createItem({ id: '2' })],
      }),
    ];

    const { lastFrame } = render(
      <Dashboard sections={sections} width={80} height={24} />
    );
    expect(lastFrame()).toContain('Needs Review');
    expect(lastFrame()).toContain('(2)');
  });

  it('renders empty message when section has no items', () => {
    const sections: DashboardSection[] = [
      createSection({
        emptyMessage: 'No pending reviews',
        items: [],
      }),
    ];

    const { lastFrame } = render(
      <Dashboard sections={sections} width={80} height={24} />
    );
    expect(lastFrame()).toContain('No pending reviews');
  });

  it('renders default empty message', () => {
    const sections: DashboardSection[] = [
      createSection({ items: [] }),
    ];

    const { lastFrame } = render(
      <Dashboard sections={sections} width={80} height={24} />
    );
    expect(lastFrame()).toContain('No items');
  });

  it('renders items with repo, title, and author', () => {
    const sections: DashboardSection[] = [
      createSection({
        items: [
          createItem({
            repo: 'facebook/react',
            title: 'Add new hook',
            author: 'developer',
          }),
        ],
      }),
    ];

    const { lastFrame } = render(
      <Dashboard sections={sections} width={100} height={24} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('facebook/react');
    expect(frame).toContain('Add new hook');
    expect(frame).toContain('developer');
  });

  it('highlights selected item with arrow indicator', () => {
    const sections: DashboardSection[] = [
      createSection({
        items: [createItem({ id: '1' }), createItem({ id: '2' })],
      }),
    ];

    const { lastFrame } = render(
      <Dashboard
        sections={sections}
        selectedSection={0}
        selectedItem={0}
        width={80}
        height={24}
      />
    );
    expect(lastFrame()).toContain('▸');
  });

  it('shows status indicator for open PRs', () => {
    const sections: DashboardSection[] = [
      createSection({
        items: [createItem({ status: 'open' })],
      }),
    ];

    const { lastFrame } = render(
      <Dashboard sections={sections} width={80} height={24} />
    );
    expect(lastFrame()).toContain('●');
  });

  it('shows status indicator for draft PRs', () => {
    const sections: DashboardSection[] = [
      createSection({
        items: [createItem({ status: 'draft' })],
      }),
    ];

    const { lastFrame } = render(
      <Dashboard sections={sections} width={80} height={24} />
    );
    expect(lastFrame()).toContain('○');
  });

  it('shows status indicator for merged PRs', () => {
    const sections: DashboardSection[] = [
      createSection({
        items: [createItem({ status: 'merged' })],
      }),
    ];

    const { lastFrame } = render(
      <Dashboard sections={sections} width={80} height={24} />
    );
    expect(lastFrame()).toContain('✓');
  });

  it('shows status indicator for closed PRs', () => {
    const sections: DashboardSection[] = [
      createSection({
        items: [createItem({ status: 'closed' })],
      }),
    ];

    const { lastFrame } = render(
      <Dashboard sections={sections} width={80} height={24} />
    );
    expect(lastFrame()).toContain('✗');
  });

  it('shows overflow message when more items exist', () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      createItem({ id: `item-${i}`, title: `PR ${i}` })
    );
    const sections: DashboardSection[] = [
      createSection({ items }),
    ];

    // Use small height to trigger overflow
    const { lastFrame } = render(
      <Dashboard sections={sections} width={80} height={10} />
    );
    expect(lastFrame()).toContain('... and');
    expect(lastFrame()).toContain('more');
  });

  it('renders multiple sections', () => {
    const sections: DashboardSection[] = [
      createSection({ id: '1', title: 'Needs Review', items: [] }),
      createSection({ id: '2', title: 'My PRs', items: [] }),
      createSection({ id: '3', title: 'Assigned', items: [] }),
    ];

    const { lastFrame } = render(
      <Dashboard sections={sections} width={80} height={24} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Needs Review');
    expect(frame).toContain('My PRs');
    expect(frame).toContain('Assigned');
  });

  it('formats relative time correctly', () => {
    const now = new Date();
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const sections: DashboardSection[] = [
      createSection({
        items: [
          createItem({ id: '1', updatedAt: thirtyMinsAgo.toISOString() }),
          createItem({ id: '2', updatedAt: fiveHoursAgo.toISOString() }),
          createItem({ id: '3', updatedAt: threeDaysAgo.toISOString() }),
        ],
      }),
    ];

    const { lastFrame } = render(
      <Dashboard sections={sections} width={100} height={24} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('30m');
    expect(frame).toContain('5h');
    expect(frame).toContain('3d');
  });

  it('applies theme colors', () => {
    const sections: DashboardSection[] = [
      createSection({ items: [createItem()] }),
    ];

    const theme = {
      accent: 'blue',
      muted: 'gray',
      added: 'green',
      removed: 'red',
    };

    const { lastFrame } = render(
      <Dashboard sections={sections} width={80} height={24} theme={theme} />
    );
    // The component should render without errors with custom theme
    expect(lastFrame()).toBeDefined();
  });
});

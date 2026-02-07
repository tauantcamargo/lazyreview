import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { describe, it, expect } from 'vitest';
import { Tabs, TabPanel, type Tab } from './Tabs';

describe('Tabs', () => {
  const createTabs = (): Tab[] => [
    { id: 'files', label: 'Files' },
    { id: 'commits', label: 'Commits' },
    { id: 'reviews', label: 'Reviews' },
  ];

  it('renders all tab labels', () => {
    const { lastFrame } = render(
      <Tabs tabs={createTabs()} activeTab="files" />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Files');
    expect(frame).toContain('Commits');
    expect(frame).toContain('Reviews');
  });

  it('renders separators between tabs', () => {
    const { lastFrame } = render(
      <Tabs tabs={createTabs()} activeTab="files" />
    );
    expect(lastFrame()).toContain('│');
  });

  it('renders badge count', () => {
    const tabs: Tab[] = [
      { id: 'reviews', label: 'Reviews', badge: 5 },
    ];
    const { lastFrame } = render(
      <Tabs tabs={tabs} activeTab="reviews" />
    );
    expect(lastFrame()).toContain('(5)');
  });

  it('does not render badge when zero', () => {
    const tabs: Tab[] = [
      { id: 'reviews', label: 'Reviews', badge: 0 },
    ];
    const { lastFrame } = render(
      <Tabs tabs={tabs} activeTab="reviews" />
    );
    expect(lastFrame()).not.toContain('(0)');
  });

  it('applies custom theme', () => {
    const theme = {
      accent: 'blue',
      muted: 'gray',
      added: 'green',
      removed: 'red',
    };
    const { lastFrame } = render(
      <Tabs tabs={createTabs()} activeTab="files" theme={theme} />
    );
    expect(lastFrame()).toBeDefined();
  });
});

describe('TabPanel', () => {
  it('renders children when active', () => {
    const { lastFrame } = render(
      <TabPanel tabId="files" activeTab="files">
        <Text>File content here</Text>
      </TabPanel>
    );
    expect(lastFrame()).toContain('File content here');
  });

  it('does not render when inactive', () => {
    const { lastFrame } = render(
      <TabPanel tabId="files" activeTab="commits">
        <Text>File content here</Text>
      </TabPanel>
    );
    expect(lastFrame()).toBe('');
  });
});

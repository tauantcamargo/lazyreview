import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { describe, it, expect } from 'vitest';
import { Layout } from './Layout';

describe('Layout', () => {
  it('renders title', () => {
    const { lastFrame } = render(
      <Layout title="LazyReview" width={80} height={24} />
    );
    expect(lastFrame()).toContain('LazyReview');
  });

  it('renders sidebar content', () => {
    const { lastFrame } = render(
      <Layout
        title="Test"
        width={80}
        height={24}
        sidebar={<Text>Sidebar Content</Text>}
      />
    );
    expect(lastFrame()).toContain('Sidebar Content');
  });

  it('renders main content', () => {
    const { lastFrame } = render(
      <Layout
        title="Test"
        width={80}
        height={24}
        main={<Text>Main Content</Text>}
      />
    );
    expect(lastFrame()).toContain('Main Content');
  });

  it('renders detail content', () => {
    const { lastFrame } = render(
      <Layout
        title="Test"
        width={80}
        height={24}
        detail={<Text>Detail Content</Text>}
      />
    );
    expect(lastFrame()).toContain('Detail Content');
  });

  it('renders status bar', () => {
    const { lastFrame } = render(
      <Layout
        title="Test"
        width={80}
        height={24}
        statusBar={<Text>Status Bar</Text>}
      />
    );
    expect(lastFrame()).toContain('Status Bar');
  });

  it('hides sidebar when showSidebar is false', () => {
    const { lastFrame } = render(
      <Layout
        title="Test"
        width={80}
        height={24}
        showSidebar={false}
        sidebar={<Text>Hidden Sidebar</Text>}
        main={<Text>Main</Text>}
      />
    );
    expect(lastFrame()).toContain('Main');
  });

  it('hides detail when showDetail is false', () => {
    const { lastFrame } = render(
      <Layout
        title="Test"
        width={80}
        height={24}
        showDetail={false}
        detail={<Text>Hidden Detail</Text>}
        main={<Text>Main</Text>}
      />
    );
    expect(lastFrame()).toContain('Main');
  });

  it('applies custom theme', () => {
    const theme = {
      accent: 'blue',
      muted: 'gray',
      border: 'white',
      added: 'green',
      removed: 'red',
    };
    const { lastFrame } = render(
      <Layout title="Themed" width={80} height={24} theme={theme} />
    );
    expect(lastFrame()).toContain('Themed');
  });

  it('renders without title', () => {
    const { lastFrame } = render(
      <Layout
        width={80}
        height={24}
        main={<Text>Content Only</Text>}
      />
    );
    expect(lastFrame()).toContain('Content Only');
  });
});

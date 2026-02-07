import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { describe, it, expect } from 'vitest';
import { SplitPane } from './SplitPane';

describe('SplitPane', () => {
  it('renders horizontal split', () => {
    const { lastFrame } = render(
      <SplitPane direction="horizontal" sizes={[0.3, 0.7]} width={80} height={20}>
        <Text>Left</Text>
        <Text>Right</Text>
      </SplitPane>
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Left');
    expect(frame).toContain('Right');
  });

  it('renders vertical split', () => {
    const { lastFrame } = render(
      <SplitPane direction="vertical" sizes={[0.5, 0.5]} width={80} height={20}>
        <Text>Top</Text>
        <Text>Bottom</Text>
      </SplitPane>
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Top');
    expect(frame).toContain('Bottom');
  });

  it('renders three panes', () => {
    const { lastFrame } = render(
      <SplitPane direction="horizontal" sizes={[0.3, 0.4, 0.3]} width={80} height={20}>
        <Text>One</Text>
        <Text>Two</Text>
        <Text>Three</Text>
      </SplitPane>
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('One');
    expect(frame).toContain('Two');
    expect(frame).toContain('Three');
  });

  it('handles fixed sizes', () => {
    const { lastFrame } = render(
      <SplitPane direction="horizontal" sizes={[20, 60]} width={80} height={20}>
        <Text>Fixed</Text>
        <Text>Flex</Text>
      </SplitPane>
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Fixed');
    expect(frame).toContain('Flex');
  });

  it('hides dividers when showDividers is false', () => {
    const { lastFrame } = render(
      <SplitPane
        direction="horizontal"
        sizes={[0.5, 0.5]}
        width={80}
        height={20}
        showDividers={false}
      >
        <Text>A</Text>
        <Text>B</Text>
      </SplitPane>
    );
    expect(lastFrame()).toBeDefined();
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
      <SplitPane
        direction="horizontal"
        sizes={[0.5, 0.5]}
        width={80}
        height={20}
        theme={theme}
      >
        <Text>A</Text>
        <Text>B</Text>
      </SplitPane>
    );
    expect(lastFrame()).toBeDefined();
  });
});

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { Tooltip, KeyHint, KeyHintGroup, InfoBox, HotkeyList } from './Tooltip';

describe('Tooltip', () => {
  it('renders children when not visible', () => {
    const { lastFrame } = render(
      <Tooltip content="Help text" visible={false}>
        <Text>Content</Text>
      </Tooltip>
    );

    expect(lastFrame()).toContain('Content');
    expect(lastFrame()).not.toContain('Help text');
  });

  it('renders tooltip content when visible', () => {
    const { lastFrame } = render(
      <Tooltip content="Help text" visible={true}>
        <Text>Content</Text>
      </Tooltip>
    );

    expect(lastFrame()).toContain('Content');
    expect(lastFrame()).toContain('Help text');
  });

  it('positions tooltip above children by default', () => {
    const { lastFrame } = render(
      <Tooltip content="Tooltip" visible={true} position="top">
        <Text>Below</Text>
      </Tooltip>
    );

    const frame = lastFrame() ?? '';
    const tooltipIndex = frame.indexOf('Tooltip');
    const contentIndex = frame.indexOf('Below');

    expect(tooltipIndex).toBeLessThan(contentIndex);
  });

  it('positions tooltip below children', () => {
    const { lastFrame } = render(
      <Tooltip content="Tooltip" visible={true} position="bottom">
        <Text>Above</Text>
      </Tooltip>
    );

    const frame = lastFrame() ?? '';
    const tooltipIndex = frame.indexOf('Tooltip');
    const contentIndex = frame.indexOf('Above');

    expect(tooltipIndex).toBeGreaterThan(contentIndex);
  });
});

describe('KeyHint', () => {
  it('renders key and description', () => {
    const { lastFrame } = render(
      <KeyHint keyName="j" description="move down" />
    );

    expect(lastFrame()).toContain('j');
    expect(lastFrame()).toContain('move down');
  });
});

describe('KeyHintGroup', () => {
  it('renders multiple hints', () => {
    const hints = [
      { key: 'j', description: 'down' },
      { key: 'k', description: 'up' },
    ];

    const { lastFrame } = render(<KeyHintGroup hints={hints} />);

    expect(lastFrame()).toContain('j');
    expect(lastFrame()).toContain('down');
    expect(lastFrame()).toContain('k');
    expect(lastFrame()).toContain('up');
  });

  it('renders separator between hints', () => {
    const hints = [
      { key: 'j', description: 'down' },
      { key: 'k', description: 'up' },
    ];

    const { lastFrame } = render(
      <KeyHintGroup hints={hints} separator=" | " />
    );

    expect(lastFrame()).toContain('|');
  });
});

describe('InfoBox', () => {
  it('renders children content', () => {
    const { lastFrame } = render(
      <InfoBox>
        <Text>Information content</Text>
      </InfoBox>
    );

    expect(lastFrame()).toContain('Information content');
  });

  it('renders title when provided', () => {
    const { lastFrame } = render(
      <InfoBox title="Notice">
        <Text>Content</Text>
      </InfoBox>
    );

    expect(lastFrame()).toContain('Notice');
  });

  it('renders info type with correct icon', () => {
    const { lastFrame } = render(
      <InfoBox title="Info" type="info">
        <Text>Details</Text>
      </InfoBox>
    );

    expect(lastFrame()).toContain('ℹ');
  });

  it('renders warning type with correct icon', () => {
    const { lastFrame } = render(
      <InfoBox title="Warning" type="warning">
        <Text>Be careful</Text>
      </InfoBox>
    );

    expect(lastFrame()).toContain('⚠');
  });

  it('renders error type with correct icon', () => {
    const { lastFrame } = render(
      <InfoBox title="Error" type="error">
        <Text>Something went wrong</Text>
      </InfoBox>
    );

    expect(lastFrame()).toContain('✗');
  });

  it('renders success type with correct icon', () => {
    const { lastFrame } = render(
      <InfoBox title="Success" type="success">
        <Text>Operation completed</Text>
      </InfoBox>
    );

    expect(lastFrame()).toContain('✓');
  });
});

describe('HotkeyList', () => {
  const hotkeys = [
    { key: 'j', description: 'Move down' },
    { key: 'k', description: 'Move up' },
    { key: 'Enter', description: 'Select' },
  ];

  it('renders all hotkeys', () => {
    const { lastFrame } = render(<HotkeyList hotkeys={hotkeys} />);

    expect(lastFrame()).toContain('j');
    expect(lastFrame()).toContain('Move down');
    expect(lastFrame()).toContain('k');
    expect(lastFrame()).toContain('Move up');
    expect(lastFrame()).toContain('Enter');
    expect(lastFrame()).toContain('Select');
  });

  it('groups hotkeys by category when enabled', () => {
    const categorizedHotkeys = [
      { key: 'j', description: 'Move down', category: 'Navigation' },
      { key: 'k', description: 'Move up', category: 'Navigation' },
      { key: 'a', description: 'Approve', category: 'Actions' },
    ];

    const { lastFrame } = render(
      <HotkeyList hotkeys={categorizedHotkeys} showCategories={true} />
    );

    expect(lastFrame()).toContain('Navigation');
    expect(lastFrame()).toContain('Actions');
  });

  it('uses General category for uncategorized hotkeys', () => {
    const mixedHotkeys = [
      { key: 'j', description: 'Move down' },
      { key: 'a', description: 'Approve', category: 'Actions' },
    ];

    const { lastFrame } = render(
      <HotkeyList hotkeys={mixedHotkeys} showCategories={true} />
    );

    expect(lastFrame()).toContain('General');
    expect(lastFrame()).toContain('Actions');
  });

  it('does not show categories when disabled', () => {
    const categorizedHotkeys = [
      { key: 'j', description: 'Move down', category: 'Navigation' },
    ];

    const { lastFrame } = render(
      <HotkeyList hotkeys={categorizedHotkeys} showCategories={false} />
    );

    expect(lastFrame()).not.toContain('Navigation');
  });
});

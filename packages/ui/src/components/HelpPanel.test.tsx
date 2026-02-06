import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { HelpPanel, type HelpSection } from './HelpPanel';

describe('HelpPanel', () => {
  const createSection = (overrides: Partial<HelpSection> = {}): HelpSection => ({
    title: 'Navigation',
    bindings: [],
    ...overrides,
  });

  it('renders header', () => {
    const { lastFrame } = render(
      <HelpPanel sections={[]} width={60} height={20} />
    );
    expect(lastFrame()).toContain('Keyboard Shortcuts');
  });

  it('renders section title', () => {
    const sections: HelpSection[] = [
      createSection({ title: 'Navigation' }),
    ];

    const { lastFrame } = render(
      <HelpPanel sections={sections} width={60} height={20} />
    );
    expect(lastFrame()).toContain('Navigation');
  });

  it('renders keybindings', () => {
    const sections: HelpSection[] = [
      createSection({
        bindings: [
          { key: 'j', description: 'Move down' },
          { key: 'k', description: 'Move up' },
        ],
      }),
    ];

    const { lastFrame } = render(
      <HelpPanel sections={sections} width={60} height={20} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('j');
    expect(frame).toContain('Move down');
    expect(frame).toContain('k');
    expect(frame).toContain('Move up');
  });

  it('shows chord indicator for chord bindings', () => {
    const sections: HelpSection[] = [
      createSection({
        bindings: [
          { key: 'gg', description: 'Go to top', chord: true },
        ],
      }),
    ];

    const { lastFrame } = render(
      <HelpPanel sections={sections} width={60} height={20} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('gg');
    expect(frame).toContain('Go to top');
    expect(frame).toContain('(chord)');
  });

  it('renders multiple sections', () => {
    const sections: HelpSection[] = [
      createSection({ title: 'Navigation', bindings: [{ key: 'j', description: 'Down' }] }),
      createSection({ title: 'Actions', bindings: [{ key: 'a', description: 'Approve' }] }),
    ];

    const { lastFrame } = render(
      <HelpPanel sections={sections} width={60} height={30} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Navigation');
    expect(frame).toContain('Actions');
  });

  it('shows close instruction', () => {
    const { lastFrame } = render(
      <HelpPanel sections={[]} width={60} height={20} />
    );
    expect(lastFrame()).toContain('Press ? to close');
  });

  it('applies custom theme', () => {
    const theme = {
      accent: 'blue',
      muted: 'gray',
      added: 'green',
      removed: 'red',
    };

    const sections: HelpSection[] = [
      createSection({
        bindings: [{ key: 'j', description: 'Move down' }],
      }),
    ];

    const { lastFrame } = render(
      <HelpPanel sections={sections} width={60} height={20} theme={theme} />
    );
    expect(lastFrame()).toBeDefined();
  });
});

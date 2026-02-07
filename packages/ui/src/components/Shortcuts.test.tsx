import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import {
  Shortcuts,
  KeyLegend,
  ChordIndicator,
  ModeIndicator,
  QuickActions,
  VimKeys,
  CommandHint,
  ShortcutOverlay,
} from './Shortcuts';

describe('Shortcuts', () => {
  const shortcuts = [
    { key: 'j', description: 'Move down', category: 'Navigation' },
    { key: 'k', description: 'Move up', category: 'Navigation' },
    { key: 'enter', description: 'Select', category: 'Actions' },
    { key: 'q', description: 'Quit', category: 'Actions' },
  ];

  it('renders shortcuts', () => {
    const { lastFrame } = render(<Shortcuts shortcuts={shortcuts} />);

    expect(lastFrame()).toContain('j');
    expect(lastFrame()).toContain('Move down');
    expect(lastFrame()).toContain('k');
    expect(lastFrame()).toContain('Move up');
  });

  it('shows categories when enabled', () => {
    const { lastFrame } = render(
      <Shortcuts shortcuts={shortcuts} showCategories={true} />
    );

    expect(lastFrame()).toContain('Navigation');
    expect(lastFrame()).toContain('Actions');
  });

  it('hides categories by default', () => {
    const { lastFrame } = render(
      <Shortcuts shortcuts={shortcuts} showCategories={false} />
    );

    expect(lastFrame()).not.toContain('Navigation');
    expect(lastFrame()).not.toContain('Actions');
  });

  it('renders in compact mode', () => {
    const { lastFrame } = render(
      <Shortcuts shortcuts={shortcuts} compact={true} />
    );

    expect(lastFrame()).toContain('j');
    expect(lastFrame()).toContain('Move down');
  });

  it('handles empty shortcuts', () => {
    const { lastFrame } = render(<Shortcuts shortcuts={[]} />);

    expect(lastFrame()).toBeDefined();
  });
});

describe('KeyLegend', () => {
  const keys = [
    { key: 'j', label: 'down' },
    { key: 'k', label: 'up' },
    { key: 'enter', label: 'select' },
  ];

  it('renders all keys', () => {
    const { lastFrame } = render(<KeyLegend keys={keys} />);

    expect(lastFrame()).toContain('j');
    expect(lastFrame()).toContain('down');
    expect(lastFrame()).toContain('k');
    expect(lastFrame()).toContain('up');
  });

  it('formats enter key', () => {
    const { lastFrame } = render(<KeyLegend keys={keys} />);

    expect(lastFrame()).toContain('⏎');
    expect(lastFrame()).toContain('select');
  });

  it('uses custom separator', () => {
    const { lastFrame } = render(
      <KeyLegend keys={keys} separator=" | " />
    );

    expect(lastFrame()).toContain('|');
  });
});

describe('ChordIndicator', () => {
  it('shows chord input', () => {
    const { lastFrame } = render(<ChordIndicator chord="g" />);

    expect(lastFrame()).toContain('g');
  });

  it('shows pending indicator', () => {
    const { lastFrame } = render(<ChordIndicator chord="g" pending={true} />);

    expect(lastFrame()).toContain('...');
  });

  it('hides pending indicator when not pending', () => {
    const { lastFrame } = render(<ChordIndicator chord="gg" pending={false} />);

    expect(lastFrame()).toContain('gg');
    expect(lastFrame()).not.toContain('...');
  });

  it('handles empty chord', () => {
    const { lastFrame } = render(<ChordIndicator chord="" />);

    expect(lastFrame()).toBeDefined();
  });
});

describe('ModeIndicator', () => {
  it('shows mode in uppercase', () => {
    const { lastFrame } = render(<ModeIndicator mode="normal" />);

    expect(lastFrame()).toContain('NORMAL');
  });

  it('shows insert mode', () => {
    const { lastFrame } = render(<ModeIndicator mode="insert" variant="insert" />);

    expect(lastFrame()).toContain('INSERT');
  });

  it('shows visual mode', () => {
    const { lastFrame } = render(<ModeIndicator mode="visual" variant="visual" />);

    expect(lastFrame()).toContain('VISUAL');
  });

  it('shows command mode', () => {
    const { lastFrame } = render(<ModeIndicator mode="command" variant="command" />);

    expect(lastFrame()).toContain('COMMAND');
  });
});

describe('QuickActions', () => {
  const actions = [
    { key: 'a', label: 'Approve' },
    { key: 'c', label: 'Comment' },
    { key: 'r', label: 'Request changes', disabled: true },
  ];

  it('renders all actions', () => {
    const { lastFrame } = render(<QuickActions actions={actions} />);

    expect(lastFrame()).toContain('[a]');
    expect(lastFrame()).toContain('Approve');
    expect(lastFrame()).toContain('[c]');
    expect(lastFrame()).toContain('Comment');
  });

  it('shows disabled actions', () => {
    const { lastFrame } = render(<QuickActions actions={actions} />);

    expect(lastFrame()).toContain('[r]');
    expect(lastFrame()).toContain('Request changes');
  });
});

describe('VimKeys', () => {
  it('shows hjkl keys by default', () => {
    const { lastFrame } = render(<VimKeys />);

    expect(lastFrame()).toContain('h');
    expect(lastFrame()).toContain('j');
    expect(lastFrame()).toContain('k');
    expect(lastFrame()).toContain('l');
  });

  it('shows arrow keys by default', () => {
    const { lastFrame } = render(<VimKeys />);

    expect(lastFrame()).toContain('↑↓');
    expect(lastFrame()).toContain('navigate');
  });

  it('hides hjkl when disabled', () => {
    const { lastFrame } = render(<VimKeys hjkl={false} arrows={false} />);

    // When hjkl is false and arrows is false, should be empty or minimal
    expect(lastFrame()).not.toMatch(/\bh\b.*←/); // 'h' paired with '←'
  });

  it('hides arrows when disabled', () => {
    const { lastFrame } = render(<VimKeys arrows={false} />);

    expect(lastFrame()).not.toContain('↑↓');
  });
});

describe('CommandHint', () => {
  it('shows command with colon prefix', () => {
    const { lastFrame } = render(<CommandHint command="help" />);

    expect(lastFrame()).toContain(':');
    expect(lastFrame()).toContain('help');
  });

  it('shows description when provided', () => {
    const { lastFrame } = render(
      <CommandHint command="q" description="quit the application" />
    );

    expect(lastFrame()).toContain(':q');
    expect(lastFrame()).toContain('quit the application');
  });
});

describe('ShortcutOverlay', () => {
  const shortcuts = [
    { key: 'j', description: 'Move down', category: 'Navigation' },
    { key: 'k', description: 'Move up', category: 'Navigation' },
  ];

  it('renders when visible', () => {
    const { lastFrame } = render(
      <ShortcutOverlay shortcuts={shortcuts} visible={true} />
    );

    expect(lastFrame()).toContain('Keyboard Shortcuts');
    expect(lastFrame()).toContain('j');
    expect(lastFrame()).toContain('Move down');
  });

  it('returns null when not visible', () => {
    const { lastFrame } = render(
      <ShortcutOverlay shortcuts={shortcuts} visible={false} />
    );

    expect(lastFrame()).toBe('');
  });

  it('shows custom title', () => {
    const { lastFrame } = render(
      <ShortcutOverlay
        shortcuts={shortcuts}
        visible={true}
        title="Custom Title"
      />
    );

    expect(lastFrame()).toContain('Custom Title');
  });

  it('shows close hint', () => {
    const { lastFrame } = render(
      <ShortcutOverlay shortcuts={shortcuts} visible={true} />
    );

    expect(lastFrame()).toContain('Press ? to close');
  });

  it('groups by category', () => {
    const { lastFrame } = render(
      <ShortcutOverlay shortcuts={shortcuts} visible={true} />
    );

    expect(lastFrame()).toContain('Navigation');
  });
});

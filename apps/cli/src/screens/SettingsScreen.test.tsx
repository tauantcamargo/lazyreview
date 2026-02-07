import React from 'react';
import { Text } from 'ink';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { SettingsScreen } from './SettingsScreen.js';

// Mock the store
vi.mock('../stores/app-store.js', () => ({
  useAppStore: vi.fn(() => ({
    setView: vi.fn(),
  })),
}));

// Mock hooks
vi.mock('../hooks/index.js', () => ({
  useConfig: vi.fn(() => ({
    config: {
      version: '0.1',
      defaultProvider: 'github',
      ui: {
        theme: 'auto',
        vimMode: true,
        showIcons: true,
        compactMode: false,
        showLineNumbers: true,
        diffStyle: 'unified',
        syntaxHighlight: true,
      },
      keybindings: {
        navigation: {
          up: 'k',
          down: 'j',
          left: 'h',
          right: 'l',
        },
        actions: {
          select: 'enter',
          back: 'q',
        },
        review: {
          approve: 'a',
          requestChanges: 'x',
          comment: 'c',
        },
      },
      providers: [
        { name: 'github', type: 'github', host: 'github.com', tokenEnv: 'GITHUB_TOKEN', default: true },
      ],
      performance: {
        cacheTtl: 120,
        commentCacheTtl: 20,
        maxConcurrency: 6,
        rateLimitPerSecond: 10,
      },
    },
    setUIConfig: vi.fn(),
    resetToDefaults: vi.fn(),
  })),
}));

// Mock UI components - wrapping in Text to avoid Ink errors
vi.mock('@lazyreview/ui', () => ({
  Toggle: ({ enabled }: any) => React.createElement(Text, null, enabled ? '[ON]' : '[OFF]'),
  Select: ({ value }: any) => React.createElement(Text, null, value),
  RadioGroup: ({ value }: any) => React.createElement(Text, null, value),
  Section: ({ title, children }: any) => React.createElement(Text, null, `${title}: ${children}`),
  Panel: ({ children }: any) => React.createElement(Text, null, children),
  KeyHint: ({ keys }: any) => React.createElement(Text, null, keys.join('+')),
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders settings title', () => {
    const { lastFrame } = render(<SettingsScreen />);
    expect(lastFrame()).toContain('Settings');
  });

  it('shows section tabs', () => {
    const { lastFrame } = render(<SettingsScreen />);
    expect(lastFrame()).toContain('UI Settings');
    expect(lastFrame()).toContain('Keybindings');
    expect(lastFrame()).toContain('Providers');
    expect(lastFrame()).toContain('Performance');
  });

  it('shows UI settings by default', () => {
    const { lastFrame } = render(<SettingsScreen />);
    expect(lastFrame()).toContain('Theme');
    expect(lastFrame()).toContain('Vim Mode');
    expect(lastFrame()).toContain('Show Icons');
  });

  it('shows toggle states for boolean settings', () => {
    const { lastFrame } = render(<SettingsScreen />);
    expect(lastFrame()).toContain('[ON]');
  });

  it('shows theme option value', () => {
    const { lastFrame } = render(<SettingsScreen />);
    expect(lastFrame()).toContain('Auto');
  });

  it('shows diff style setting', () => {
    const { lastFrame } = render(<SettingsScreen />);
    expect(lastFrame()).toContain('Diff Style');
  });

  it('shows syntax highlighting setting', () => {
    const { lastFrame } = render(<SettingsScreen />);
    expect(lastFrame()).toContain('Syntax Highlighting');
  });

  it('shows keyboard shortcuts help', () => {
    const { lastFrame } = render(<SettingsScreen />);
    expect(lastFrame()).toContain('j/k:navigate');
    expect(lastFrame()).toContain('R:reset');
    expect(lastFrame()).toContain('q:back');
  });

  it('shows Tab instruction for section switching', () => {
    const { lastFrame } = render(<SettingsScreen />);
    expect(lastFrame()).toContain('Tab to switch sections');
  });
});

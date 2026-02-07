import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useConfig,
  defaultConfig,
  parseKeybinding,
  formatKeybinding,
  validateConfig,
  getConfigPath,
} from './use-config';

describe('useConfig', () => {
  it('initializes with default config', () => {
    const { result } = renderHook(() => useConfig());

    expect(result.current.config.version).toBe('0.1');
    expect(result.current.config.ui.vimMode).toBe(true);
    expect(result.current.isVimMode).toBe(true);
  });

  it('initializes with custom config', () => {
    const { result } = renderHook(() =>
      useConfig({
        initialConfig: {
          defaultProvider: 'gitlab',
          ui: { theme: 'dark' },
        },
      })
    );

    expect(result.current.config.defaultProvider).toBe('gitlab');
    expect(result.current.config.ui.theme).toBe('dark');
    expect(result.current.theme).toBe('dark');
  });

  it('sets config', () => {
    const { result } = renderHook(() => useConfig());

    act(() => {
      result.current.setConfig({ defaultProvider: 'bitbucket' });
    });

    expect(result.current.config.defaultProvider).toBe('bitbucket');
  });

  it('sets UI config', () => {
    const { result } = renderHook(() => useConfig());

    act(() => {
      result.current.setUIConfig({ theme: 'light', compactMode: true });
    });

    expect(result.current.config.ui.theme).toBe('light');
    expect(result.current.config.ui.compactMode).toBe(true);
  });

  it('sets keybindings', () => {
    const { result } = renderHook(() => useConfig());

    act(() => {
      result.current.setKeybindings({
        navigation: { up: 'w', down: 's' },
      });
    });

    expect(result.current.config.keybindings.navigation.up).toBe('w');
    expect(result.current.config.keybindings.navigation.down).toBe('s');
  });

  it('adds provider', () => {
    const { result } = renderHook(() => useConfig());

    act(() => {
      result.current.addProvider({
        name: 'work-github',
        type: 'github',
        host: 'github.com',
        tokenEnv: 'WORK_GITHUB_TOKEN',
        default: true,
      });
    });

    expect(result.current.config.providers.length).toBe(1);
    expect(result.current.config.providers[0]?.name).toBe('work-github');
    expect(result.current.config.defaultProvider).toBe('work-github');
  });

  it('removes provider', () => {
    const { result } = renderHook(() =>
      useConfig({
        initialConfig: {
          providers: [
            { name: 'github', type: 'github', host: 'github.com', tokenEnv: 'TOKEN', default: true },
          ],
        },
      })
    );

    act(() => {
      result.current.removeProvider('github');
    });

    expect(result.current.config.providers.length).toBe(0);
  });

  it('sets default provider', () => {
    const { result } = renderHook(() =>
      useConfig({
        initialConfig: {
          defaultProvider: 'github',
          providers: [
            { name: 'github', type: 'github', host: 'github.com', tokenEnv: 'TOKEN', default: true },
            { name: 'gitlab', type: 'gitlab', host: 'gitlab.com', tokenEnv: 'TOKEN', default: false },
          ],
        },
      })
    );

    act(() => {
      result.current.setDefaultProvider('gitlab');
    });

    expect(result.current.config.defaultProvider).toBe('gitlab');
    expect(result.current.config.providers.find(p => p.name === 'gitlab')?.default).toBe(true);
    expect(result.current.config.providers.find(p => p.name === 'github')?.default).toBe(false);
  });

  it('resets to defaults', () => {
    const { result } = renderHook(() => useConfig());

    act(() => {
      result.current.setUIConfig({ theme: 'light' });
    });

    act(() => {
      result.current.resetToDefaults();
    });

    expect(result.current.config.ui.theme).toBe('auto');
  });

  it('gets keybinding', () => {
    const { result } = renderHook(() => useConfig());

    const binding = result.current.getKeybinding('navigation', 'up');
    expect(binding).toBe('k');

    const actionBinding = result.current.getKeybinding('actions', 'select');
    expect(actionBinding).toBe('enter');
  });

  it('returns current provider', () => {
    const { result } = renderHook(() =>
      useConfig({
        initialConfig: {
          defaultProvider: 'github',
          providers: [
            { name: 'github', type: 'github', host: 'github.com', tokenEnv: 'TOKEN', default: true },
          ],
        },
      })
    );

    expect(result.current.currentProvider?.name).toBe('github');
    expect(result.current.currentProvider?.type).toBe('github');
  });

  it('returns undefined for missing current provider', () => {
    const { result } = renderHook(() => useConfig());

    expect(result.current.currentProvider).toBeUndefined();
  });
});

describe('parseKeybinding', () => {
  it('parses simple key', () => {
    const result = parseKeybinding('k');

    expect(result.key).toBe('k');
    expect(result.ctrl).toBe(false);
    expect(result.alt).toBe(false);
    expect(result.shift).toBe(false);
  });

  it('parses ctrl modifier', () => {
    const result = parseKeybinding('ctrl+c');

    expect(result.key).toBe('c');
    expect(result.ctrl).toBe(true);
    expect(result.alt).toBe(false);
  });

  it('parses alt modifier', () => {
    const result = parseKeybinding('alt+x');

    expect(result.key).toBe('x');
    expect(result.alt).toBe(true);
    expect(result.ctrl).toBe(false);
  });

  it('parses shift modifier', () => {
    const result = parseKeybinding('shift+g');

    expect(result.key).toBe('g');
    expect(result.shift).toBe(true);
  });

  it('parses multiple modifiers', () => {
    const result = parseKeybinding('ctrl+shift+p');

    expect(result.key).toBe('p');
    expect(result.ctrl).toBe(true);
    expect(result.shift).toBe(true);
  });

  it('handles uppercase', () => {
    const result = parseKeybinding('Ctrl+C');

    expect(result.key).toBe('c');
    expect(result.ctrl).toBe(true);
  });
});

describe('formatKeybinding', () => {
  it('formats ctrl modifier', () => {
    expect(formatKeybinding('ctrl+c')).toBe('C-c');
  });

  it('formats alt modifier', () => {
    expect(formatKeybinding('alt+x')).toBe('M-x');
  });

  it('formats shift modifier', () => {
    expect(formatKeybinding('shift+g')).toBe('S-g');
  });

  it('formats enter key', () => {
    expect(formatKeybinding('enter')).toBe('⏎');
  });

  it('formats escape key', () => {
    expect(formatKeybinding('escape')).toBe('Esc');
  });

  it('formats space key', () => {
    expect(formatKeybinding('space')).toBe('␣');
  });

  it('formats tab key', () => {
    expect(formatKeybinding('tab')).toBe('⇥');
  });

  it('formats backspace key', () => {
    expect(formatKeybinding('backspace')).toBe('⌫');
  });

  it('keeps simple keys unchanged', () => {
    expect(formatKeybinding('k')).toBe('k');
    expect(formatKeybinding('j')).toBe('j');
  });
});

describe('validateConfig', () => {
  it('validates correct config', () => {
    expect(validateConfig(defaultConfig)).toBe(true);
  });

  it('rejects null', () => {
    expect(validateConfig(null)).toBe(false);
  });

  it('rejects non-object', () => {
    expect(validateConfig('string')).toBe(false);
    expect(validateConfig(123)).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(validateConfig({})).toBe(false);
    expect(validateConfig({ version: '0.1' })).toBe(false);
  });

  it('rejects wrong types', () => {
    expect(validateConfig({
      version: 123,
      defaultProvider: 'github',
      ui: {},
      keybindings: {},
      providers: [],
    })).toBe(false);
  });
});

describe('getConfigPath', () => {
  it('returns config path', () => {
    const path = getConfigPath();

    expect(path).toContain('.config/lazyreview/config.yaml');
  });
});

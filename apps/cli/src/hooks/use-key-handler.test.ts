import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useKeyHandler,
  formatKeyBinding,
  parseKeyString,
  KeyInfo,
} from './use-key-handler';

describe('useKeyHandler', () => {
  const createKeyInfo = (overrides: Partial<KeyInfo> = {}): KeyInfo => ({
    ctrl: false,
    meta: false,
    shift: false,
    alt: false,
    escape: false,
    return: false,
    tab: false,
    backspace: false,
    delete: false,
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageUp: false,
    pageDown: false,
    ...overrides,
  });

  it('handles simple key press', () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useKeyHandler({
        bindings: [{ key: 'q', action }],
      })
    );

    const handled = result.current.handleKey('q', createKeyInfo());

    expect(handled).toBe(true);
    expect(action).toHaveBeenCalled();
  });

  it('returns false for unhandled key', () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useKeyHandler({
        bindings: [{ key: 'q', action }],
      })
    );

    const handled = result.current.handleKey('x', createKeyInfo());

    expect(handled).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('handles key with modifiers', () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useKeyHandler({
        bindings: [
          { key: 's', modifiers: { ctrl: true }, action },
        ],
      })
    );

    // Without ctrl - should not trigger
    result.current.handleKey('s', createKeyInfo());
    expect(action).not.toHaveBeenCalled();

    // With ctrl - should trigger
    result.current.handleKey('s', createKeyInfo({ ctrl: true }));
    expect(action).toHaveBeenCalled();
  });

  it('handles escape key', () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useKeyHandler({
        bindings: [{ key: 'escape', action }],
      })
    );

    result.current.handleKey('', createKeyInfo({ escape: true }));
    expect(action).toHaveBeenCalled();
  });

  it('handles enter key', () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useKeyHandler({
        bindings: [{ key: 'enter', action }],
      })
    );

    result.current.handleKey('', createKeyInfo({ return: true }));
    expect(action).toHaveBeenCalled();
  });

  it('handles arrow keys', () => {
    const upAction = vi.fn();
    const downAction = vi.fn();
    const { result } = renderHook(() =>
      useKeyHandler({
        bindings: [
          { key: 'up', action: upAction },
          { key: 'down', action: downAction },
        ],
      })
    );

    result.current.handleKey('', createKeyInfo({ upArrow: true }));
    expect(upAction).toHaveBeenCalled();

    result.current.handleKey('', createKeyInfo({ downArrow: true }));
    expect(downAction).toHaveBeenCalled();
  });

  it('respects conditional bindings', () => {
    let isEnabled = false;
    const action = vi.fn();
    const { result } = renderHook(() =>
      useKeyHandler({
        bindings: [{ key: 'q', action, when: () => isEnabled }],
      })
    );

    result.current.handleKey('q', createKeyInfo());
    expect(action).not.toHaveBeenCalled();

    isEnabled = true;
    result.current.handleKey('q', createKeyInfo());
    expect(action).toHaveBeenCalled();
  });

  it('does not handle keys when disabled', () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useKeyHandler({
        bindings: [{ key: 'q', action }],
        enabled: false,
      })
    );

    result.current.handleKey('q', createKeyInfo());
    expect(action).not.toHaveBeenCalled();
  });

  it('handles multiple bindings', () => {
    const action1 = vi.fn();
    const action2 = vi.fn();
    const { result } = renderHook(() =>
      useKeyHandler({
        bindings: [
          { key: 'a', action: action1 },
          { key: 'b', action: action2 },
        ],
      })
    );

    result.current.handleKey('a', createKeyInfo());
    expect(action1).toHaveBeenCalled();
    expect(action2).not.toHaveBeenCalled();

    result.current.handleKey('b', createKeyInfo());
    expect(action2).toHaveBeenCalled();
  });

  it('stops at first matching binding', () => {
    const action1 = vi.fn();
    const action2 = vi.fn();
    const { result } = renderHook(() =>
      useKeyHandler({
        bindings: [
          { key: 'q', action: action1 },
          { key: 'q', action: action2 },
        ],
      })
    );

    result.current.handleKey('q', createKeyInfo());
    expect(action1).toHaveBeenCalled();
    expect(action2).not.toHaveBeenCalled();
  });

  it('returns active bindings', () => {
    let showMore = false;
    const { result } = renderHook(() =>
      useKeyHandler({
        bindings: [
          { key: 'q', action: () => {}, description: 'Quit' },
          { key: 'm', action: () => {}, description: 'More', when: () => showMore },
        ],
      })
    );

    expect(result.current.getBindings()).toHaveLength(1);
    expect(result.current.getBindings()[0]?.description).toBe('Quit');

    showMore = true;
    expect(result.current.getBindings()).toHaveLength(2);
  });

  it('matches case insensitively', () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useKeyHandler({
        bindings: [{ key: 'Q', action }],
      })
    );

    result.current.handleKey('q', createKeyInfo());
    expect(action).toHaveBeenCalled();
  });
});

describe('formatKeyBinding', () => {
  it('formats simple key', () => {
    expect(formatKeyBinding('q')).toBe('Q');
  });

  it('formats key with ctrl modifier', () => {
    expect(formatKeyBinding('s', { ctrl: true })).toBe('Ctrl+S');
  });

  it('formats key with multiple modifiers', () => {
    expect(formatKeyBinding('s', { ctrl: true, shift: true })).toBe('Ctrl+Shift+S');
  });

  it('formats special keys', () => {
    expect(formatKeyBinding('escape')).toBe('Esc');
    expect(formatKeyBinding('enter')).toBe('Enter');
    expect(formatKeyBinding('up')).toBe('↑');
    expect(formatKeyBinding('down')).toBe('↓');
    expect(formatKeyBinding('left')).toBe('←');
    expect(formatKeyBinding('right')).toBe('→');
    expect(formatKeyBinding('pageUp')).toBe('PgUp');
    expect(formatKeyBinding('pageDown')).toBe('PgDn');
  });

  it('formats meta key as command symbol', () => {
    expect(formatKeyBinding('c', { meta: true })).toBe('⌘+C');
  });
});

describe('parseKeyString', () => {
  it('parses simple key', () => {
    const result = parseKeyString('q');
    expect(result.key).toBe('q');
    expect(result.modifiers).toBeUndefined();
  });

  it('parses key with ctrl modifier', () => {
    const result = parseKeyString('ctrl+s');
    expect(result.key).toBe('s');
    expect(result.modifiers?.ctrl).toBe(true);
  });

  it('parses key with multiple modifiers', () => {
    const result = parseKeyString('ctrl+shift+s');
    expect(result.key).toBe('s');
    expect(result.modifiers?.ctrl).toBe(true);
    expect(result.modifiers?.shift).toBe(true);
  });

  it('handles different modifier names', () => {
    expect(parseKeyString('control+a').modifiers?.ctrl).toBe(true);
    expect(parseKeyString('alt+a').modifiers?.alt).toBe(true);
    expect(parseKeyString('option+a').modifiers?.alt).toBe(true);
    expect(parseKeyString('meta+a').modifiers?.meta).toBe(true);
    expect(parseKeyString('cmd+a').modifiers?.meta).toBe(true);
    expect(parseKeyString('command+a').modifiers?.meta).toBe(true);
  });

  it('is case insensitive', () => {
    const result = parseKeyString('CTRL+S');
    expect(result.key).toBe('s');
    expect(result.modifiers?.ctrl).toBe(true);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboard, createVimBindings } from './use-keyboard';
import type { Key } from 'ink';

const createKey = (overrides: Partial<Key> = {}): Key => ({
  upArrow: false,
  downArrow: false,
  leftArrow: false,
  rightArrow: false,
  pageDown: false,
  pageUp: false,
  return: false,
  escape: false,
  ctrl: false,
  shift: false,
  tab: false,
  backspace: false,
  delete: false,
  meta: false,
  ...overrides,
});

describe('useKeyboard', () => {
  it('handles simple key binding', () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useKeyboard({ bindings: { q: action } })
    );

    act(() => {
      result.current.handleInput('q', createKey());
    });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('handles arrow keys', () => {
    const upAction = vi.fn();
    const downAction = vi.fn();
    const { result } = renderHook(() =>
      useKeyboard({ bindings: { up: upAction, down: downAction } })
    );

    act(() => {
      result.current.handleInput('', createKey({ upArrow: true }));
    });
    expect(upAction).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleInput('', createKey({ downArrow: true }));
    });
    expect(downAction).toHaveBeenCalledTimes(1);
  });

  it('handles ctrl combinations', () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useKeyboard({ bindings: { 'ctrl+c': action } })
    );

    act(() => {
      result.current.handleInput('c', createKey({ ctrl: true }));
    });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('handles enter key', () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useKeyboard({ bindings: { enter: action } })
    );

    act(() => {
      result.current.handleInput('', createKey({ return: true }));
    });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('handles escape key', () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useKeyboard({ bindings: { escape: action } })
    );

    act(() => {
      result.current.handleInput('', createKey({ escape: true }));
    });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('returns true for handled key', () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useKeyboard({ bindings: { q: action } })
    );

    let handled = false;
    act(() => {
      handled = result.current.handleInput('q', createKey());
    });

    expect(handled).toBe(true);
  });

  it('returns false for unhandled key', () => {
    const { result } = renderHook(() =>
      useKeyboard({ bindings: { q: vi.fn() } })
    );

    let handled = true;
    act(() => {
      handled = result.current.handleInput('x', createKey());
    });

    expect(handled).toBe(false);
  });

  it('calls onUnhandled for unhandled keys', () => {
    const onUnhandled = vi.fn();
    const { result } = renderHook(() =>
      useKeyboard({ bindings: {}, onUnhandled })
    );

    act(() => {
      result.current.handleInput('x', createKey());
    });

    expect(onUnhandled).toHaveBeenCalledWith('x', expect.any(Object));
  });
});

describe('createVimBindings', () => {
  it('creates up/down bindings', () => {
    const moveUp = vi.fn();
    const moveDown = vi.fn();
    const bindings = createVimBindings({ moveUp, moveDown });

    expect(bindings['k']).toBe(moveUp);
    expect(bindings['up']).toBe(moveUp);
    expect(bindings['j']).toBe(moveDown);
    expect(bindings['down']).toBe(moveDown);
  });

  it('creates left/right bindings', () => {
    const moveLeft = vi.fn();
    const moveRight = vi.fn();
    const bindings = createVimBindings({ moveLeft, moveRight });

    expect(bindings['h']).toBe(moveLeft);
    expect(bindings['left']).toBe(moveLeft);
    expect(bindings['l']).toBe(moveRight);
    expect(bindings['right']).toBe(moveRight);
  });

  it('creates page navigation bindings', () => {
    const pageUp = vi.fn();
    const pageDown = vi.fn();
    const bindings = createVimBindings({ pageUp, pageDown });

    expect(bindings['ctrl+u']).toBe(pageUp);
    expect(bindings['pageup']).toBe(pageUp);
    expect(bindings['ctrl+d']).toBe(pageDown);
    expect(bindings['pagedown']).toBe(pageDown);
  });

  it('creates go to top/bottom bindings', () => {
    const goToTop = vi.fn();
    const goToBottom = vi.fn();
    const bindings = createVimBindings({ goToTop, goToBottom });

    expect(bindings['home']).toBe(goToTop);
    expect(bindings['G']).toBe(goToBottom);
    expect(bindings['end']).toBe(goToBottom);
  });

  it('creates select and back bindings', () => {
    const select = vi.fn();
    const back = vi.fn();
    const bindings = createVimBindings({ select, back });

    expect(bindings['enter']).toBe(select);
    expect(bindings['escape']).toBe(back);
  });

  it('creates help binding', () => {
    const help = vi.fn();
    const bindings = createVimBindings({ help });

    expect(bindings['?']).toBe(help);
  });

  it('creates quit binding', () => {
    const quit = vi.fn();
    const bindings = createVimBindings({ quit });

    expect(bindings['q']).toBe(quit);
  });

  it('omits undefined actions', () => {
    const moveUp = vi.fn();
    const bindings = createVimBindings({ moveUp });

    expect(bindings['j']).toBeUndefined();
    expect(bindings['down']).toBeUndefined();
  });
});

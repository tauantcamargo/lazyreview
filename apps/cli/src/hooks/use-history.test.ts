import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistory, useUndoable, useCommandHistory } from './use-history';

describe('useHistory', () => {
  it('initializes with initial value', () => {
    const { result } = renderHook(() =>
      useHistory({ initialValue: 'initial' })
    );

    expect(result.current.value).toBe('initial');
    expect(result.current.history).toEqual(['initial']);
    expect(result.current.historyIndex).toBe(0);
  });

  it('sets new value', () => {
    const { result } = renderHook(() => useHistory({ initialValue: 0 }));

    act(() => {
      result.current.set(1);
    });

    expect(result.current.value).toBe(1);
    expect(result.current.history).toEqual([0, 1]);
  });

  it('undoes last change', () => {
    const { result } = renderHook(() => useHistory({ initialValue: 0 }));

    act(() => {
      result.current.set(1);
    });

    act(() => {
      result.current.set(2);
    });

    expect(result.current.value).toBe(2);

    act(() => {
      result.current.undo();
    });

    expect(result.current.value).toBe(1);
  });

  it('redoes undone change', () => {
    const { result } = renderHook(() => useHistory({ initialValue: 0 }));

    act(() => {
      result.current.set(1);
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.value).toBe(0);

    act(() => {
      result.current.redo();
    });

    expect(result.current.value).toBe(1);
  });

  it('reports canUndo correctly', () => {
    const { result } = renderHook(() => useHistory({ initialValue: 0 }));

    expect(result.current.canUndo).toBe(false);

    act(() => {
      result.current.set(1);
    });

    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });

    expect(result.current.canUndo).toBe(false);
  });

  it('reports canRedo correctly', () => {
    const { result } = renderHook(() => useHistory({ initialValue: 0 }));

    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.set(1);
    });

    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);
  });

  it('clears redo history on new set', () => {
    const { result } = renderHook(() => useHistory({ initialValue: 0 }));

    act(() => {
      result.current.set(1);
    });

    act(() => {
      result.current.set(2);
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.set(3);
    });

    expect(result.current.canRedo).toBe(false);
    expect(result.current.value).toBe(3);
  });

  it('resets to initial value', () => {
    const { result } = renderHook(() => useHistory({ initialValue: 0 }));

    act(() => {
      result.current.set(1);
    });

    act(() => {
      result.current.set(2);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.value).toBe(0);
    expect(result.current.history).toEqual([0]);
    expect(result.current.canUndo).toBe(false);
  });

  it('resets to custom value', () => {
    const { result } = renderHook(() => useHistory({ initialValue: 0 }));

    act(() => {
      result.current.set(1);
      result.current.reset(10);
    });

    expect(result.current.value).toBe(10);
    expect(result.current.history).toEqual([10]);
  });

  it('clears history but keeps current value', () => {
    const { result } = renderHook(() => useHistory({ initialValue: 0 }));

    act(() => {
      result.current.set(1);
    });

    act(() => {
      result.current.set(2);
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.value).toBe(2);
    expect(result.current.history).toEqual([2]);
    expect(result.current.canUndo).toBe(false);
  });

  it('limits history to maxHistory', () => {
    const { result } = renderHook(() =>
      useHistory({ initialValue: 0, maxHistory: 3 })
    );

    act(() => {
      result.current.set(1);
      result.current.set(2);
      result.current.set(3);
      result.current.set(4);
    });

    expect(result.current.history.length).toBeLessThanOrEqual(3);
  });
});

describe('useUndoable', () => {
  it('initializes with initial value', () => {
    const { result } = renderHook(() =>
      useUndoable({ initialValue: 'initial' })
    );

    expect(result.current.value).toBe('initial');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('sets new value', () => {
    const { result } = renderHook(() => useUndoable({ initialValue: 0 }));

    act(() => {
      result.current.setValue(1);
    });

    expect(result.current.value).toBe(1);
    expect(result.current.canUndo).toBe(true);
  });

  it('supports updater function', () => {
    const { result } = renderHook(() => useUndoable({ initialValue: 0 }));

    act(() => {
      result.current.setValue((prev) => prev + 5);
    });

    expect(result.current.value).toBe(5);
  });

  it('undoes change', () => {
    const { result } = renderHook(() => useUndoable({ initialValue: 0 }));

    act(() => {
      result.current.setValue(1);
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.value).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redoes change', () => {
    const { result } = renderHook(() => useUndoable({ initialValue: 0 }));

    act(() => {
      result.current.setValue(1);
    });

    act(() => {
      result.current.undo();
    });

    act(() => {
      result.current.redo();
    });

    expect(result.current.value).toBe(1);
  });

  it('calls onUndo callback', () => {
    const onUndo = vi.fn();
    const { result } = renderHook(() =>
      useUndoable({ initialValue: 0, onUndo })
    );

    act(() => {
      result.current.setValue(1);
    });

    act(() => {
      result.current.undo();
    });

    expect(onUndo).toHaveBeenCalledWith(0);
  });

  it('calls onRedo callback', () => {
    const onRedo = vi.fn();
    const { result } = renderHook(() =>
      useUndoable({ initialValue: 0, onRedo })
    );

    act(() => {
      result.current.setValue(1);
    });

    act(() => {
      result.current.undo();
    });

    act(() => {
      result.current.redo();
    });

    expect(onRedo).toHaveBeenCalledWith(1);
  });

  it('tracks undo/redo counts', () => {
    const { result } = renderHook(() => useUndoable({ initialValue: 0 }));

    act(() => {
      result.current.setValue(1);
      result.current.setValue(2);
      result.current.setValue(3);
    });

    expect(result.current.undoCount).toBe(3);
    expect(result.current.redoCount).toBe(0);

    act(() => {
      result.current.undo();
    });

    expect(result.current.undoCount).toBe(2);
    expect(result.current.redoCount).toBe(1);
  });

  it('clears redo on new value', () => {
    const { result } = renderHook(() => useUndoable({ initialValue: 0 }));

    act(() => {
      result.current.setValue(1);
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.setValue(2);
    });

    expect(result.current.canRedo).toBe(false);
  });
});

describe('useCommandHistory', () => {
  it('initializes empty', () => {
    const { result } = renderHook(() => useCommandHistory());

    expect(result.current.history).toEqual([]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('executes command', () => {
    const execute = vi.fn();
    const undo = vi.fn();
    const { result } = renderHook(() => useCommandHistory());

    act(() => {
      result.current.execute({ execute, undo });
    });

    expect(execute).toHaveBeenCalled();
    expect(result.current.history).toHaveLength(1);
  });

  it('undoes command', () => {
    const execute = vi.fn();
    const undo = vi.fn();
    const { result } = renderHook(() => useCommandHistory());

    act(() => {
      result.current.execute({ execute, undo });
    });

    act(() => {
      result.current.undo();
    });

    expect(undo).toHaveBeenCalled();
    expect(result.current.history).toHaveLength(0);
    expect(result.current.redoStack).toHaveLength(1);
  });

  it('redoes command', () => {
    const execute = vi.fn();
    const undo = vi.fn();
    const { result } = renderHook(() => useCommandHistory());

    act(() => {
      result.current.execute({ execute, undo });
    });

    act(() => {
      result.current.undo();
    });

    act(() => {
      result.current.redo();
    });

    expect(execute).toHaveBeenCalledTimes(2);
    expect(result.current.history).toHaveLength(1);
    expect(result.current.redoStack).toHaveLength(0);
  });

  it('clears all history', () => {
    const execute = vi.fn();
    const undo = vi.fn();
    const { result } = renderHook(() => useCommandHistory());

    act(() => {
      result.current.execute({ execute, undo });
      result.current.execute({ execute, undo });
      result.current.undo();
      result.current.clear();
    });

    expect(result.current.history).toHaveLength(0);
    expect(result.current.redoStack).toHaveLength(0);
  });

  it('clears redo on new execute', () => {
    const execute = vi.fn();
    const undo = vi.fn();
    const { result } = renderHook(() => useCommandHistory());

    act(() => {
      result.current.execute({ execute, undo });
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.execute({ execute, undo });
    });

    expect(result.current.canRedo).toBe(false);
  });
});

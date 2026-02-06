import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChord, ChordDefinition } from './useChord';

describe('useChord', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createChords = (): ChordDefinition[] => [
    { keys: 'gg', action: vi.fn(), description: 'Go to top' },
    { keys: 'gc', action: vi.fn(), description: 'General comment' },
    { keys: 'gr', action: vi.fn(), description: 'Refresh' },
    { keys: 'gd', action: vi.fn(), description: 'Go to diff' },
  ];

  it('should return initial state', () => {
    const chords = createChords();
    const { result } = renderHook(() => useChord({ chords }));

    expect(result.current.state.buffer).toBe('');
    expect(result.current.state.isActive).toBe(false);
    expect(result.current.state.pendingChords).toEqual([]);
  });

  it('should match a complete chord', () => {
    const chords = createChords();
    const { result } = renderHook(() => useChord({ chords }));

    act(() => {
      result.current.handleInput('g');
    });

    expect(result.current.state.buffer).toBe('g');
    expect(result.current.state.isActive).toBe(true);
    expect(result.current.state.pendingChords).toContain('gg');
    expect(result.current.state.pendingChords).toContain('gc');
    expect(result.current.state.pendingChords).toContain('gr');
    expect(result.current.state.pendingChords).toContain('gd');

    act(() => {
      result.current.handleInput('g');
    });

    expect(result.current.state.buffer).toBe('');
    expect(result.current.state.isActive).toBe(false);
    expect(chords[0]?.action).toHaveBeenCalled();
  });

  it('should match gc chord', () => {
    const chords = createChords();
    const { result } = renderHook(() => useChord({ chords }));

    act(() => {
      result.current.handleInput('g');
    });
    act(() => {
      result.current.handleInput('c');
    });

    expect(chords[1]?.action).toHaveBeenCalled();
  });

  it('should timeout and cancel chord', () => {
    const onChordCancel = vi.fn();
    const chords = createChords();
    const { result } = renderHook(() =>
      useChord({ chords, timeout: 500, onChordCancel })
    );

    act(() => {
      result.current.handleInput('g');
    });

    expect(result.current.state.isActive).toBe(true);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.state.isActive).toBe(false);
    expect(result.current.state.buffer).toBe('');
    expect(onChordCancel).toHaveBeenCalled();
  });

  it('should call onChordStart when chord begins', () => {
    const onChordStart = vi.fn();
    const chords = createChords();
    const { result } = renderHook(() =>
      useChord({ chords, onChordStart })
    );

    act(() => {
      result.current.handleInput('g');
    });

    expect(onChordStart).toHaveBeenCalledWith('g', expect.arrayContaining(['gg', 'gc', 'gr', 'gd']));
  });

  it('should call onChordComplete when chord matches', () => {
    const onChordComplete = vi.fn();
    const chords = createChords();
    const { result } = renderHook(() =>
      useChord({ chords, onChordComplete })
    );

    act(() => {
      result.current.handleInput('g');
    });
    act(() => {
      result.current.handleInput('r');
    });

    expect(onChordComplete).toHaveBeenCalledWith('gr');
  });

  it('should return true when input is part of chord', () => {
    const chords = createChords();
    const { result } = renderHook(() => useChord({ chords }));

    let consumed = false;
    act(() => {
      consumed = result.current.handleInput('g');
    });

    expect(consumed).toBe(true);
  });

  it('should return false for non-chord input', () => {
    const chords = createChords();
    const { result } = renderHook(() => useChord({ chords }));

    let consumed = false;
    act(() => {
      consumed = result.current.handleInput('x');
    });

    expect(consumed).toBe(false);
  });

  it('should reset chord state on reset()', () => {
    const chords = createChords();
    const { result } = renderHook(() => useChord({ chords }));

    act(() => {
      result.current.handleInput('g');
    });

    expect(result.current.state.isActive).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.isActive).toBe(false);
    expect(result.current.state.buffer).toBe('');
    expect(result.current.state.pendingChords).toEqual([]);
  });

  it('should cancel partial chord on non-matching input', () => {
    const onChordCancel = vi.fn();
    const chords = createChords();
    const { result } = renderHook(() =>
      useChord({ chords, onChordCancel })
    );

    act(() => {
      result.current.handleInput('g');
    });

    expect(result.current.state.isActive).toBe(true);

    act(() => {
      result.current.handleInput('x'); // Not a valid continuation
    });

    expect(result.current.state.isActive).toBe(false);
    expect(onChordCancel).toHaveBeenCalled();
  });

  it('should handle custom timeout', () => {
    const chords = createChords();
    const { result } = renderHook(() =>
      useChord({ chords, timeout: 1000 })
    );

    act(() => {
      result.current.handleInput('g');
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should still be active at 500ms with 1000ms timeout
    expect(result.current.state.isActive).toBe(true);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Should be cancelled at 1100ms
    expect(result.current.state.isActive).toBe(false);
  });

  it('should reset timeout on new input', () => {
    const onChordCancel = vi.fn();
    const chords = [
      { keys: 'abc', action: vi.fn(), description: 'Three key chord' },
    ];
    const { result } = renderHook(() =>
      useChord({ chords, timeout: 500, onChordCancel })
    );

    act(() => {
      result.current.handleInput('a');
    });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Input 'b' should reset the timer
    act(() => {
      result.current.handleInput('b');
    });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Should still be active because timer was reset
    expect(result.current.state.isActive).toBe(true);
    expect(onChordCancel).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Now should be cancelled
    expect(onChordCancel).toHaveBeenCalled();
  });
});

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFocus } from './use-focus';

describe('useFocus', () => {
  const panels = ['sidebar', 'main', 'detail'];

  it('initializes with first panel', () => {
    const { result } = renderHook(() => useFocus({ panels }));
    expect(result.current.activePanel).toBe('sidebar');
  });

  it('initializes with specified panel', () => {
    const { result } = renderHook(() =>
      useFocus({ panels, initialPanel: 'main' })
    );
    expect(result.current.activePanel).toBe('main');
  });

  it('focuses next panel', () => {
    const { result } = renderHook(() => useFocus({ panels }));

    act(() => {
      result.current.focusNext();
    });
    expect(result.current.activePanel).toBe('main');

    act(() => {
      result.current.focusNext();
    });
    expect(result.current.activePanel).toBe('detail');
  });

  it('wraps around to first panel', () => {
    const { result } = renderHook(() =>
      useFocus({ panels, initialPanel: 'detail' })
    );

    act(() => {
      result.current.focusNext();
    });
    expect(result.current.activePanel).toBe('sidebar');
  });

  it('does not wrap when wrapAround is false', () => {
    const { result } = renderHook(() =>
      useFocus({ panels, initialPanel: 'detail', wrapAround: false })
    );

    act(() => {
      result.current.focusNext();
    });
    expect(result.current.activePanel).toBe('detail');
  });

  it('focuses previous panel', () => {
    const { result } = renderHook(() =>
      useFocus({ panels, initialPanel: 'main' })
    );

    act(() => {
      result.current.focusPrevious();
    });
    expect(result.current.activePanel).toBe('sidebar');
  });

  it('wraps around to last panel', () => {
    const { result } = renderHook(() => useFocus({ panels }));

    act(() => {
      result.current.focusPrevious();
    });
    expect(result.current.activePanel).toBe('detail');
  });

  it('does not wrap backwards when wrapAround is false', () => {
    const { result } = renderHook(() =>
      useFocus({ panels, wrapAround: false })
    );

    act(() => {
      result.current.focusPrevious();
    });
    expect(result.current.activePanel).toBe('sidebar');
  });

  it('focuses first panel', () => {
    const { result } = renderHook(() =>
      useFocus({ panels, initialPanel: 'detail' })
    );

    act(() => {
      result.current.focusFirst();
    });
    expect(result.current.activePanel).toBe('sidebar');
  });

  it('focuses last panel', () => {
    const { result } = renderHook(() => useFocus({ panels }));

    act(() => {
      result.current.focusLast();
    });
    expect(result.current.activePanel).toBe('detail');
  });

  it('sets active panel directly', () => {
    const { result } = renderHook(() => useFocus({ panels }));

    act(() => {
      result.current.setActivePanel('detail');
    });
    expect(result.current.activePanel).toBe('detail');
  });

  it('checks if panel is active', () => {
    const { result } = renderHook(() =>
      useFocus({ panels, initialPanel: 'main' })
    );

    expect(result.current.isActive('main')).toBe(true);
    expect(result.current.isActive('sidebar')).toBe(false);
    expect(result.current.isActive('detail')).toBe(false);
  });

  it('handles empty panels array', () => {
    const { result } = renderHook(() => useFocus({ panels: [] }));

    expect(result.current.activePanel).toBe('');

    // Should not throw
    act(() => {
      result.current.focusNext();
      result.current.focusPrevious();
      result.current.focusFirst();
      result.current.focusLast();
    });

    expect(result.current.activePanel).toBe('');
  });

  it('handles single panel', () => {
    const { result } = renderHook(() => useFocus({ panels: ['only'] }));

    expect(result.current.activePanel).toBe('only');

    act(() => {
      result.current.focusNext();
    });
    expect(result.current.activePanel).toBe('only');

    act(() => {
      result.current.focusPrevious();
    });
    expect(result.current.activePanel).toBe('only');
  });
});

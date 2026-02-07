import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfirm } from './use-confirm';

describe('useConfirm', () => {
  it('initializes with closed state', () => {
    const { result } = renderHook(() => useConfirm());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.state.isOpen).toBe(false);
  });

  it('opens with provided options', () => {
    const { result } = renderHook(() => useConfirm());

    act(() => {
      result.current.open({
        title: 'Confirm Action',
        message: 'Are you sure?',
        destructive: true,
      });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.state.title).toBe('Confirm Action');
    expect(result.current.state.message).toBe('Are you sure?');
    expect(result.current.state.destructive).toBe(true);
  });

  it('closes the dialog', () => {
    const { result } = renderHook(() => useConfirm());

    act(() => {
      result.current.open({ title: 'Test', message: 'Test' });
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('calls onConfirm callback on confirm', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useConfirm(onConfirm));

    act(() => {
      result.current.open({ title: 'Test', message: 'Test' });
    });

    act(() => {
      result.current.confirm();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(result.current.isOpen).toBe(false);
  });

  it('calls onCancel callback on cancel', () => {
    const onCancel = vi.fn();
    const { result } = renderHook(() => useConfirm(undefined, onCancel));

    act(() => {
      result.current.open({ title: 'Test', message: 'Test' });
    });

    act(() => {
      result.current.cancel();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(result.current.isOpen).toBe(false);
  });

  it('handles y key to confirm', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useConfirm(onConfirm));

    act(() => {
      result.current.open({ title: 'Test', message: 'Test' });
    });

    let handled = false;
    act(() => {
      handled = result.current.handleKey('y');
    });

    expect(handled).toBe(true);
    expect(onConfirm).toHaveBeenCalled();
  });

  it('handles Y key to confirm', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useConfirm(onConfirm));

    act(() => {
      result.current.open({ title: 'Test', message: 'Test' });
    });

    act(() => {
      result.current.handleKey('Y');
    });

    expect(onConfirm).toHaveBeenCalled();
  });

  it('handles n key to cancel', () => {
    const onCancel = vi.fn();
    const { result } = renderHook(() => useConfirm(undefined, onCancel));

    act(() => {
      result.current.open({ title: 'Test', message: 'Test' });
    });

    let handled = false;
    act(() => {
      handled = result.current.handleKey('n');
    });

    expect(handled).toBe(true);
    expect(onCancel).toHaveBeenCalled();
  });

  it('handles escape key to cancel', () => {
    const onCancel = vi.fn();
    const { result } = renderHook(() => useConfirm(undefined, onCancel));

    act(() => {
      result.current.open({ title: 'Test', message: 'Test' });
    });

    act(() => {
      result.current.handleKey('escape');
    });

    expect(onCancel).toHaveBeenCalled();
  });

  it('ignores keys when closed', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useConfirm(onConfirm));

    let handled = false;
    act(() => {
      handled = result.current.handleKey('y');
    });

    expect(handled).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('returns false for unhandled keys', () => {
    const { result } = renderHook(() => useConfirm());

    act(() => {
      result.current.open({ title: 'Test', message: 'Test' });
    });

    let handled = true;
    act(() => {
      handled = result.current.handleKey('x');
    });

    expect(handled).toBe(false);
    expect(result.current.isOpen).toBe(true);
  });

  it('uses default labels', () => {
    const { result } = renderHook(() => useConfirm());

    act(() => {
      result.current.open({ title: 'Test', message: 'Test' });
    });

    expect(result.current.state.confirmLabel).toBe('Confirm');
    expect(result.current.state.cancelLabel).toBe('Cancel');
  });

  it('uses custom labels', () => {
    const { result } = renderHook(() => useConfirm());

    act(() => {
      result.current.open({
        title: 'Delete',
        message: 'Delete item?',
        confirmLabel: 'Yes, delete',
        cancelLabel: 'Keep it',
      });
    });

    expect(result.current.state.confirmLabel).toBe('Yes, delete');
    expect(result.current.state.cancelLabel).toBe('Keep it');
  });
});

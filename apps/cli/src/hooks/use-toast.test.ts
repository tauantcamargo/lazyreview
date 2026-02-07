import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from './use-toast';

describe('useToast', () => {
  it('initializes with empty toasts', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toEqual([]);
  });

  it('adds toast with addToast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Test message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Test message');
    expect(result.current.toasts[0].type).toBe('info');
  });

  it('adds toast with specified type', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Error message', 'error');
    });

    expect(result.current.toasts[0].type).toBe('error');
  });

  it('adds toast with specified duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Message', 'info', 5000);
    });

    expect(result.current.toasts[0].duration).toBe(5000);
  });

  it('returns toast ID when adding', () => {
    const { result } = renderHook(() => useToast());

    let id: string = '';
    act(() => {
      id = result.current.addToast('Test');
    });

    expect(id).toMatch(/^toast-\d+$/);
    expect(result.current.toasts[0].id).toBe(id);
  });

  it('removes toast by ID', () => {
    const { result } = renderHook(() => useToast());

    let id: string = '';
    act(() => {
      id = result.current.addToast('To remove');
      result.current.addToast('To keep');
    });

    expect(result.current.toasts).toHaveLength(2);

    act(() => {
      result.current.removeToast(id);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('To keep');
  });

  it('clears all toasts', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Toast 1');
      result.current.addToast('Toast 2');
      result.current.addToast('Toast 3');
    });

    expect(result.current.toasts).toHaveLength(3);

    act(() => {
      result.current.clearToasts();
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('adds success toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('Success!');
    });

    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[0].message).toBe('Success!');
  });

  it('adds error toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.error('Error!');
    });

    expect(result.current.toasts[0].type).toBe('error');
    expect(result.current.toasts[0].message).toBe('Error!');
  });

  it('adds warning toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.warning('Warning!');
    });

    expect(result.current.toasts[0].type).toBe('warning');
    expect(result.current.toasts[0].message).toBe('Warning!');
  });

  it('adds info toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.info('Info!');
    });

    expect(result.current.toasts[0].type).toBe('info');
    expect(result.current.toasts[0].message).toBe('Info!');
  });

  it('generates unique IDs for each toast', () => {
    const { result } = renderHook(() => useToast());

    let ids: string[] = [];
    act(() => {
      ids.push(result.current.addToast('Toast 1'));
      ids.push(result.current.addToast('Toast 2'));
      ids.push(result.current.addToast('Toast 3'));
    });

    expect(new Set(ids).size).toBe(3);
  });
});

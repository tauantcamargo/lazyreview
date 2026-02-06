import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme, useSystemTheme } from './use-theme';

// Mock the UI module
vi.mock('@lazyreview/ui', () => ({
  getTheme: vi.fn((name: string) => ({
    name,
    primary: '#000',
    secondary: '#111',
  })),
  themes: {
    default: { name: 'default' },
    tokyonight: { name: 'tokyonight' },
    catppuccin: { name: 'catppuccin' },
    nord: { name: 'nord' },
  },
  defaultTheme: { name: 'default' },
}));

// Mock the core module
vi.mock('@lazyreview/core', () => ({
  loadConfig: vi.fn(() => ({
    ui: { theme: 'default' },
  })),
  saveConfig: vi.fn(),
}));

import { loadConfig, saveConfig } from '@lazyreview/core';

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (loadConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      ui: { theme: 'default' },
    });
  });

  it('initializes with default theme', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.themeName).toBe('default');
    expect(result.current.availableThemes).toEqual([
      'default',
      'tokyonight',
      'catppuccin',
      'nord',
    ]);
  });

  it('initializes with custom initial theme', () => {
    const { result } = renderHook(() =>
      useTheme({ initialTheme: 'tokyonight' })
    );

    expect(result.current.themeName).toBe('tokyonight');
  });

  it('loads theme from config', () => {
    (loadConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      ui: { theme: 'catppuccin' },
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.themeName).toBe('catppuccin');
  });

  it('handles config load failure', () => {
    (loadConfig as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Config not found');
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.themeName).toBe('default');
  });

  it('sets theme', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('nord');
    });

    expect(result.current.themeName).toBe('nord');
  });

  it('ignores invalid theme names', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('nonexistent');
    });

    expect(result.current.themeName).toBe('default');
  });

  it('persists theme to config by default', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('tokyonight');
    });

    expect(saveConfig).toHaveBeenCalledWith({
      ui: { theme: 'tokyonight' },
    });
  });

  it('does not persist when persistToConfig is false', () => {
    const { result } = renderHook(() =>
      useTheme({ persistToConfig: false })
    );

    act(() => {
      result.current.setTheme('tokyonight');
    });

    expect(saveConfig).not.toHaveBeenCalled();
  });

  it('handles config save failure gracefully', () => {
    (saveConfig as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Write failed');
    });

    const { result } = renderHook(() => useTheme());

    // Should not throw
    act(() => {
      result.current.setTheme('nord');
    });

    expect(result.current.themeName).toBe('nord');
  });

  it('cycles through themes', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.themeName).toBe('default');

    act(() => {
      result.current.cycleTheme();
    });
    expect(result.current.themeName).toBe('tokyonight');

    act(() => {
      result.current.cycleTheme();
    });
    expect(result.current.themeName).toBe('catppuccin');

    act(() => {
      result.current.cycleTheme();
    });
    expect(result.current.themeName).toBe('nord');

    act(() => {
      result.current.cycleTheme();
    });
    expect(result.current.themeName).toBe('default'); // Wraps around
  });

  it('returns theme object', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toEqual({
      name: 'default',
      primary: '#000',
      secondary: '#111',
    });
  });
});

describe('useSystemTheme', () => {
  it('returns dark mode preference', () => {
    const { result } = renderHook(() => useSystemTheme());

    expect(result.current.isDark).toBe(true);
    expect(result.current.preferredTheme).toBe('tokyonight');
  });
});

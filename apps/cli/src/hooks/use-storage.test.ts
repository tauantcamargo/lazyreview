import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useStorage,
  useRecentItems,
  useFavorites,
  useSettings,
  StorageInterface,
} from './use-storage';

// Create a mock storage for each test
function createMockStorage(): StorageInterface & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
  };
}

describe('useStorage', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  it('returns initial value when storage is empty', () => {
    const { result } = renderHook(() =>
      useStorage({
        key: 'test-key',
        initialValue: 'default',
        storage: mockStorage,
      })
    );

    expect(result.current.value).toBe('default');
  });

  it('returns stored value when present', () => {
    mockStorage.setItem('test-key', JSON.stringify('stored'));

    const { result } = renderHook(() =>
      useStorage({
        key: 'test-key',
        initialValue: 'default',
        storage: mockStorage,
      })
    );

    expect(result.current.value).toBe('stored');
  });

  it('sets value and persists to storage', () => {
    const { result } = renderHook(() =>
      useStorage({
        key: 'test-key',
        initialValue: 'default',
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.setValue('new value');
    });

    expect(result.current.value).toBe('new value');
    expect(mockStorage.data['test-key']).toBe(JSON.stringify('new value'));
  });

  it('supports updater function', () => {
    const { result } = renderHook(() =>
      useStorage({
        key: 'counter',
        initialValue: 0,
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.setValue((prev) => prev + 5);
    });

    expect(result.current.value).toBe(5);
  });

  it('removes value from storage', () => {
    mockStorage.setItem('test-key', JSON.stringify('stored'));

    const { result } = renderHook(() =>
      useStorage({
        key: 'test-key',
        initialValue: 'default',
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.remove();
    });

    expect(result.current.value).toBe('default');
    expect(mockStorage.data['test-key']).toBeUndefined();
  });

  it('refreshes value from storage', () => {
    const { result } = renderHook(() =>
      useStorage({
        key: 'test-key',
        initialValue: 'default',
        storage: mockStorage,
      })
    );

    // Simulate external storage update
    mockStorage.setItem('test-key', JSON.stringify('external'));

    act(() => {
      result.current.refresh();
    });

    expect(result.current.value).toBe('external');
  });

  it('handles complex objects', () => {
    const { result } = renderHook(() =>
      useStorage({
        key: 'user',
        initialValue: { name: 'Alice', age: 30 },
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.setValue({ name: 'Bob', age: 25 });
    });

    expect(result.current.value).toEqual({ name: 'Bob', age: 25 });
  });

  it('uses custom serialize/deserialize', () => {
    const { result } = renderHook(() =>
      useStorage({
        key: 'date',
        initialValue: new Date('2024-01-01'),
        storage: mockStorage,
        serialize: (d) => d.toISOString(),
        deserialize: (s) => new Date(s),
      })
    );

    const newDate = new Date('2024-06-15');
    act(() => {
      result.current.setValue(newDate);
    });

    expect(result.current.value.toISOString()).toBe(newDate.toISOString());
    expect(mockStorage.data['date']).toBe(newDate.toISOString());
  });
});

describe('useRecentItems', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  it('starts with empty items', () => {
    const { result } = renderHook(() =>
      useRecentItems<string>({
        key: 'recent',
        storage: mockStorage,
      })
    );

    expect(result.current.items).toEqual([]);
  });

  it('adds items to the front', () => {
    const { result } = renderHook(() =>
      useRecentItems<string>({
        key: 'recent',
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.add('first');
    });

    act(() => {
      result.current.add('second');
    });

    expect(result.current.items).toEqual(['second', 'first']);
  });

  it('removes duplicates when adding', () => {
    const { result } = renderHook(() =>
      useRecentItems<string>({
        key: 'recent',
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.add('a');
      result.current.add('b');
      result.current.add('c');
    });

    act(() => {
      result.current.add('b');
    });

    expect(result.current.items).toEqual(['b', 'c', 'a']);
  });

  it('limits items to maxItems', () => {
    const { result } = renderHook(() =>
      useRecentItems<string>({
        key: 'recent',
        maxItems: 3,
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.add('a');
      result.current.add('b');
      result.current.add('c');
      result.current.add('d');
    });

    expect(result.current.items).toHaveLength(3);
    expect(result.current.items).toEqual(['d', 'c', 'b']);
  });

  it('removes specific item', () => {
    const { result } = renderHook(() =>
      useRecentItems<string>({
        key: 'recent',
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.add('a');
      result.current.add('b');
      result.current.add('c');
    });

    act(() => {
      result.current.remove('b');
    });

    expect(result.current.items).toEqual(['c', 'a']);
  });

  it('clears all items', () => {
    const { result } = renderHook(() =>
      useRecentItems<string>({
        key: 'recent',
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.add('a');
      result.current.add('b');
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.items).toEqual([]);
  });

  it('uses custom compare function', () => {
    type Item = { id: number; name: string };

    const { result } = renderHook(() =>
      useRecentItems<Item>({
        key: 'recent',
        storage: mockStorage,
        compare: (a, b) => a.id === b.id,
      })
    );

    act(() => {
      result.current.add({ id: 1, name: 'First' });
      result.current.add({ id: 2, name: 'Second' });
    });

    act(() => {
      result.current.add({ id: 1, name: 'Updated First' });
    });

    expect(result.current.items).toEqual([
      { id: 1, name: 'Updated First' },
      { id: 2, name: 'Second' },
    ]);
  });
});

describe('useFavorites', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  it('starts with empty favorites', () => {
    const { result } = renderHook(() =>
      useFavorites<string>({
        key: 'favorites',
        storage: mockStorage,
      })
    );

    expect(result.current.favorites).toEqual([]);
  });

  it('adds to favorites', () => {
    const { result } = renderHook(() =>
      useFavorites<string>({
        key: 'favorites',
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.add('item1');
    });

    expect(result.current.favorites).toEqual(['item1']);
    expect(result.current.isFavorite('item1')).toBe(true);
  });

  it('prevents duplicates', () => {
    const { result } = renderHook(() =>
      useFavorites<string>({
        key: 'favorites',
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.add('item1');
      result.current.add('item1');
    });

    expect(result.current.favorites).toEqual(['item1']);
  });

  it('removes from favorites', () => {
    const { result } = renderHook(() =>
      useFavorites<string>({
        key: 'favorites',
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.add('item1');
      result.current.add('item2');
    });

    act(() => {
      result.current.remove('item1');
    });

    expect(result.current.favorites).toEqual(['item2']);
    expect(result.current.isFavorite('item1')).toBe(false);
  });

  it('toggles favorite status', () => {
    const { result } = renderHook(() =>
      useFavorites<string>({
        key: 'favorites',
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.toggle('item1');
    });

    expect(result.current.isFavorite('item1')).toBe(true);

    act(() => {
      result.current.toggle('item1');
    });

    expect(result.current.isFavorite('item1')).toBe(false);
  });

  it('clears all favorites', () => {
    const { result } = renderHook(() =>
      useFavorites<string>({
        key: 'favorites',
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.add('item1');
      result.current.add('item2');
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.favorites).toEqual([]);
  });

  it('uses custom compare function', () => {
    type Repo = { owner: string; name: string };

    const { result } = renderHook(() =>
      useFavorites<Repo>({
        key: 'favorites',
        storage: mockStorage,
        compare: (a, b) => a.owner === b.owner && a.name === b.name,
      })
    );

    act(() => {
      result.current.add({ owner: 'org', name: 'repo1' });
    });

    expect(result.current.isFavorite({ owner: 'org', name: 'repo1' })).toBe(true);
    expect(result.current.isFavorite({ owner: 'org', name: 'repo2' })).toBe(false);
  });
});

describe('useSettings', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  type Settings = {
    theme: string;
    fontSize: number;
    vimMode: boolean;
  };

  const defaultSettings: Settings = {
    theme: 'dark',
    fontSize: 14,
    vimMode: true,
  };

  it('returns default settings initially', () => {
    const { result } = renderHook(() =>
      useSettings({
        key: 'settings',
        defaultSettings,
        storage: mockStorage,
      })
    );

    expect(result.current.settings).toEqual(defaultSettings);
  });

  it('gets individual settings', () => {
    const { result } = renderHook(() =>
      useSettings({
        key: 'settings',
        defaultSettings,
        storage: mockStorage,
      })
    );

    expect(result.current.get('theme')).toBe('dark');
    expect(result.current.get('fontSize')).toBe(14);
    expect(result.current.get('vimMode')).toBe(true);
  });

  it('sets individual settings', () => {
    const { result } = renderHook(() =>
      useSettings({
        key: 'settings',
        defaultSettings,
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.set('theme', 'light');
    });

    expect(result.current.get('theme')).toBe('light');
    expect(result.current.get('fontSize')).toBe(14); // Unchanged
  });

  it('updates multiple settings at once', () => {
    const { result } = renderHook(() =>
      useSettings({
        key: 'settings',
        defaultSettings,
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.update({ theme: 'light', fontSize: 16 });
    });

    expect(result.current.settings).toEqual({
      theme: 'light',
      fontSize: 16,
      vimMode: true,
    });
  });

  it('resets all settings to defaults', () => {
    const { result } = renderHook(() =>
      useSettings({
        key: 'settings',
        defaultSettings,
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.update({ theme: 'light', fontSize: 16, vimMode: false });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.settings).toEqual(defaultSettings);
  });

  it('resets individual setting to default', () => {
    const { result } = renderHook(() =>
      useSettings({
        key: 'settings',
        defaultSettings,
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.update({ theme: 'light', fontSize: 16 });
    });

    act(() => {
      result.current.resetKey('theme');
    });

    expect(result.current.get('theme')).toBe('dark');
    expect(result.current.get('fontSize')).toBe(16); // Still changed
  });

  it('persists settings to storage', () => {
    const { result } = renderHook(() =>
      useSettings({
        key: 'settings',
        defaultSettings,
        storage: mockStorage,
      })
    );

    act(() => {
      result.current.set('theme', 'gruvbox');
    });

    const stored = JSON.parse(mockStorage.data['settings']);
    expect(stored.theme).toBe('gruvbox');
  });

  it('loads settings from storage', () => {
    mockStorage.setItem(
      'settings',
      JSON.stringify({ theme: 'catppuccin', fontSize: 18, vimMode: false })
    );

    const { result } = renderHook(() =>
      useSettings({
        key: 'settings',
        defaultSettings,
        storage: mockStorage,
      })
    );

    expect(result.current.settings).toEqual({
      theme: 'catppuccin',
      fontSize: 18,
      vimMode: false,
    });
  });
});

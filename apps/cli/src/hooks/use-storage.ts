import { useState, useCallback, useEffect, useMemo } from 'react';

export interface UseStorageOptions<T> {
  key: string;
  initialValue: T;
  storage?: StorageInterface;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
}

export interface StorageInterface {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface UseStorageResult<T> {
  value: T;
  setValue: (value: T | ((prev: T) => T)) => void;
  remove: () => void;
  refresh: () => void;
}

// In-memory storage for testing or when localStorage is not available
const memoryStorage: Record<string, string> = {};
const inMemoryStorage: StorageInterface = {
  getItem: (key) => memoryStorage[key] ?? null,
  setItem: (key, value) => {
    memoryStorage[key] = value;
  },
  removeItem: (key) => {
    delete memoryStorage[key];
  },
};

/**
 * Hook for persisting values to storage
 */
export function useStorage<T>(options: UseStorageOptions<T>): UseStorageResult<T> {
  const {
    key,
    initialValue,
    storage = inMemoryStorage,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
  } = options;

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = storage.getItem(key);
      return item ? deserialize(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((valueOrUpdater: T | ((prev: T) => T)) => {
    setStoredValue((prev) => {
      const newValue =
        typeof valueOrUpdater === 'function'
          ? (valueOrUpdater as (prev: T) => T)(prev)
          : valueOrUpdater;

      try {
        storage.setItem(key, serialize(newValue));
      } catch {
        // Storage might be full or unavailable
      }

      return newValue;
    });
  }, [key, serialize, storage]);

  const remove = useCallback(() => {
    try {
      storage.removeItem(key);
      setStoredValue(initialValue);
    } catch {
      // Ignore errors
    }
  }, [key, initialValue, storage]);

  const refresh = useCallback(() => {
    try {
      const item = storage.getItem(key);
      if (item) {
        setStoredValue(deserialize(item));
      }
    } catch {
      // Ignore errors
    }
  }, [key, deserialize, storage]);

  return {
    value: storedValue,
    setValue,
    remove,
    refresh,
  };
}

export interface UseRecentItemsOptions<T> {
  key: string;
  maxItems?: number;
  storage?: StorageInterface;
  compare?: (a: T, b: T) => boolean;
}

export interface UseRecentItemsResult<T> {
  items: T[];
  add: (item: T) => void;
  remove: (item: T) => void;
  clear: () => void;
}

/**
 * Hook for managing a list of recently used items
 */
export function useRecentItems<T>(options: UseRecentItemsOptions<T>): UseRecentItemsResult<T> {
  const {
    key,
    maxItems = 10,
    storage = inMemoryStorage,
    compare = (a, b) => JSON.stringify(a) === JSON.stringify(b),
  } = options;

  const { value, setValue } = useStorage<T[]>({
    key,
    initialValue: [],
    storage,
  });

  const add = useCallback((item: T) => {
    setValue((prev) => {
      // Remove existing item if present
      const filtered = prev.filter((existing) => !compare(existing, item));
      // Add to front and limit to maxItems
      return [item, ...filtered].slice(0, maxItems);
    });
  }, [compare, maxItems, setValue]);

  const remove = useCallback((item: T) => {
    setValue((prev) => prev.filter((existing) => !compare(existing, item)));
  }, [compare, setValue]);

  const clear = useCallback(() => {
    setValue([]);
  }, [setValue]);

  return {
    items: value,
    add,
    remove,
    clear,
  };
}

export interface UseFavoritesOptions<T> {
  key: string;
  storage?: StorageInterface;
  compare?: (a: T, b: T) => boolean;
}

export interface UseFavoritesResult<T> {
  favorites: T[];
  isFavorite: (item: T) => boolean;
  toggle: (item: T) => void;
  add: (item: T) => void;
  remove: (item: T) => void;
  clear: () => void;
}

/**
 * Hook for managing a favorites list
 */
export function useFavorites<T>(options: UseFavoritesOptions<T>): UseFavoritesResult<T> {
  const {
    key,
    storage = inMemoryStorage,
    compare = (a, b) => JSON.stringify(a) === JSON.stringify(b),
  } = options;

  const { value, setValue } = useStorage<T[]>({
    key,
    initialValue: [],
    storage,
  });

  const isFavorite = useCallback((item: T) => {
    return value.some((existing) => compare(existing, item));
  }, [compare, value]);

  const add = useCallback((item: T) => {
    setValue((prev) => {
      if (prev.some((existing) => compare(existing, item))) {
        return prev;
      }
      return [...prev, item];
    });
  }, [compare, setValue]);

  const remove = useCallback((item: T) => {
    setValue((prev) => prev.filter((existing) => !compare(existing, item)));
  }, [compare, setValue]);

  const toggle = useCallback((item: T) => {
    if (isFavorite(item)) {
      remove(item);
    } else {
      add(item);
    }
  }, [isFavorite, add, remove]);

  const clear = useCallback(() => {
    setValue([]);
  }, [setValue]);

  return {
    favorites: value,
    isFavorite,
    toggle,
    add,
    remove,
    clear,
  };
}

export interface UseSettingsOptions<T extends Record<string, unknown>> {
  key: string;
  defaultSettings: T;
  storage?: StorageInterface;
}

export interface UseSettingsResult<T extends Record<string, unknown>> {
  settings: T;
  get: <K extends keyof T>(key: K) => T[K];
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  update: (updates: Partial<T>) => void;
  reset: () => void;
  resetKey: <K extends keyof T>(key: K) => void;
}

/**
 * Hook for managing settings with individual key access
 */
export function useSettings<T extends Record<string, unknown>>(
  options: UseSettingsOptions<T>
): UseSettingsResult<T> {
  const { key, defaultSettings, storage = inMemoryStorage } = options;

  const { value, setValue } = useStorage<T>({
    key,
    initialValue: defaultSettings,
    storage,
  });

  const get = useCallback(<K extends keyof T>(settingKey: K): T[K] => {
    return value[settingKey] ?? defaultSettings[settingKey];
  }, [value, defaultSettings]);

  const set = useCallback(<K extends keyof T>(settingKey: K, settingValue: T[K]) => {
    setValue((prev) => ({
      ...prev,
      [settingKey]: settingValue,
    }));
  }, [setValue]);

  const update = useCallback((updates: Partial<T>) => {
    setValue((prev) => ({
      ...prev,
      ...updates,
    }));
  }, [setValue]);

  const reset = useCallback(() => {
    setValue(defaultSettings);
  }, [defaultSettings, setValue]);

  const resetKey = useCallback(<K extends keyof T>(settingKey: K) => {
    setValue((prev) => ({
      ...prev,
      [settingKey]: defaultSettings[settingKey],
    }));
  }, [defaultSettings, setValue]);

  return {
    settings: value,
    get,
    set,
    update,
    reset,
    resetKey,
  };
}

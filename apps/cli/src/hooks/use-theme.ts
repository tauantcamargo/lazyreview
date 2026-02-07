import { useState, useCallback, useEffect } from 'react';
import { getTheme, themes, defaultTheme, type Theme } from '@lazyreview/ui';
import { loadConfig, saveConfig, type LazyReviewConfig } from '@lazyreview/core';

export type ThemeName = keyof typeof themes;

export interface UseThemeOptions {
  initialTheme?: string;
  persistToConfig?: boolean;
}

export interface UseThemeResult {
  theme: Theme;
  themeName: string;
  availableThemes: string[];
  setTheme: (name: string) => void;
  cycleTheme: () => void;
}

export function useTheme(options: UseThemeOptions = {}): UseThemeResult {
  const { initialTheme, persistToConfig = true } = options;

  const [themeName, setThemeName] = useState<string>(() => {
    if (initialTheme) return initialTheme;
    try {
      const config = loadConfig();
      return config.ui?.theme ?? 'default';
    } catch {
      return 'default';
    }
  });

  const theme = getTheme(themeName);
  const availableThemes = Object.keys(themes);

  const setTheme = useCallback(
    (name: string) => {
      if (!availableThemes.includes(name)) {
        return;
      }

      setThemeName(name);

      if (persistToConfig) {
        try {
          const config = loadConfig();
          const updatedConfig: LazyReviewConfig = {
            ...config,
            ui: {
              ...config.ui,
              theme: name,
            },
          };
          saveConfig(updatedConfig);
        } catch {
          // Ignore config save errors
        }
      }
    },
    [availableThemes, persistToConfig]
  );

  const cycleTheme = useCallback(() => {
    const currentIndex = availableThemes.indexOf(themeName);
    const nextIndex = (currentIndex + 1) % availableThemes.length;
    const nextTheme = availableThemes[nextIndex];
    if (nextTheme) {
      setTheme(nextTheme);
    }
  }, [themeName, availableThemes, setTheme]);

  return {
    theme,
    themeName,
    availableThemes,
    setTheme,
    cycleTheme,
  };
}

export interface UseSystemThemeResult {
  isDark: boolean;
  preferredTheme: string;
}

export function useSystemTheme(): UseSystemThemeResult {
  // In terminal environment, we don't have access to system theme
  // Default to dark mode as most terminal users prefer it
  const [isDark] = useState(true);

  return {
    isDark,
    preferredTheme: isDark ? 'tokyonight' : 'default',
  };
}

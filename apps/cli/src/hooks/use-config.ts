import { useState, useCallback, useMemo } from 'react';

export interface KeyBindings {
  navigation: {
    up: string;
    down: string;
    left: string;
    right: string;
    pageUp: string;
    pageDown: string;
    top: string;
    bottom: string;
  };
  actions: {
    select: string;
    back: string;
    quit: string;
    help: string;
    refresh: string;
    search: string;
  };
  review: {
    approve: string;
    requestChanges: string;
    comment: string;
    merge: string;
  };
}

export interface UIConfig {
  theme: 'auto' | 'dark' | 'light';
  vimMode: boolean;
  showIcons: boolean;
  compactMode: boolean;
  showLineNumbers: boolean;
  diffStyle: 'unified' | 'split';
  syntaxHighlight: boolean;
}

export interface ProviderConfig {
  name: string;
  type: 'github' | 'gitlab' | 'bitbucket' | 'azuredevops';
  host: string;
  tokenEnv: string;
  default: boolean;
}

export interface PerformanceConfig {
  cacheTtl: number;
  commentCacheTtl: number;
  maxConcurrency: number;
  rateLimitPerSecond: number;
}

export interface AppConfig {
  version: string;
  defaultProvider: string;
  ui: UIConfig;
  keybindings: KeyBindings;
  providers: ProviderConfig[];
  performance: PerformanceConfig;
  aiReview?: {
    enabled: boolean;
    apiKeyEnv: string;
    model: string;
  };
}

export const defaultConfig: AppConfig = {
  version: '0.1',
  defaultProvider: 'github',
  ui: {
    theme: 'auto',
    vimMode: true,
    showIcons: true,
    compactMode: false,
    showLineNumbers: true,
    diffStyle: 'unified',
    syntaxHighlight: true,
  },
  keybindings: {
    navigation: {
      up: 'k',
      down: 'j',
      left: 'h',
      right: 'l',
      pageUp: 'ctrl+u',
      pageDown: 'ctrl+d',
      top: 'gg',
      bottom: 'G',
    },
    actions: {
      select: 'enter',
      back: 'q',
      quit: 'ctrl+c',
      help: '?',
      refresh: 'r',
      search: '/',
    },
    review: {
      approve: 'a',
      requestChanges: 'x',
      comment: 'c',
      merge: 'm',
    },
  },
  providers: [],
  performance: {
    cacheTtl: 120,
    commentCacheTtl: 20,
    maxConcurrency: 6,
    rateLimitPerSecond: 10,
  },
};

export interface UseConfigOptions {
  initialConfig?: Partial<AppConfig>;
  persistKey?: string;
}

export interface UseConfigResult {
  config: AppConfig;
  setConfig: (config: Partial<AppConfig>) => void;
  setUIConfig: (ui: Partial<UIConfig>) => void;
  setKeybindings: (keybindings: Partial<KeyBindings>) => void;
  addProvider: (provider: ProviderConfig) => void;
  removeProvider: (name: string) => void;
  setDefaultProvider: (name: string) => void;
  resetToDefaults: () => void;
  getKeybinding: (category: keyof KeyBindings, action: string) => string;
  isVimMode: boolean;
  theme: UIConfig['theme'];
  currentProvider: ProviderConfig | undefined;
}

/**
 * Hook for managing app configuration
 */
export function useConfig(options: UseConfigOptions = {}): UseConfigResult {
  const { initialConfig = {} } = options;

  const [config, setConfigState] = useState<AppConfig>(() =>
    mergeConfig(defaultConfig, initialConfig)
  );

  const setConfig = useCallback((updates: Partial<AppConfig>) => {
    setConfigState((prev) => mergeConfig(prev, updates));
  }, []);

  const setUIConfig = useCallback((ui: Partial<UIConfig>) => {
    setConfigState((prev) => ({
      ...prev,
      ui: { ...prev.ui, ...ui },
    }));
  }, []);

  const setKeybindings = useCallback((keybindings: Partial<KeyBindings>) => {
    setConfigState((prev) => ({
      ...prev,
      keybindings: mergeKeybindings(prev.keybindings, keybindings),
    }));
  }, []);

  const addProvider = useCallback((provider: ProviderConfig) => {
    setConfigState((prev) => {
      // If this is the default, unset other defaults
      const providers = provider.default
        ? prev.providers.map((p) => ({ ...p, default: false }))
        : prev.providers;

      return {
        ...prev,
        providers: [...providers, provider],
        defaultProvider: provider.default ? provider.name : prev.defaultProvider,
      };
    });
  }, []);

  const removeProvider = useCallback((name: string) => {
    setConfigState((prev) => ({
      ...prev,
      providers: prev.providers.filter((p) => p.name !== name),
      defaultProvider:
        prev.defaultProvider === name
          ? prev.providers[0]?.name ?? ''
          : prev.defaultProvider,
    }));
  }, []);

  const setDefaultProvider = useCallback((name: string) => {
    setConfigState((prev) => ({
      ...prev,
      defaultProvider: name,
      providers: prev.providers.map((p) => ({
        ...p,
        default: p.name === name,
      })),
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setConfigState(defaultConfig);
  }, []);

  const getKeybinding = useCallback(
    (category: keyof KeyBindings, action: string): string => {
      const categoryBindings = config.keybindings[category] as Record<string, string>;
      return categoryBindings[action] ?? '';
    },
    [config.keybindings]
  );

  const isVimMode = config.ui.vimMode;
  const theme = config.ui.theme;

  const currentProvider = useMemo(() => {
    return config.providers.find((p) => p.name === config.defaultProvider);
  }, [config.providers, config.defaultProvider]);

  return {
    config,
    setConfig,
    setUIConfig,
    setKeybindings,
    addProvider,
    removeProvider,
    setDefaultProvider,
    resetToDefaults,
    getKeybinding,
    isVimMode,
    theme,
    currentProvider,
  };
}

/**
 * Deep merge two configs
 */
function mergeConfig(base: AppConfig, updates: Partial<AppConfig>): AppConfig {
  return {
    ...base,
    ...updates,
    ui: { ...base.ui, ...updates.ui },
    keybindings: updates.keybindings
      ? mergeKeybindings(base.keybindings, updates.keybindings)
      : base.keybindings,
    performance: { ...base.performance, ...updates.performance },
    providers: updates.providers ?? base.providers,
  };
}

/**
 * Merge keybindings
 */
function mergeKeybindings(
  base: KeyBindings,
  updates: Partial<KeyBindings>
): KeyBindings {
  return {
    navigation: { ...base.navigation, ...updates.navigation },
    actions: { ...base.actions, ...updates.actions },
    review: { ...base.review, ...updates.review },
  };
}

/**
 * Parse keybinding string
 */
export function parseKeybinding(binding: string): {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
} {
  const parts = binding.toLowerCase().split('+');
  const key = parts[parts.length - 1] ?? '';

  return {
    key,
    ctrl: parts.includes('ctrl'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
  };
}

/**
 * Format keybinding for display
 */
export function formatKeybinding(binding: string): string {
  return binding
    .replace('ctrl+', 'C-')
    .replace('alt+', 'M-')
    .replace('shift+', 'S-')
    .replace('enter', '⏎')
    .replace('escape', 'Esc')
    .replace('backspace', '⌫')
    .replace('space', '␣')
    .replace('tab', '⇥');
}

/**
 * Validate config structure
 */
export function validateConfig(config: unknown): config is AppConfig {
  if (typeof config !== 'object' || config === null) {
    return false;
  }

  const c = config as Record<string, unknown>;

  return (
    typeof c.version === 'string' &&
    typeof c.defaultProvider === 'string' &&
    typeof c.ui === 'object' &&
    typeof c.keybindings === 'object' &&
    Array.isArray(c.providers)
  );
}

/**
 * Get config file path
 */
export function getConfigPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  return `${home}/.config/lazyreview/config.yaml`;
}

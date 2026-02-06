import { useCallback, useRef, useEffect } from 'react';

export type KeyModifiers = {
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
  shift?: boolean;
};

export interface KeyBinding {
  key: string;
  modifiers?: KeyModifiers;
  action: () => void;
  description?: string;
  when?: () => boolean;
}

export interface UseKeyHandlerOptions {
  bindings: KeyBinding[];
  enabled?: boolean;
  preventDefault?: boolean;
}

export interface UseKeyHandlerResult {
  handleKey: (input: string, key: KeyInfo) => boolean;
  getBindings: () => KeyBinding[];
}

export interface KeyInfo {
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  escape?: boolean;
  return?: boolean;
  tab?: boolean;
  backspace?: boolean;
  delete?: boolean;
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  pageUp?: boolean;
  pageDown?: boolean;
}

function matchesModifiers(keyInfo: KeyInfo, modifiers?: KeyModifiers): boolean {
  if (!modifiers) {
    // No modifiers required, check that no modifiers are pressed
    return !keyInfo.ctrl && !keyInfo.alt && !keyInfo.meta && !keyInfo.shift;
  }

  return (
    !!keyInfo.ctrl === !!modifiers.ctrl &&
    !!keyInfo.alt === !!modifiers.alt &&
    !!keyInfo.meta === !!modifiers.meta &&
    !!keyInfo.shift === !!modifiers.shift
  );
}

function matchesKey(input: string, keyInfo: KeyInfo, targetKey: string): boolean {
  // Special keys
  if (targetKey === 'escape' || targetKey === 'esc') return !!keyInfo.escape;
  if (targetKey === 'enter' || targetKey === 'return') return !!keyInfo.return;
  if (targetKey === 'tab') return !!keyInfo.tab;
  if (targetKey === 'backspace') return !!keyInfo.backspace;
  if (targetKey === 'delete') return !!keyInfo.delete;
  if (targetKey === 'up' || targetKey === 'upArrow') return !!keyInfo.upArrow;
  if (targetKey === 'down' || targetKey === 'downArrow') return !!keyInfo.downArrow;
  if (targetKey === 'left' || targetKey === 'leftArrow') return !!keyInfo.leftArrow;
  if (targetKey === 'right' || targetKey === 'rightArrow') return !!keyInfo.rightArrow;
  if (targetKey === 'pageUp') return !!keyInfo.pageUp;
  if (targetKey === 'pageDown') return !!keyInfo.pageDown;

  // Regular character keys
  return input.toLowerCase() === targetKey.toLowerCase();
}

export function useKeyHandler(options: UseKeyHandlerOptions): UseKeyHandlerResult {
  const { bindings, enabled = true } = options;
  const bindingsRef = useRef(bindings);

  // Keep bindings ref current
  useEffect(() => {
    bindingsRef.current = bindings;
  }, [bindings]);

  const handleKey = useCallback(
    (input: string, keyInfo: KeyInfo): boolean => {
      if (!enabled) return false;

      for (const binding of bindingsRef.current) {
        // Check conditional
        if (binding.when && !binding.when()) {
          continue;
        }

        // Check key match
        if (!matchesKey(input, keyInfo, binding.key)) {
          continue;
        }

        // Check modifiers
        if (!matchesModifiers(keyInfo, binding.modifiers)) {
          continue;
        }

        // Execute action
        binding.action();
        return true;
      }

      return false;
    },
    [enabled]
  );

  const getBindings = useCallback((): KeyBinding[] => {
    return bindingsRef.current.filter((b) => !b.when || b.when());
  }, []);

  return {
    handleKey,
    getBindings,
  };
}

// Helper to format key binding for display
export function formatKeyBinding(key: string, modifiers?: KeyModifiers): string {
  const parts: string[] = [];

  if (modifiers?.ctrl) parts.push('Ctrl');
  if (modifiers?.alt) parts.push('Alt');
  if (modifiers?.meta) parts.push('⌘');
  if (modifiers?.shift) parts.push('Shift');

  // Format special keys
  let displayKey = key;
  if (key === 'escape' || key === 'esc') displayKey = 'Esc';
  if (key === 'enter' || key === 'return') displayKey = 'Enter';
  if (key === 'up' || key === 'upArrow') displayKey = '↑';
  if (key === 'down' || key === 'downArrow') displayKey = '↓';
  if (key === 'left' || key === 'leftArrow') displayKey = '←';
  if (key === 'right' || key === 'rightArrow') displayKey = '→';
  if (key === 'pageUp') displayKey = 'PgUp';
  if (key === 'pageDown') displayKey = 'PgDn';
  if (key.length === 1) displayKey = key.toUpperCase();

  parts.push(displayKey);
  return parts.join('+');
}

// Helper to parse key string like "ctrl+s" into key and modifiers
export function parseKeyString(keyString: string): { key: string; modifiers?: KeyModifiers } {
  const parts = keyString.toLowerCase().split('+');
  const modifiers: KeyModifiers = {};
  let key = '';

  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') {
      modifiers.ctrl = true;
    } else if (part === 'alt' || part === 'option') {
      modifiers.alt = true;
    } else if (part === 'meta' || part === 'cmd' || part === 'command') {
      modifiers.meta = true;
    } else if (part === 'shift') {
      modifiers.shift = true;
    } else {
      key = part;
    }
  }

  const hasModifiers = modifiers.ctrl || modifiers.alt || modifiers.meta || modifiers.shift;

  return {
    key,
    modifiers: hasModifiers ? modifiers : undefined,
  };
}

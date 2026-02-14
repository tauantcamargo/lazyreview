import { useMemo, useCallback } from 'react'
import { useConfig } from './useConfig'
import {
  mergeKeybindings,
  matchesAction as matchesActionFn,
  formatActionBindings,
} from '../config/keybindings'
import type { InkKey, KeybindingOverrides } from '../config/keybindings'

interface UseKeybindingsResult {
  /** Check if an input matches a specific action in the current context */
  readonly matchesAction: (
    input: string,
    key: Readonly<InkKey>,
    action: string,
  ) => boolean
  /** The merged keybindings for the current context */
  readonly bindings: Readonly<Record<string, string | readonly string[]>>
  /** Get a display string for an action's keybinding(s) */
  readonly getActionDisplay: (action: string) => string
  /** The keybinding overrides from user config (for passing to helpers) */
  readonly overrides: KeybindingOverrides | undefined
}

/**
 * Hook to access keybindings for a specific context.
 * Merges default keybindings with user overrides from config.
 *
 * @param context - The keybinding context (e.g. 'global', 'prList', 'prDetail')
 * @returns Keybinding helpers for the given context
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { matchesAction } = useKeybindings('prList')
 *
 *   useInput((input, key) => {
 *     if (matchesAction(input, key, 'filterPRs')) {
 *       setShowFilter(true)
 *     }
 *   })
 * }
 * ```
 */
export function useKeybindings(context: string): UseKeybindingsResult {
  const { config } = useConfig()

  const overrides = config?.keybindingOverrides as
    | KeybindingOverrides
    | undefined

  const bindings = useMemo(
    () => mergeKeybindings(context, overrides),
    [context, overrides],
  )

  const matchesAction = useCallback(
    (input: string, key: Readonly<InkKey>, action: string): boolean =>
      matchesActionFn(input, key, action, bindings),
    [bindings],
  )

  const getActionDisplay = useCallback(
    (action: string): string => {
      const binding = bindings[action]
      if (!binding) return ''
      return formatActionBindings(binding)
    },
    [bindings],
  )

  return { matchesAction, bindings, getActionDisplay, overrides }
}

import { useSyncExternalStore } from 'react'
import type { SelectionContext } from './useContextualHints'

type Listener = () => void

let current: SelectionContext | undefined = undefined
let listeners: readonly Listener[] = []

function notify(): void {
  listeners.forEach((l) => l())
}

export function subscribe(listener: Listener): () => void {
  listeners = [...listeners, listener]
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

export function getSelectionSnapshot(): SelectionContext | undefined {
  return current
}

/**
 * Set the current selection context. The StatusBar reads this to generate
 * context-aware hints. Call this from screens/tabs when the selected item
 * changes.
 */
export function setSelectionContext(
  context: SelectionContext | undefined,
): void {
  if (current !== context) {
    current = context
    notify()
  }
}

/**
 * Clear the selection context (e.g. when navigating away from a screen).
 */
export function clearSelectionContext(): void {
  setSelectionContext(undefined)
}

/**
 * React hook to read the current selection context.
 * Re-renders when the context changes.
 */
export function useSelectionContext(): SelectionContext | undefined {
  return useSyncExternalStore(subscribe, getSelectionSnapshot, () => undefined)
}

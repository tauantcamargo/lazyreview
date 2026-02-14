import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  createChecklistState,
  toggleItem as toggleItemPure,
  completionSummary,
  isComplete as isCompletePure,
  type ChecklistItem,
  type ChecklistState,
  type CompletionSummary,
} from '../models/review-checklist'

// ---------------------------------------------------------------------------
// In-memory persistence (designed for SQLite migration later)
// ---------------------------------------------------------------------------

/**
 * In-memory store keyed by PR key.
 * Maps PR key -> Map of item label -> checked boolean.
 */
const checklistStore = new Map<string, Map<string, boolean>>()

function loadPersistedState(
  prKey: string,
  items: readonly ChecklistItem[],
): ChecklistState {
  const persisted = checklistStore.get(prKey)
  if (!persisted) {
    return createChecklistState(items)
  }

  return {
    items: items.map((item) => ({
      label: item.label,
      description: item.description,
      checked: persisted.get(item.label) ?? false,
    })),
  }
}

function persistState(prKey: string, state: ChecklistState): void {
  const map = new Map<string, boolean>()
  for (const item of state.items) {
    map.set(item.label, item.checked)
  }
  checklistStore.set(prKey, map)
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseReviewChecklistResult {
  readonly state: ChecklistState
  readonly toggleItem: (index: number) => void
  readonly summary: CompletionSummary
  readonly isComplete: boolean
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook for managing a review checklist's state.
 *
 * Returns null if no checklist items are provided (undefined or empty array).
 * State is persisted in-memory per PR key, designed for later migration to SQLite.
 */
export function useReviewChecklist(
  checklist: readonly ChecklistItem[] | undefined,
  prKey: string,
): UseReviewChecklistResult | null {
  const hasChecklist = checklist !== undefined && checklist.length > 0

  const [state, setState] = useState<ChecklistState | null>(() => {
    if (!hasChecklist) return null
    return loadPersistedState(prKey, checklist)
  })

  // Re-initialize when PR key or checklist changes
  useEffect(() => {
    if (!hasChecklist) {
      setState(null)
      return
    }
    setState(loadPersistedState(prKey, checklist))
  }, [prKey, hasChecklist, checklist])

  // Persist state changes
  useEffect(() => {
    if (state && hasChecklist) {
      persistState(prKey, state)
    }
  }, [state, prKey, hasChecklist])

  const toggle = useCallback(
    (index: number) => {
      setState((prev) => {
        if (!prev) return prev
        return toggleItemPure(prev, index)
      })
    },
    [],
  )

  const summary = useMemo(
    () => (state ? completionSummary(state) : { checked: 0, total: 0, percent: 100 }),
    [state],
  )

  const complete = useMemo(
    () => (state ? isCompletePure(state) : true),
    [state],
  )

  if (!hasChecklist || !state) {
    return null
  }

  return {
    state,
    toggleItem: toggle,
    summary,
    isComplete: complete,
  }
}

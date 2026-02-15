import React, { createContext, useContext, useEffect, useState } from 'react'
import { createInMemoryStore } from './StateStore'
import type { StateStore } from './types'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const StateStoreContext = createContext<StateStore | null>(null)

// ---------------------------------------------------------------------------
// Provider props
// ---------------------------------------------------------------------------

interface StateProviderProps {
  /**
   * Optional pre-built StateStore instance. When provided the provider
   * will use it directly (useful for testing). When omitted the provider
   * creates an in-memory store as a safe fallback.
   */
  readonly store?: StateStore
  readonly children: React.ReactNode
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Wraps the component tree with a StateStore that persists viewed files,
 * read state, bookmarked repos and recent repos to SQLite.
 *
 * If `store` is provided (e.g. an already-opened file-backed store) it is
 * used directly. Otherwise an in-memory fallback is created and opened on
 * mount.
 */
export function StateProvider({
  store: externalStore,
  children,
}: StateProviderProps): React.ReactElement {
  const [store, setStore] = useState<StateStore | null>(externalStore ?? null)

  useEffect(() => {
    // If an external store was provided, use it as-is (assume already open)
    if (externalStore) {
      setStore(externalStore)
      return
    }

    // Create an in-memory fallback
    let cancelled = false
    const fallback = createInMemoryStore()

    fallback
      .open()
      .then(() => {
        if (!cancelled) {
          setStore(fallback)
        }
      })
      .catch(() => {
        // If even in-memory fails, store stays null — hooks degrade gracefully
      })

    return () => {
      cancelled = true
      fallback.close()
    }
  }, [externalStore])

  return React.createElement(
    StateStoreContext.Provider,
    { value: store },
    children,
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the StateStore from context.
 * Returns `null` when the store is not yet initialised (or failed to open).
 * Consumers should handle the null case gracefully.
 */
export function useStateStore(): StateStore | null {
  return useContext(StateStoreContext)
}

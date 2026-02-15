import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render } from 'ink-testing-library'
import { Text } from 'ink'
import { StateProvider, useStateStore } from '../StateProvider'
import { createInMemoryStore } from '../StateStore'
import type { StateStore } from '../types'

// ---------------------------------------------------------------------------
// Test component that exposes the store
// ---------------------------------------------------------------------------

function StoreStatus(): React.ReactElement {
  const store = useStateStore()
  return React.createElement(Text, null, store ? 'store-ready' : 'store-null')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StateProvider', () => {
  let store: StateStore

  beforeEach(async () => {
    store = createInMemoryStore()
    await store.open()
  })

  afterEach(() => {
    store.close()
  })

  it('provides an external store to children', () => {
    const { lastFrame } = render(
      React.createElement(
        StateProvider,
        { store },
        React.createElement(StoreStatus),
      ),
    )

    expect(lastFrame()).toContain('store-ready')
  })

  it('returns null from useStateStore when no provider wraps the tree', () => {
    const { lastFrame } = render(React.createElement(StoreStatus))
    expect(lastFrame()).toContain('store-null')
  })

  it('provides store to deeply nested children', () => {
    function DeepChild(): React.ReactElement {
      const s = useStateStore()
      if (!s) return React.createElement(Text, null, 'no-store')
      s.setKV('test-key', 'test-value')
      const val = s.getKV('test-key')
      return React.createElement(Text, null, `kv:${val}`)
    }

    const { lastFrame } = render(
      React.createElement(
        StateProvider,
        { store },
        React.createElement(DeepChild),
      ),
    )

    expect(lastFrame()).toContain('kv:test-value')
  })

  it('allows using StateStore methods through the provider', () => {
    function ViewedFilesChild(): React.ReactElement {
      const s = useStateStore()
      if (!s) return React.createElement(Text, null, 'no-store')

      s.setViewedFile('pr-1', 'src/foo.ts')
      const files = s.getViewedFiles('pr-1')
      return React.createElement(Text, null, `files:${files.length}`)
    }

    const { lastFrame } = render(
      React.createElement(
        StateProvider,
        { store },
        React.createElement(ViewedFilesChild),
      ),
    )

    expect(lastFrame()).toContain('files:1')
  })

  it('falls back to in-memory store when no external store is provided', async () => {
    // When no store prop, StateProvider creates an in-memory fallback
    // We need to wait for the async open() to complete
    const { lastFrame, rerender } = render(
      React.createElement(
        StateProvider,
        null,
        React.createElement(StoreStatus),
      ),
    )

    // Initially might be null while async open is pending
    // After a tick it should be ready
    await new Promise((resolve) => setTimeout(resolve, 100))

    rerender(
      React.createElement(
        StateProvider,
        null,
        React.createElement(StoreStatus),
      ),
    )

    expect(lastFrame()).toContain('store-ready')
  })
})

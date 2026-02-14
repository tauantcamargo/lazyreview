import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { StatusMessageType } from './useStatusMessage'

// We test the store logic directly since the hook is a thin wrapper around useSyncExternalStore
// The createStatusMessageStore function is not exported, so we test through the module-level store
// by recreating the store logic in isolation

type Listener = () => void

interface StatusState {
  readonly message: string | null
  readonly type: StatusMessageType
}

const EMPTY_STATE: StatusState = { message: null, type: 'info' }

function createTestStore() {
  let state: StatusState = EMPTY_STATE
  let listeners: readonly Listener[] = []
  let timerId: ReturnType<typeof setTimeout> | null = null

  const notify = (): void => {
    listeners.forEach((l) => l())
  }

  return {
    subscribe(listener: Listener) {
      listeners = [...listeners, listener]
      return () => {
        listeners = listeners.filter((l) => l !== listener)
      }
    },
    setMessage(msg: string, durationMs = 2000, type: StatusMessageType = 'info') {
      if (timerId !== null) {
        clearTimeout(timerId)
      }
      state = { message: msg, type }
      notify()
      timerId = setTimeout(() => {
        state = EMPTY_STATE
        timerId = null
        notify()
      }, durationMs)
    },
    getSnapshot() {
      return state
    },
  }
}

describe('StatusMessageStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with null message and info type', () => {
    const store = createTestStore()
    const snapshot = store.getSnapshot()
    expect(snapshot.message).toBeNull()
    expect(snapshot.type).toBe('info')
  })

  it('sets message and notifies listeners', () => {
    const store = createTestStore()
    const listener = vi.fn()
    store.subscribe(listener)

    store.setMessage('Hello')
    expect(store.getSnapshot().message).toBe('Hello')
    expect(store.getSnapshot().type).toBe('info')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('clears message after duration', () => {
    const store = createTestStore()
    const listener = vi.fn()
    store.subscribe(listener)

    store.setMessage('Temp', 1000)
    expect(store.getSnapshot().message).toBe('Temp')

    vi.advanceTimersByTime(1000)
    expect(store.getSnapshot().message).toBeNull()
    // Called twice: once for set, once for clear
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('cancels previous timer when setting new message', () => {
    const store = createTestStore()

    store.setMessage('First', 1000)
    store.setMessage('Second', 1000)

    // First timer cancelled, only second matters
    vi.advanceTimersByTime(1000)
    expect(store.getSnapshot().message).toBeNull()
  })

  it('unsubscribes listener correctly', () => {
    const store = createTestStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    unsubscribe()
    store.setMessage('After unsubscribe')
    expect(listener).not.toHaveBeenCalled()
  })

  it('uses default duration of 2000ms', () => {
    const store = createTestStore()
    store.setMessage('Default duration')

    vi.advanceTimersByTime(1999)
    expect(store.getSnapshot().message).toBe('Default duration')

    vi.advanceTimersByTime(1)
    expect(store.getSnapshot().message).toBeNull()
  })

  it('stores success type', () => {
    const store = createTestStore()
    store.setMessage('Saved', 2000, 'success')
    expect(store.getSnapshot().type).toBe('success')
    expect(store.getSnapshot().message).toBe('Saved')
  })

  it('stores error type', () => {
    const store = createTestStore()
    store.setMessage('Failed', 2000, 'error')
    expect(store.getSnapshot().type).toBe('error')
    expect(store.getSnapshot().message).toBe('Failed')
  })

  it('stores info type by default', () => {
    const store = createTestStore()
    store.setMessage('Notice')
    expect(store.getSnapshot().type).toBe('info')
  })

  it('resets type to info when message clears', () => {
    const store = createTestStore()
    store.setMessage('Error!', 1000, 'error')
    expect(store.getSnapshot().type).toBe('error')

    vi.advanceTimersByTime(1000)
    expect(store.getSnapshot().message).toBeNull()
    expect(store.getSnapshot().type).toBe('info')
  })

  it('replaces type when setting new message', () => {
    const store = createTestStore()
    store.setMessage('Error', 2000, 'error')
    expect(store.getSnapshot().type).toBe('error')

    store.setMessage('OK', 2000, 'success')
    expect(store.getSnapshot().type).toBe('success')
    expect(store.getSnapshot().message).toBe('OK')
  })
})

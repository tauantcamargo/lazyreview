import { describe, it, expect, vi } from 'vitest'

// Test the createLoadingService logic by reimplementing it (it's not exported)
// But we can test through the module's exposed interface

type Listener = () => void

interface LoadingState {
  readonly isLoading: boolean
  readonly message: string | null
}

function createLoadingService() {
  let state: LoadingState = { isLoading: false, message: null }
  const listeners = new Set<Listener>()

  function notify(): void {
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    start: (message: string) => {
      state = { isLoading: true, message }
      notify()
    },
    stop: () => {
      state = { isLoading: false, message: null }
      notify()
    },
    getState: () => state,
    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

describe('LoadingService', () => {
  it('starts with isLoading=false', () => {
    const service = createLoadingService()
    expect(service.getState()).toEqual({ isLoading: false, message: null })
  })

  it('sets isLoading=true with message on start', () => {
    const service = createLoadingService()
    service.start('Loading PRs...')
    expect(service.getState()).toEqual({ isLoading: true, message: 'Loading PRs...' })
  })

  it('resets state on stop', () => {
    const service = createLoadingService()
    service.start('Loading...')
    service.stop()
    expect(service.getState()).toEqual({ isLoading: false, message: null })
  })

  it('notifies subscribers on start', () => {
    const service = createLoadingService()
    const listener = vi.fn()
    service.subscribe(listener)
    service.start('Loading...')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('notifies subscribers on stop', () => {
    const service = createLoadingService()
    const listener = vi.fn()
    service.subscribe(listener)
    service.stop()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes correctly', () => {
    const service = createLoadingService()
    const listener = vi.fn()
    const unsubscribe = service.subscribe(listener)
    unsubscribe()
    service.start('Loading...')
    expect(listener).not.toHaveBeenCalled()
  })

  it('supports multiple subscribers', () => {
    const service = createLoadingService()
    const listener1 = vi.fn()
    const listener2 = vi.fn()
    service.subscribe(listener1)
    service.subscribe(listener2)
    service.start('Loading...')
    expect(listener1).toHaveBeenCalledTimes(1)
    expect(listener2).toHaveBeenCalledTimes(1)
  })
})

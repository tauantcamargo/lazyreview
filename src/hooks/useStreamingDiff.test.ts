import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FileChange } from '../models/file-change'

// Test the streaming logic directly as a pure state machine,
// mirroring the approach used by useStatusMessage.test.ts

function makeFile(filename: string): FileChange {
  return {
    sha: 'abc123',
    filename,
    status: 'modified',
    additions: 10,
    deletions: 5,
    changes: 15,
  } as FileChange
}

function makeFiles(count: number): readonly FileChange[] {
  return Array.from({ length: count }, (_, i) => makeFile(`file-${i}.ts`))
}

interface StreamingState {
  readonly visibleFiles: readonly FileChange[]
  readonly isStreaming: boolean
  readonly progress: {
    readonly loaded: number
    readonly total: number
    readonly percent: number
  }
  readonly totalCount: number
}

/**
 * Pure streaming state machine used by the hook.
 * Reproduces the logic for testability without React.
 */
function createStreamingController(
  files: readonly FileChange[],
  chunkSize: number = 10,
  delayMs: number = 16,
) {
  let currentChunkIndex = 0
  let timerId: ReturnType<typeof setTimeout> | null = null
  let cancelled = false
  let listeners: readonly (() => void)[] = []

  const effectiveSize = Math.max(1, chunkSize)
  const totalChunks = files.length === 0 ? 0 : Math.ceil(files.length / effectiveSize)

  const notify = () => {
    listeners.forEach((l) => l())
  }

  const getState = (): StreamingState => {
    const loadedCount = Math.min(currentChunkIndex * effectiveSize, files.length)
    const visibleFiles = files.slice(0, loadedCount)
    const isStreaming = currentChunkIndex < totalChunks
    const total = files.length
    const percent = total === 0 ? 100 : Math.round((loadedCount / total) * 100)

    return {
      visibleFiles,
      isStreaming,
      progress: { loaded: loadedCount, total, percent },
      totalCount: total,
    }
  }

  const scheduleNext = () => {
    if (cancelled || currentChunkIndex >= totalChunks) return
    timerId = setTimeout(() => {
      if (cancelled) return
      currentChunkIndex++
      notify()
      if (currentChunkIndex < totalChunks) {
        scheduleNext()
      }
    }, delayMs)
  }

  const start = () => {
    if (files.length === 0) {
      currentChunkIndex = 0
      return
    }
    // First chunk is immediately available
    currentChunkIndex = 1
    notify()
    scheduleNext()
  }

  const cancel = () => {
    cancelled = true
    if (timerId !== null) {
      clearTimeout(timerId)
      timerId = null
    }
  }

  const subscribe = (listener: () => void) => {
    listeners = [...listeners, listener]
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }

  return { getState, start, cancel, subscribe }
}

describe('streaming diff controller', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('empty file list', () => {
    it('is not streaming with empty files', () => {
      const ctrl = createStreamingController([])
      ctrl.start()
      const state = ctrl.getState()
      expect(state.visibleFiles).toEqual([])
      expect(state.isStreaming).toBe(false)
      expect(state.totalCount).toBe(0)
      expect(state.progress.percent).toBe(100)
    })
  })

  describe('files fewer than chunk size', () => {
    it('loads all files in the first chunk immediately', () => {
      const files = makeFiles(5)
      const ctrl = createStreamingController(files, 10)
      ctrl.start()
      const state = ctrl.getState()
      expect(state.visibleFiles).toHaveLength(5)
      expect(state.isStreaming).toBe(false)
      expect(state.progress.loaded).toBe(5)
      expect(state.progress.total).toBe(5)
      expect(state.progress.percent).toBe(100)
    })
  })

  describe('progressive reveal', () => {
    it('shows first chunk immediately, then reveals subsequent chunks on timer', () => {
      const files = makeFiles(25)
      const ctrl = createStreamingController(files, 10, 16)
      ctrl.start()

      // First chunk loaded immediately
      let state = ctrl.getState()
      expect(state.visibleFiles).toHaveLength(10)
      expect(state.isStreaming).toBe(true)
      expect(state.progress.loaded).toBe(10)
      expect(state.progress.percent).toBe(40)

      // Advance timer for second chunk
      vi.advanceTimersByTime(16)
      state = ctrl.getState()
      expect(state.visibleFiles).toHaveLength(20)
      expect(state.isStreaming).toBe(true)
      expect(state.progress.loaded).toBe(20)
      expect(state.progress.percent).toBe(80)

      // Advance timer for third (final) chunk
      vi.advanceTimersByTime(16)
      state = ctrl.getState()
      expect(state.visibleFiles).toHaveLength(25)
      expect(state.isStreaming).toBe(false)
      expect(state.progress.loaded).toBe(25)
      expect(state.progress.percent).toBe(100)
    })

    it('handles exact multiples of chunk size', () => {
      const files = makeFiles(20)
      const ctrl = createStreamingController(files, 10, 16)
      ctrl.start()

      let state = ctrl.getState()
      expect(state.visibleFiles).toHaveLength(10)
      expect(state.isStreaming).toBe(true)

      vi.advanceTimersByTime(16)
      state = ctrl.getState()
      expect(state.visibleFiles).toHaveLength(20)
      expect(state.isStreaming).toBe(false)
      expect(state.progress.percent).toBe(100)
    })

    it('notifies listeners on each chunk load', () => {
      const files = makeFiles(25)
      const ctrl = createStreamingController(files, 10, 16)
      const listener = vi.fn()
      ctrl.subscribe(listener)
      ctrl.start()

      // First chunk triggers notify
      expect(listener).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(16)
      expect(listener).toHaveBeenCalledTimes(2)

      vi.advanceTimersByTime(16)
      expect(listener).toHaveBeenCalledTimes(3)
    })
  })

  describe('cancellation', () => {
    it('stops loading when cancelled', () => {
      const files = makeFiles(30)
      const ctrl = createStreamingController(files, 10, 16)
      const listener = vi.fn()
      ctrl.subscribe(listener)
      ctrl.start()

      // First chunk loaded
      expect(ctrl.getState().visibleFiles).toHaveLength(10)

      // Cancel before second chunk
      ctrl.cancel()
      vi.advanceTimersByTime(100)

      // State stays at first chunk
      expect(ctrl.getState().visibleFiles).toHaveLength(10)
      // Only the initial notify was called
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('does nothing if cancelled before start', () => {
      const files = makeFiles(30)
      const ctrl = createStreamingController(files, 10, 16)
      ctrl.cancel()
      ctrl.start()
      vi.advanceTimersByTime(100)
      // First chunk is loaded synchronously in start, but no more
      expect(ctrl.getState().visibleFiles).toHaveLength(10)
    })
  })

  describe('progress calculation', () => {
    it('reports accurate progress at each step', () => {
      const files = makeFiles(40)
      const ctrl = createStreamingController(files, 10, 16)
      ctrl.start()

      const expectedSteps = [
        { loaded: 10, percent: 25 },
        { loaded: 20, percent: 50 },
        { loaded: 30, percent: 75 },
        { loaded: 40, percent: 100 },
      ]

      expectedSteps.forEach((expected, i) => {
        const state = ctrl.getState()
        expect(state.progress.loaded).toBe(expected.loaded)
        expect(state.progress.percent).toBe(expected.percent)
        expect(state.progress.total).toBe(40)
        if (i < expectedSteps.length - 1) {
          vi.advanceTimersByTime(16)
        }
      })
    })
  })

  describe('custom chunk size', () => {
    it('respects chunk size of 5', () => {
      const files = makeFiles(12)
      const ctrl = createStreamingController(files, 5, 16)
      ctrl.start()

      expect(ctrl.getState().visibleFiles).toHaveLength(5)

      vi.advanceTimersByTime(16)
      expect(ctrl.getState().visibleFiles).toHaveLength(10)

      vi.advanceTimersByTime(16)
      expect(ctrl.getState().visibleFiles).toHaveLength(12)
      expect(ctrl.getState().isStreaming).toBe(false)
    })
  })

  describe('custom delay', () => {
    it('respects custom delay between chunks', () => {
      const files = makeFiles(20)
      const ctrl = createStreamingController(files, 10, 50)
      ctrl.start()

      expect(ctrl.getState().visibleFiles).toHaveLength(10)

      // Not enough time yet
      vi.advanceTimersByTime(30)
      expect(ctrl.getState().visibleFiles).toHaveLength(10)

      // Now the delay has passed
      vi.advanceTimersByTime(20)
      expect(ctrl.getState().visibleFiles).toHaveLength(20)
    })
  })

  describe('unsubscribe', () => {
    it('stops notifying after unsubscribe', () => {
      const files = makeFiles(30)
      const ctrl = createStreamingController(files, 10, 16)
      const listener = vi.fn()
      const unsubscribe = ctrl.subscribe(listener)
      ctrl.start()

      expect(listener).toHaveBeenCalledTimes(1)
      unsubscribe()

      vi.advanceTimersByTime(16)
      // Listener not called again after unsubscribe
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe('totalCount', () => {
    it('always reflects the total file count', () => {
      const files = makeFiles(15)
      const ctrl = createStreamingController(files, 10, 16)
      ctrl.start()

      expect(ctrl.getState().totalCount).toBe(15)
      vi.advanceTimersByTime(16)
      expect(ctrl.getState().totalCount).toBe(15)
    })
  })

  describe('single file', () => {
    it('loads immediately with no streaming', () => {
      const files = makeFiles(1)
      const ctrl = createStreamingController(files, 10, 16)
      ctrl.start()

      const state = ctrl.getState()
      expect(state.visibleFiles).toHaveLength(1)
      expect(state.isStreaming).toBe(false)
      expect(state.progress.percent).toBe(100)
    })
  })
})

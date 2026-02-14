import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import { createCoalescer } from './request-coalescer'

describe('createCoalescer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('concurrent identical calls produce one execution', async () => {
    let executionCount = 0
    const coalescer = createCoalescer<string>()

    const effect = Effect.promise(async () => {
      executionCount += 1
      return 'result'
    })

    const [r1, r2, r3] = await Promise.all([
      Effect.runPromise(coalescer.coalesce('key-a', effect)),
      Effect.runPromise(coalescer.coalesce('key-a', effect)),
      Effect.runPromise(coalescer.coalesce('key-a', effect)),
    ])

    expect(executionCount).toBe(1)
    expect(r1).toBe('result')
    expect(r2).toBe('result')
    expect(r3).toBe('result')
  })

  it('different keys produce separate executions', async () => {
    let executionCount = 0
    const coalescer = createCoalescer<string>()

    const makeEffect = (value: string) =>
      Effect.promise(async () => {
        executionCount += 1
        return value
      })

    const [r1, r2] = await Promise.all([
      Effect.runPromise(coalescer.coalesce('key-a', makeEffect('a'))),
      Effect.runPromise(coalescer.coalesce('key-b', makeEffect('b'))),
    ])

    expect(executionCount).toBe(2)
    expect(r1).toBe('a')
    expect(r2).toBe('b')
  })

  it('expired entries trigger fresh execution', async () => {
    let executionCount = 0
    const coalescer = createCoalescer<string>({ windowMs: 100 })

    const effect = Effect.promise(async () => {
      executionCount += 1
      return `result-${executionCount}`
    })

    const r1 = await Effect.runPromise(coalescer.coalesce('key-a', effect))
    expect(r1).toBe('result-1')
    expect(executionCount).toBe(1)

    // Advance past the window
    await vi.advanceTimersByTimeAsync(150)

    const r2 = await Effect.runPromise(coalescer.coalesce('key-a', effect))
    expect(r2).toBe('result-2')
    expect(executionCount).toBe(2)
  })

  it('error results are shared across all callers', async () => {
    let executionCount = 0
    const coalescer = createCoalescer<string>()

    const failingEffect = Effect.promise(async () => {
      executionCount += 1
      throw new Error('shared failure')
    })

    const results = await Promise.allSettled([
      Effect.runPromise(coalescer.coalesce('key-a', failingEffect)),
      Effect.runPromise(coalescer.coalesce('key-a', failingEffect)),
      Effect.runPromise(coalescer.coalesce('key-a', failingEffect)),
    ])

    expect(executionCount).toBe(1)
    for (const result of results) {
      expect(result.status).toBe('rejected')
    }
  })

  it('cleanup after windowMs removes entries (no memory leak)', async () => {
    const coalescer = createCoalescer<string>({ windowMs: 50 })

    const effect = Effect.succeed('value')

    await Effect.runPromise(coalescer.coalesce('key-a', effect))

    // Entry exists during window
    expect(coalescer.size()).toBe(1)

    // Advance past the cleanup window
    await vi.advanceTimersByTimeAsync(60)

    expect(coalescer.size()).toBe(0)
  })

  it('custom windowMs works', async () => {
    let executionCount = 0
    const coalescer = createCoalescer<string>({ windowMs: 500 })

    const effect = Effect.promise(async () => {
      executionCount += 1
      return `result-${executionCount}`
    })

    const r1 = await Effect.runPromise(coalescer.coalesce('key-a', effect))
    expect(r1).toBe('result-1')

    // Still within the 500ms window
    await vi.advanceTimersByTimeAsync(300)

    const r2 = await Effect.runPromise(coalescer.coalesce('key-a', effect))
    // Should still get the cached result
    expect(r2).toBe('result-1')
    expect(executionCount).toBe(1)

    // Advance past the window
    await vi.advanceTimersByTimeAsync(250)

    const r3 = await Effect.runPromise(coalescer.coalesce('key-a', effect))
    expect(r3).toBe('result-2')
    expect(executionCount).toBe(2)
  })

  it('successive calls within window share result', async () => {
    let executionCount = 0
    const coalescer = createCoalescer<number>({ windowMs: 200 })

    const effect = Effect.promise(async () => {
      executionCount += 1
      return executionCount
    })

    const r1 = await Effect.runPromise(coalescer.coalesce('key-a', effect))
    expect(r1).toBe(1)

    // Call again within window
    await vi.advanceTimersByTimeAsync(50)
    const r2 = await Effect.runPromise(coalescer.coalesce('key-a', effect))
    expect(r2).toBe(1)

    // Call again still within window
    await vi.advanceTimersByTimeAsync(50)
    const r3 = await Effect.runPromise(coalescer.coalesce('key-a', effect))
    expect(r3).toBe(1)

    expect(executionCount).toBe(1)
  })

  it('calls after window expires get fresh result', async () => {
    let executionCount = 0
    const coalescer = createCoalescer<number>({ windowMs: 100 })

    const effect = Effect.promise(async () => {
      executionCount += 1
      return executionCount * 10
    })

    const r1 = await Effect.runPromise(coalescer.coalesce('key-a', effect))
    expect(r1).toBe(10)

    // First window expires
    await vi.advanceTimersByTimeAsync(110)

    const r2 = await Effect.runPromise(coalescer.coalesce('key-a', effect))
    expect(r2).toBe(20)

    // Second window expires
    await vi.advanceTimersByTimeAsync(110)

    const r3 = await Effect.runPromise(coalescer.coalesce('key-a', effect))
    expect(r3).toBe(30)

    expect(executionCount).toBe(3)
  })

  it('handles multiple keys with independent lifecycles', async () => {
    let countA = 0
    let countB = 0
    const coalescer = createCoalescer<string>({ windowMs: 100 })

    const effectA = Effect.promise(async () => {
      countA += 1
      return `a-${countA}`
    })

    const effectB = Effect.promise(async () => {
      countB += 1
      return `b-${countB}`
    })

    // Both keys fetched concurrently
    const [r1a, r1b] = await Promise.all([
      Effect.runPromise(coalescer.coalesce('key-a', effectA)),
      Effect.runPromise(coalescer.coalesce('key-b', effectB)),
    ])

    expect(r1a).toBe('a-1')
    expect(r1b).toBe('b-1')

    // Expire key-a only (advance 110ms total from start)
    await vi.advanceTimersByTimeAsync(110)

    // key-a should re-execute, key-b should also have expired
    const r2a = await Effect.runPromise(coalescer.coalesce('key-a', effectA))
    expect(r2a).toBe('a-2')
    expect(countA).toBe(2)
  })

  it('in-flight deduplication still works while promise is pending', async () => {
    let executionCount = 0
    let resolvePromise: ((value: string) => void) | undefined
    const coalescer = createCoalescer<string>()

    const slowEffect = Effect.promise(
      () =>
        new Promise<string>((resolve) => {
          executionCount += 1
          resolvePromise = resolve
        }),
    )

    // Start three concurrent requests
    const p1 = Effect.runPromise(coalescer.coalesce('key-a', slowEffect))
    const p2 = Effect.runPromise(coalescer.coalesce('key-a', slowEffect))
    const p3 = Effect.runPromise(coalescer.coalesce('key-a', slowEffect))

    // Promise is still pending
    expect(executionCount).toBe(1)

    // Resolve the shared promise
    resolvePromise!('delayed-result')

    const [r1, r2, r3] = await Promise.all([p1, p2, p3])

    expect(r1).toBe('delayed-result')
    expect(r2).toBe('delayed-result')
    expect(r3).toBe('delayed-result')
    expect(executionCount).toBe(1)
  })

  it('uses default windowMs of 100 when no options provided', async () => {
    let executionCount = 0
    const coalescer = createCoalescer<string>()

    const effect = Effect.promise(async () => {
      executionCount += 1
      return `result-${executionCount}`
    })

    const r1 = await Effect.runPromise(coalescer.coalesce('key-a', effect))
    expect(r1).toBe('result-1')

    // Within default 100ms window
    await vi.advanceTimersByTimeAsync(50)
    const r2 = await Effect.runPromise(coalescer.coalesce('key-a', effect))
    expect(r2).toBe('result-1')

    // Past default 100ms window
    await vi.advanceTimersByTimeAsync(60)
    const r3 = await Effect.runPromise(coalescer.coalesce('key-a', effect))
    expect(r3).toBe('result-2')

    expect(executionCount).toBe(2)
  })
})

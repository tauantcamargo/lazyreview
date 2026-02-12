import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDebouncedWriter } from './debouncedWriter'

const mockMkdir = vi.fn(() => Promise.resolve())
const mockWriteFile = vi.fn(() => Promise.resolve())
const mockMkdirSync = vi.fn()
const mockWriteFileSync = vi.fn()

vi.mock('node:fs/promises', () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

vi.mock('node:fs', () => ({
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
}))

describe('createDebouncedWriter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not write immediately on schedule', () => {
    const writer = createDebouncedWriter<{ value: number }>('/tmp/test.json')
    writer.schedule({ value: 1 })
    expect(mockMkdir).not.toHaveBeenCalled()
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('writes after debounce period', async () => {
    const writer = createDebouncedWriter<{ value: number }>('/tmp/test.json')
    writer.schedule({ value: 1 })
    vi.advanceTimersByTime(300)
    expect(mockMkdir).toHaveBeenCalledWith('/tmp', { recursive: true })
  })

  it('debounces multiple rapid writes', () => {
    const writer = createDebouncedWriter<{ value: number }>('/tmp/test.json')
    writer.schedule({ value: 1 })
    vi.advanceTimersByTime(100)
    writer.schedule({ value: 2 })
    vi.advanceTimersByTime(100)
    writer.schedule({ value: 3 })
    vi.advanceTimersByTime(300)

    // Only one async write should have happened (the last value)
    expect(mockMkdir).toHaveBeenCalledTimes(1)
  })

  it('flush writes synchronously', () => {
    const writer = createDebouncedWriter<{ value: number }>('/tmp/test.json')
    writer.schedule({ value: 42 })
    writer.flush()

    expect(mockMkdirSync).toHaveBeenCalledWith('/tmp', { recursive: true })
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/tmp/test.json',
      JSON.stringify({ value: 42 }, null, 2),
      'utf-8',
    )
  })

  it('flush clears pending timer', () => {
    const writer = createDebouncedWriter<{ value: number }>('/tmp/test.json')
    writer.schedule({ value: 1 })
    writer.flush()

    // After flush, advancing timer should not trigger another write
    vi.clearAllMocks()
    vi.advanceTimersByTime(500)
    expect(mockMkdir).not.toHaveBeenCalled()
  })

  it('flush is no-op when nothing is pending', () => {
    const writer = createDebouncedWriter<{ value: number }>('/tmp/test.json')
    writer.flush()

    expect(mockMkdirSync).not.toHaveBeenCalled()
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })

  it('flush after timer fires is no-op', () => {
    const writer = createDebouncedWriter<{ value: number }>('/tmp/test.json')
    writer.schedule({ value: 1 })
    vi.advanceTimersByTime(300)

    // Timer already fired, flush should be no-op
    writer.flush()
    expect(mockMkdirSync).not.toHaveBeenCalled()
  })

  it('writes latest data when debounced', () => {
    const writer = createDebouncedWriter<{ value: number }>('/tmp/test.json')
    writer.schedule({ value: 1 })
    writer.schedule({ value: 2 })
    writer.schedule({ value: 3 })
    writer.flush()

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/tmp/test.json',
      JSON.stringify({ value: 3 }, null, 2),
      'utf-8',
    )
  })
})

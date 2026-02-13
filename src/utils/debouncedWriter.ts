import { mkdir, writeFile } from 'node:fs/promises'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const DEBOUNCE_MS = 300

export interface DebouncedWriter<T> {
  readonly schedule: (data: T) => void
  readonly flush: () => void
}

/**
 * Creates a debounced file writer that batches rapid writes.
 * Uses async I/O for normal writes and sync I/O for the exit flush.
 */
export function createDebouncedWriter<T>(filePath: string): DebouncedWriter<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingData: T | null = null

  const writeAsync = (data: T): void => {
    const dir = dirname(filePath)
    mkdir(dir, { recursive: true, mode: 0o700 })
      .then(() => writeFile(filePath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 }))
      .catch(() => {
        // Silently fail on write errors
      })
  }

  const writeSync = (data: T): void => {
    try {
      const dir = dirname(filePath)
      mkdirSync(dir, { recursive: true, mode: 0o700 })
      writeFileSync(filePath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 })
    } catch {
      // Silently fail on write errors
    }
  }

  const flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (pendingData !== null) {
      writeSync(pendingData)
      pendingData = null
    }
  }

  // Register exit handler to prevent data loss
  process.on('exit', flush)

  const schedule = (data: T): void => {
    pendingData = data
    if (timer !== null) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      timer = null
      if (pendingData !== null) {
        const toWrite = pendingData
        pendingData = null
        writeAsync(toWrite)
      }
    }, DEBOUNCE_MS)
  }

  return { schedule, flush }
}

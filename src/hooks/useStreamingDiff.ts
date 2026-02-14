/**
 * React hook for progressive/streaming diff loading.
 * Takes a full file list and reveals files in chunks over time
 * so that large PRs render incrementally rather than blocking.
 */

import { useState, useEffect, useRef } from 'react'
import type { FileChange } from '../models/file-change'
import { computeProgress, DEFAULT_CHUNK_SIZE } from '../utils/streaming-diff'
import type { StreamingProgress } from '../utils/streaming-diff'

/** Options for the useStreamingDiff hook. */
export interface UseStreamingDiffOptions {
  /** Number of files per chunk (default: 10). */
  readonly chunkSize?: number
  /** Delay in ms between chunk reveals (default: 16, approx one frame). */
  readonly delayMs?: number
  /** Whether streaming is enabled (default: true). Set false to show all files immediately. */
  readonly enabled?: boolean
}

/** Return type of the useStreamingDiff hook. */
export interface UseStreamingDiffResult {
  /** Files currently visible (grows progressively). */
  readonly visibleFiles: readonly FileChange[]
  /** Whether more chunks are pending. */
  readonly isStreaming: boolean
  /** Loading progress with loaded/total/percent. */
  readonly progress: StreamingProgress
  /** Total number of files. */
  readonly totalCount: number
}

/**
 * Progressively reveal files from a full file list in chunks.
 * First chunk is shown immediately; subsequent chunks are revealed
 * via setTimeout to avoid blocking the render loop.
 *
 * @param files - Full list of file changes
 * @param options - Streaming configuration
 * @returns Streaming state with visible files and progress
 */
export function useStreamingDiff(
  files: readonly FileChange[],
  options: UseStreamingDiffOptions = {},
): UseStreamingDiffResult {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    delayMs = 16,
    enabled = true,
  } = options

  const effectiveSize = Math.max(1, chunkSize)
  const [loadedCount, setLoadedCount] = useState(() => {
    if (!enabled || files.length === 0) return files.length
    return Math.min(effectiveSize, files.length)
  })

  // Track the files identity to detect when the prop changes
  const filesRef = useRef(files)

  useEffect(() => {
    // Reset when files change or streaming is toggled
    if (filesRef.current !== files) {
      filesRef.current = files
    }

    if (!enabled || files.length === 0) {
      setLoadedCount(files.length)
      return
    }

    // Show first chunk immediately
    const firstChunkEnd = Math.min(effectiveSize, files.length)
    setLoadedCount(firstChunkEnd)

    if (firstChunkEnd >= files.length) {
      return
    }

    // Schedule remaining chunks
    let currentEnd = firstChunkEnd
    let timerId: ReturnType<typeof setTimeout> | null = null

    const scheduleNext = () => {
      timerId = setTimeout(() => {
        currentEnd = Math.min(currentEnd + effectiveSize, files.length)
        setLoadedCount(currentEnd)

        if (currentEnd < files.length) {
          scheduleNext()
        }
      }, delayMs)
    }

    scheduleNext()

    // Cleanup: cancel any pending timer on unmount or files change
    return () => {
      if (timerId !== null) {
        clearTimeout(timerId)
      }
    }
  }, [files, effectiveSize, delayMs, enabled])

  const visibleFiles = files.slice(0, loadedCount)
  const isStreaming = enabled && loadedCount < files.length
  const progress = computeProgress(loadedCount, files.length)

  return {
    visibleFiles,
    isStreaming,
    progress,
    totalCount: files.length,
  }
}

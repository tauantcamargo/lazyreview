/**
 * Pure utility functions for streaming/progressive diff loading.
 * Splits large file lists into chunks for incremental rendering.
 */

import type { FileChange } from '../models/file-change'

/** Default number of files per chunk. */
export const DEFAULT_CHUNK_SIZE = 10

/** Progress information for streaming diff loading. */
export interface StreamingProgress {
  readonly loaded: number
  readonly total: number
  readonly percent: number
}

/**
 * Split a list of files into fixed-size chunks for progressive loading.
 * Returns an array of chunks, each containing up to `chunkSize` files.
 * The original array is never mutated.
 *
 * @param files - The full list of file changes
 * @param chunkSize - Number of files per chunk (default: 10)
 * @returns Array of readonly file chunks
 */
export function createDiffChunks(
  files: readonly FileChange[],
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): readonly (readonly FileChange[])[] {
  if (files.length === 0) return []

  const effectiveSize = Math.max(1, chunkSize)
  const chunkCount = Math.ceil(files.length / effectiveSize)
  const chunks: (readonly FileChange[])[] = []

  for (let i = 0; i < chunkCount; i++) {
    const start = i * effectiveSize
    const end = Math.min(start + effectiveSize, files.length)
    chunks.push(files.slice(start, end))
  }

  return chunks
}

/**
 * Compute progress information for streaming diff loading.
 * Clamps loaded to total to prevent overflow.
 *
 * @param loaded - Number of files loaded so far
 * @param total - Total number of files
 * @returns Progress object with loaded, total, and percent
 */
export function computeProgress(
  loaded: number,
  total: number,
): StreamingProgress {
  if (total === 0) {
    return { loaded: 0, total: 0, percent: 100 }
  }

  const clampedLoaded = Math.min(loaded, total)
  const percent = Math.round((clampedLoaded / total) * 100)

  return { loaded: clampedLoaded, total, percent }
}

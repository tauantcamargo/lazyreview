import { describe, it, expect } from 'vitest'
import {
  createDiffChunks,
  computeProgress,
  DEFAULT_CHUNK_SIZE,
} from './streaming-diff'
import type { FileChange } from '../models/file-change'

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

describe('DEFAULT_CHUNK_SIZE', () => {
  it('is 10', () => {
    expect(DEFAULT_CHUNK_SIZE).toBe(10)
  })
})

describe('createDiffChunks', () => {
  it('returns empty array for empty file list', () => {
    const chunks = createDiffChunks([])
    expect(chunks).toEqual([])
  })

  it('returns a single chunk when files fit within chunk size', () => {
    const files = makeFiles(5)
    const chunks = createDiffChunks(files)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toHaveLength(5)
  })

  it('returns a single chunk when files equal chunk size', () => {
    const files = makeFiles(10)
    const chunks = createDiffChunks(files)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toHaveLength(10)
  })

  it('splits files into multiple chunks with default size', () => {
    const files = makeFiles(25)
    const chunks = createDiffChunks(files)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toHaveLength(10)
    expect(chunks[1]).toHaveLength(10)
    expect(chunks[2]).toHaveLength(5)
  })

  it('splits files into exact chunks when evenly divisible', () => {
    const files = makeFiles(30)
    const chunks = createDiffChunks(files)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toHaveLength(10)
    expect(chunks[1]).toHaveLength(10)
    expect(chunks[2]).toHaveLength(10)
  })

  it('uses custom chunk size', () => {
    const files = makeFiles(15)
    const chunks = createDiffChunks(files, 5)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toHaveLength(5)
    expect(chunks[1]).toHaveLength(5)
    expect(chunks[2]).toHaveLength(5)
  })

  it('handles chunk size of 1', () => {
    const files = makeFiles(3)
    const chunks = createDiffChunks(files, 1)
    expect(chunks).toHaveLength(3)
    chunks.forEach((chunk) => {
      expect(chunk).toHaveLength(1)
    })
  })

  it('handles chunk size larger than file count', () => {
    const files = makeFiles(3)
    const chunks = createDiffChunks(files, 100)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toHaveLength(3)
  })

  it('preserves file order across chunks', () => {
    const files = makeFiles(15)
    const chunks = createDiffChunks(files, 5)
    const reassembled = chunks.flat()
    expect(reassembled).toEqual(files)
  })

  it('does not mutate the original array', () => {
    const files = makeFiles(5)
    const original = [...files]
    createDiffChunks(files)
    expect(files).toEqual(original)
  })

  it('returns readonly arrays', () => {
    const files = makeFiles(5)
    const chunks = createDiffChunks(files)
    // TypeScript enforces readonly, but verify at runtime that
    // the arrays are proper copies (not the same reference)
    expect(chunks[0]).not.toBe(files)
  })
})

describe('computeProgress', () => {
  it('returns zero progress for empty file list', () => {
    const progress = computeProgress(0, 0)
    expect(progress).toEqual({ loaded: 0, total: 0, percent: 100 })
  })

  it('returns zero percent when nothing loaded', () => {
    const progress = computeProgress(0, 20)
    expect(progress).toEqual({ loaded: 0, total: 20, percent: 0 })
  })

  it('returns 100 percent when all loaded', () => {
    const progress = computeProgress(20, 20)
    expect(progress).toEqual({ loaded: 20, total: 20, percent: 100 })
  })

  it('returns correct percentage for partial progress', () => {
    const progress = computeProgress(10, 20)
    expect(progress).toEqual({ loaded: 10, total: 20, percent: 50 })
  })

  it('rounds percentage to nearest integer', () => {
    const progress = computeProgress(1, 3)
    expect(progress).toEqual({ loaded: 1, total: 3, percent: 33 })
  })

  it('handles single file loaded of many', () => {
    const progress = computeProgress(1, 100)
    expect(progress).toEqual({ loaded: 1, total: 100, percent: 1 })
  })

  it('handles near-complete progress', () => {
    const progress = computeProgress(99, 100)
    expect(progress).toEqual({ loaded: 99, total: 100, percent: 99 })
  })

  it('clamps loaded to total', () => {
    const progress = computeProgress(30, 20)
    expect(progress).toEqual({ loaded: 20, total: 20, percent: 100 })
  })
})

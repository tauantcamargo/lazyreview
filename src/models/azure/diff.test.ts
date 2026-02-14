import { describe, it, expect } from 'vitest'
import {
  AzureIterationSchema,
  AzureIterationChangeSchema,
  AzureChangesResponseSchema,
} from './diff'

// ---------------------------------------------------------------------------
// AzureIterationSchema
// ---------------------------------------------------------------------------

describe('AzureIterationSchema', () => {
  it('parses a minimal iteration', () => {
    const result = AzureIterationSchema.parse({ id: 1 })
    expect(result.id).toBe(1)
  })

  it('parses a fully-populated iteration', () => {
    const result = AzureIterationSchema.parse({
      id: 3,
      description: 'Third iteration',
      author: { id: 'author-1', displayName: 'Jane' },
      createdDate: '2026-01-15T10:00:00Z',
      sourceRefCommit: { commitId: 'src-sha' },
      targetRefCommit: { commitId: 'tgt-sha' },
      commonRefCommit: { commitId: 'common-sha' },
    })
    expect(result.id).toBe(3)
    expect(result.description).toBe('Third iteration')
    expect(result.sourceRefCommit?.commitId).toBe('src-sha')
  })

  it('rejects missing id', () => {
    expect(() => AzureIterationSchema.parse({})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// AzureIterationChangeSchema
// ---------------------------------------------------------------------------

describe('AzureIterationChangeSchema', () => {
  it('parses a string changeType', () => {
    const result = AzureIterationChangeSchema.parse({
      changeType: 'edit',
      item: { path: '/src/utils.ts' },
    })
    expect(result.changeType).toBe('edit')
    expect(result.item?.path).toBe('/src/utils.ts')
  })

  it('parses a numeric changeType and converts to string', () => {
    const result = AzureIterationChangeSchema.parse({
      changeType: 2,
      item: { path: '/src/file.ts' },
    })
    expect(result.changeType).toBe('2')
  })

  it('parses with originalPath for renames', () => {
    const result = AzureIterationChangeSchema.parse({
      changeType: 'rename',
      item: { path: '/src/new-name.ts' },
      originalPath: '/src/old-name.ts',
    })
    expect(result.originalPath).toBe('/src/old-name.ts')
  })

  it('parses without item', () => {
    const result = AzureIterationChangeSchema.parse({
      changeType: 'add',
    })
    expect(result.item).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// AzureChangesResponseSchema
// ---------------------------------------------------------------------------

describe('AzureChangesResponseSchema', () => {
  it('parses a changes response with entries', () => {
    const result = AzureChangesResponseSchema.parse({
      changeEntries: [
        { changeType: 'edit', item: { path: '/src/a.ts' } },
        { changeType: 'add', item: { path: '/src/b.ts' } },
      ],
    })
    expect(result.changeEntries).toHaveLength(2)
  })

  it('defaults to empty array', () => {
    const result = AzureChangesResponseSchema.parse({})
    expect(result.changeEntries).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import { BitbucketDiffStatSchema } from './diff'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validDiffStat = {
  status: 'modified' as const,
  old: { path: 'src/utils.ts' },
  new: { path: 'src/utils.ts' },
  lines_added: 10,
  lines_removed: 3,
}

// ---------------------------------------------------------------------------
// BitbucketDiffStatSchema
// ---------------------------------------------------------------------------

describe('BitbucketDiffStatSchema', () => {
  it('parses a valid modified diffstat', () => {
    const result = BitbucketDiffStatSchema.parse(validDiffStat)
    expect(result.status).toBe('modified')
    expect(result.old?.path).toBe('src/utils.ts')
    expect(result.new?.path).toBe('src/utils.ts')
    expect(result.lines_added).toBe(10)
    expect(result.lines_removed).toBe(3)
  })

  it('parses an added file (null old)', () => {
    const result = BitbucketDiffStatSchema.parse({
      status: 'added',
      old: null,
      new: { path: 'src/new-file.ts' },
      lines_added: 20,
      lines_removed: 0,
    })
    expect(result.status).toBe('added')
    expect(result.old).toBeNull()
    expect(result.new?.path).toBe('src/new-file.ts')
  })

  it('parses a removed file (null new)', () => {
    const result = BitbucketDiffStatSchema.parse({
      status: 'removed',
      old: { path: 'src/deleted.ts' },
      new: null,
      lines_added: 0,
      lines_removed: 50,
    })
    expect(result.status).toBe('removed')
    expect(result.old?.path).toBe('src/deleted.ts')
    expect(result.new).toBeNull()
  })

  it('parses a renamed file', () => {
    const result = BitbucketDiffStatSchema.parse({
      status: 'renamed',
      old: { path: 'src/old-name.ts' },
      new: { path: 'src/new-name.ts' },
    })
    expect(result.status).toBe('renamed')
    expect(result.old?.path).toBe('src/old-name.ts')
    expect(result.new?.path).toBe('src/new-name.ts')
  })

  it('parses a merge conflict status', () => {
    const result = BitbucketDiffStatSchema.parse({
      ...validDiffStat,
      status: 'merge conflict',
    })
    expect(result.status).toBe('merge conflict')
  })

  it('defaults lines_added and lines_removed to 0', () => {
    const result = BitbucketDiffStatSchema.parse({
      status: 'renamed',
      old: { path: 'a.ts' },
      new: { path: 'b.ts' },
    })
    expect(result.lines_added).toBe(0)
    expect(result.lines_removed).toBe(0)
  })

  it('parses all valid status values', () => {
    const statuses = [
      'added',
      'removed',
      'modified',
      'renamed',
      'merge conflict',
    ] as const
    for (const status of statuses) {
      const result = BitbucketDiffStatSchema.parse({
        ...validDiffStat,
        status,
      })
      expect(result.status).toBe(status)
    }
  })

  it('rejects invalid status', () => {
    expect(() =>
      BitbucketDiffStatSchema.parse({ ...validDiffStat, status: 'unknown' }),
    ).toThrow()
  })

  it('rejects missing status', () => {
    const { status: _, ...noStatus } = validDiffStat
    expect(() => BitbucketDiffStatSchema.parse(noStatus)).toThrow()
  })

  it('rejects non-number lines_added', () => {
    expect(() =>
      BitbucketDiffStatSchema.parse({
        ...validDiffStat,
        lines_added: 'many',
      }),
    ).toThrow()
  })
})

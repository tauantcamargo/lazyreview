import { describe, it, expect } from 'vitest'
import { Schema as S } from 'effect'
import { FileChange } from './file-change'

describe('FileChange schema', () => {
  const decode = S.decodeUnknownSync(FileChange)

  it('decodes a valid file change', () => {
    const result = decode({
      sha: 'abc123',
      filename: 'src/index.ts',
      status: 'modified',
      additions: 10,
      deletions: 5,
      changes: 15,
    })
    expect(result.filename).toBe('src/index.ts')
    expect(result.status).toBe('modified')
    expect(result.additions).toBe(10)
    expect(result.deletions).toBe(5)
  })

  it('decodes all valid statuses', () => {
    const statuses = ['added', 'removed', 'modified', 'renamed', 'copied', 'changed', 'unchanged'] as const
    for (const status of statuses) {
      const result = decode({
        sha: 'abc',
        filename: 'file.ts',
        status,
        additions: 0,
        deletions: 0,
        changes: 0,
      })
      expect(result.status).toBe(status)
    }
  })

  it('decodes with optional fields', () => {
    const result = decode({
      sha: 'abc',
      filename: 'old.ts',
      status: 'renamed',
      additions: 0,
      deletions: 0,
      changes: 0,
      patch: '@@ -1 +1 @@\n-old\n+new',
      previous_filename: 'old-name.ts',
    })
    expect(result.patch).toBe('@@ -1 +1 @@\n-old\n+new')
    expect(result.previous_filename).toBe('old-name.ts')
  })

  it('rejects invalid status', () => {
    expect(() =>
      decode({
        sha: 'abc',
        filename: 'file.ts',
        status: 'deleted',
        additions: 0,
        deletions: 0,
        changes: 0,
      }),
    ).toThrow()
  })
})

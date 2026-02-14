import { describe, it, expect } from 'vitest'
import { AzureCommitSchema, AzureCommitChangeSchema } from './commit'

// ---------------------------------------------------------------------------
// AzureCommitSchema
// ---------------------------------------------------------------------------

describe('AzureCommitSchema', () => {
  it('parses a minimal commit', () => {
    const result = AzureCommitSchema.parse({
      commitId: 'abc123',
      author: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        date: '2026-01-15T10:00:00Z',
      },
    })
    expect(result.commitId).toBe('abc123')
    expect(result.comment).toBe('')
    expect(result.author.name).toBe('Jane Doe')
    expect(result.author.email).toBe('jane@example.com')
  })

  it('parses a fully-populated commit', () => {
    const result = AzureCommitSchema.parse({
      commitId: 'abc123def456',
      comment: 'feat: add dark mode\n\nFull description here.',
      author: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        date: '2026-01-15T10:00:00Z',
      },
      committer: {
        name: 'GitHub',
        email: 'noreply@github.com',
        date: '2026-01-15T10:00:00Z',
      },
      url: 'https://dev.azure.com/org/proj/_apis/git/repos/repo/commits/abc123',
      remoteUrl: 'https://dev.azure.com/org/proj/_git/repo/commit/abc123',
    })
    expect(result.comment).toBe('feat: add dark mode\n\nFull description here.')
    expect(result.committer?.name).toBe('GitHub')
    expect(result.remoteUrl).toContain('commit/abc123')
  })

  it('rejects missing commitId', () => {
    expect(() =>
      AzureCommitSchema.parse({
        author: {
          name: 'Jane',
          email: 'j@e.com',
          date: '2026-01-15T10:00:00Z',
        },
      }),
    ).toThrow()
  })

  it('rejects missing author', () => {
    expect(() =>
      AzureCommitSchema.parse({ commitId: 'abc123' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// AzureCommitChangeSchema
// ---------------------------------------------------------------------------

describe('AzureCommitChangeSchema', () => {
  it('parses a string changeType', () => {
    const result = AzureCommitChangeSchema.parse({
      item: { path: '/src/file.ts' },
      changeType: 'edit',
    })
    expect(result.changeType).toBe('edit')
    expect(result.item.path).toBe('/src/file.ts')
  })

  it('parses a numeric changeType', () => {
    const result = AzureCommitChangeSchema.parse({
      item: { path: '/src/new.ts' },
      changeType: 1,
    })
    expect(result.changeType).toBe('1')
  })
})

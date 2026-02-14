import { describe, it, expect } from 'vitest'
import { GiteaChangedFileSchema } from './diff'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validChangedFile = {
  filename: 'src/main.ts',
  status: 'modified',
  additions: 10,
  deletions: 3,
  changes: 13,
  html_url: 'https://gitea.example.com/owner/repo/src/branch/main/src/main.ts',
  contents_url: 'https://gitea.example.com/api/v1/repos/owner/repo/contents/src/main.ts',
}

// ---------------------------------------------------------------------------
// GiteaChangedFileSchema
// ---------------------------------------------------------------------------

describe('GiteaChangedFileSchema', () => {
  it('parses a fully-populated changed file', () => {
    const result = GiteaChangedFileSchema.parse(validChangedFile)
    expect(result.filename).toBe('src/main.ts')
    expect(result.status).toBe('modified')
    expect(result.additions).toBe(10)
    expect(result.deletions).toBe(3)
    expect(result.changes).toBe(13)
    expect(result.html_url).toBe(
      'https://gitea.example.com/owner/repo/src/branch/main/src/main.ts',
    )
  })

  it('defaults optional fields', () => {
    const result = GiteaChangedFileSchema.parse({
      filename: 'README.md',
    })
    expect(result.status).toBe('modified')
    expect(result.additions).toBe(0)
    expect(result.deletions).toBe(0)
    expect(result.changes).toBe(0)
    expect(result.html_url).toBe('')
    expect(result.contents_url).toBe('')
    expect(result.previous_filename).toBeUndefined()
  })

  it('parses a renamed file with previous_filename', () => {
    const result = GiteaChangedFileSchema.parse({
      filename: 'src/new-name.ts',
      status: 'renamed',
      previous_filename: 'src/old-name.ts',
    })
    expect(result.status).toBe('renamed')
    expect(result.previous_filename).toBe('src/old-name.ts')
  })

  it('parses all status values', () => {
    const statuses = ['added', 'removed', 'modified', 'renamed']
    for (const status of statuses) {
      const result = GiteaChangedFileSchema.parse({
        filename: 'test.ts',
        status,
      })
      expect(result.status).toBe(status)
    }
  })

  it('rejects missing filename', () => {
    expect(() =>
      GiteaChangedFileSchema.parse({ status: 'modified' }),
    ).toThrow()
  })
})

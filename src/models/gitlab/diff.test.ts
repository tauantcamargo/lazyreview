import { describe, it, expect } from 'vitest'
import { GitLabDiffSchema } from './diff'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validDiff = {
  old_path: 'src/utils.ts',
  new_path: 'src/utils.ts',
  a_mode: '100644',
  b_mode: '100644',
  diff: '@@ -1,3 +1,4 @@\n line1\n-old\n+new\n+added\n line3',
  new_file: false,
  renamed_file: false,
  deleted_file: false,
}

// ---------------------------------------------------------------------------
// GitLabDiffSchema
// ---------------------------------------------------------------------------

describe('GitLabDiffSchema', () => {
  it('parses a valid diff', () => {
    const result = GitLabDiffSchema.parse(validDiff)
    expect(result.old_path).toBe('src/utils.ts')
    expect(result.new_path).toBe('src/utils.ts')
    expect(result.a_mode).toBe('100644')
    expect(result.b_mode).toBe('100644')
    expect(result.diff).toContain('@@ -1,3 +1,4 @@')
    expect(result.new_file).toBe(false)
    expect(result.renamed_file).toBe(false)
    expect(result.deleted_file).toBe(false)
  })

  it('parses a new file diff', () => {
    const result = GitLabDiffSchema.parse({
      ...validDiff,
      old_path: '',
      a_mode: '0',
      new_file: true,
    })
    expect(result.new_file).toBe(true)
  })

  it('parses a renamed file diff', () => {
    const result = GitLabDiffSchema.parse({
      ...validDiff,
      old_path: 'src/old-name.ts',
      new_path: 'src/new-name.ts',
      renamed_file: true,
    })
    expect(result.renamed_file).toBe(true)
    expect(result.old_path).toBe('src/old-name.ts')
    expect(result.new_path).toBe('src/new-name.ts')
  })

  it('parses a deleted file diff', () => {
    const result = GitLabDiffSchema.parse({
      ...validDiff,
      b_mode: '0',
      deleted_file: true,
    })
    expect(result.deleted_file).toBe(true)
  })

  it('rejects missing diff content', () => {
    const { diff: _, ...noDiff } = validDiff
    expect(() => GitLabDiffSchema.parse(noDiff)).toThrow()
  })

  it('rejects missing old_path', () => {
    const { old_path: _, ...noOldPath } = validDiff
    expect(() => GitLabDiffSchema.parse(noOldPath)).toThrow()
  })

  it('rejects non-boolean new_file', () => {
    expect(() =>
      GitLabDiffSchema.parse({ ...validDiff, new_file: 'yes' }),
    ).toThrow()
  })
})

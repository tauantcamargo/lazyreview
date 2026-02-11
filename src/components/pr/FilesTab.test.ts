import { describe, it, expect } from 'vitest'
import { fuzzyMatch } from './FilesTab'

describe('fuzzyMatch', () => {
  it('matches exact filename', () => {
    expect(fuzzyMatch('src/index.ts', 'src/index.ts')).toBe(true)
  })

  it('matches fuzzy across path segments', () => {
    expect(fuzzyMatch('src/components/Button.tsx', 'scBtn')).toBe(true)
  })

  it('matches case-insensitively', () => {
    expect(fuzzyMatch('MyComponent.tsx', 'mycomp')).toBe(true)
  })

  it('returns true for empty query', () => {
    expect(fuzzyMatch('anything.ts', '')).toBe(true)
  })

  it('returns false when characters are not in order', () => {
    expect(fuzzyMatch('abc.ts', 'cba')).toBe(false)
  })

  it('returns false when query has characters not in filename', () => {
    expect(fuzzyMatch('index.ts', 'xyz')).toBe(false)
  })

  it('matches partial extension', () => {
    expect(fuzzyMatch('component.test.tsx', 'test.tsx')).toBe(true)
  })

  it('matches across directory separators', () => {
    expect(fuzzyMatch('src/hooks/useGitHub.ts', 'hkgit')).toBe(true)
  })
})

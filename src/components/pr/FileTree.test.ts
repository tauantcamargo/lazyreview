import { describe, it, expect } from 'vitest'
import { buildFileTree, flattenTreeToFiles, buildDisplayRows } from './FileTree'
import type { FileChange } from '../../models/file-change'

function makeFile(filename: string, status = 'modified' as const): FileChange {
  return {
    sha: 'abc123',
    filename,
    status,
    additions: 1,
    deletions: 0,
    changes: 1,
  } as unknown as FileChange
}

describe('buildFileTree', () => {
  it('returns empty array for no files', () => {
    expect(buildFileTree([])).toEqual([])
  })

  it('creates file nodes for root-level files', () => {
    const files = [makeFile('README.md')]
    const tree = buildFileTree(files)
    expect(tree).toHaveLength(1)
    expect(tree[0]!.type).toBe('file')
    if (tree[0]!.type === 'file') {
      expect(tree[0]!.file.filename).toBe('README.md')
    }
  })

  it('creates directory nodes for nested files', () => {
    const files = [makeFile('src/index.ts')]
    const tree = buildFileTree(files)
    expect(tree).toHaveLength(1)
    expect(tree[0]!.type).toBe('dir')
    if (tree[0]!.type === 'dir') {
      expect(tree[0]!.name).toBe('src')
      expect(tree[0]!.children).toHaveLength(1)
      expect(tree[0]!.children[0]!.type).toBe('file')
    }
  })

  it('groups files under common directories', () => {
    const files = [makeFile('src/a.ts'), makeFile('src/b.ts')]
    const tree = buildFileTree(files)
    expect(tree).toHaveLength(1)
    if (tree[0]!.type === 'dir') {
      expect(tree[0]!.children).toHaveLength(2)
    }
  })

  it('creates nested directory structure', () => {
    const files = [makeFile('src/components/Button.tsx')]
    const tree = buildFileTree(files)
    expect(tree[0]!.type).toBe('dir')
    if (tree[0]!.type === 'dir') {
      expect(tree[0]!.name).toBe('src')
      const child = tree[0]!.children[0]!
      expect(child.type).toBe('dir')
      if (child.type === 'dir') {
        expect(child.name).toBe('components')
        expect(child.children[0]!.type).toBe('file')
      }
    }
  })

  it('sorts directories before files, both alphabetically', () => {
    const files = [
      makeFile('src/z.ts'),
      makeFile('a.ts'),
      makeFile('src/a.ts'),
    ]
    const tree = buildFileTree(files)
    // Root should have: dir "src" first, then file "a.ts"
    expect(tree[0]!.type).toBe('dir')
    expect(tree[1]!.type).toBe('file')
  })
})

describe('flattenTreeToFiles', () => {
  it('returns empty array for empty tree', () => {
    expect(flattenTreeToFiles([])).toEqual([])
  })

  it('returns files from flat tree', () => {
    const files = [makeFile('a.ts'), makeFile('b.ts')]
    const tree = buildFileTree(files)
    const flat = flattenTreeToFiles(tree)
    expect(flat).toHaveLength(2)
  })

  it('returns files from nested tree in tree order', () => {
    const files = [
      makeFile('src/b.ts'),
      makeFile('src/a.ts'),
      makeFile('README.md'),
    ]
    const tree = buildFileTree(files)
    const flat = flattenTreeToFiles(tree)
    expect(flat).toHaveLength(3)
    // dir "src" comes first (sorted), then file "README.md"
    // Inside src: a.ts and b.ts sorted alphabetically
    expect(flat[0]!.filename).toBe('src/a.ts')
    expect(flat[1]!.filename).toBe('src/b.ts')
    expect(flat[2]!.filename).toBe('README.md')
  })
})

describe('buildDisplayRows', () => {
  it('returns empty array for empty nodes', () => {
    const ref = { current: 0 }
    expect(buildDisplayRows([], 0, ref)).toEqual([])
  })

  it('creates file rows with correct fileIndex', () => {
    const files = [makeFile('a.ts'), makeFile('b.ts')]
    const tree = buildFileTree(files)
    const ref = { current: 0 }
    const rows = buildDisplayRows(tree, 0, ref)
    expect(rows).toHaveLength(2)
    expect(rows[0]!.type).toBe('file')
    if (rows[0]!.type === 'file') {
      expect(rows[0]!.fileIndex).toBe(0)
    }
    if (rows[1]!.type === 'file') {
      expect(rows[1]!.fileIndex).toBe(1)
    }
  })

  it('creates dir rows for directory nodes', () => {
    const files = [makeFile('src/index.ts')]
    const tree = buildFileTree(files)
    const ref = { current: 0 }
    const rows = buildDisplayRows(tree, 0, ref)
    expect(rows[0]!.type).toBe('dir')
    if (rows[0]!.type === 'dir') {
      expect(rows[0]!.name).toBe('src')
    }
    expect(rows[1]!.type).toBe('file')
  })

  it('assigns correct indent levels', () => {
    const files = [makeFile('src/components/Button.tsx')]
    const tree = buildFileTree(files)
    const ref = { current: 0 }
    const rows = buildDisplayRows(tree, 0, ref)
    expect(rows[0]!.indent).toBe(0) // src/
    expect(rows[1]!.indent).toBe(1) // components/
    expect(rows[2]!.indent).toBe(2) // Button.tsx
  })
})

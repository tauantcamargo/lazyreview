import { describe, it, expect } from 'vitest'
import {
  createBookmarkState,
  setBookmark,
  getBookmark,
  removeBookmark,
  listBookmarks,
  isValidRegister,
  type BookmarkRegister,
  type DiffBookmark,
  type BookmarkState,
} from './diff-bookmarks'

describe('createBookmarkState', () => {
  it('creates an empty bookmark state', () => {
    const state = createBookmarkState()
    expect(state.bookmarks.size).toBe(0)
  })

  it('returns a state with an empty ReadonlyMap', () => {
    const state = createBookmarkState()
    expect(listBookmarks(state)).toEqual([])
  })
})

describe('isValidRegister', () => {
  it('accepts lowercase letters a-z', () => {
    for (const ch of ['a', 'b', 'm', 'z']) {
      expect(isValidRegister(ch)).toBe(true)
    }
  })

  it('rejects uppercase letters', () => {
    for (const ch of ['A', 'B', 'Z']) {
      expect(isValidRegister(ch)).toBe(false)
    }
  })

  it('rejects digits', () => {
    for (const ch of ['0', '1', '9']) {
      expect(isValidRegister(ch)).toBe(false)
    }
  })

  it('rejects multi-character strings', () => {
    expect(isValidRegister('ab')).toBe(false)
    expect(isValidRegister('abc')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidRegister('')).toBe(false)
  })

  it('rejects special characters', () => {
    for (const ch of ['@', '#', ' ', '!', '-', '_']) {
      expect(isValidRegister(ch)).toBe(false)
    }
  })
})

describe('setBookmark', () => {
  it('sets a bookmark in an empty state', () => {
    const state = createBookmarkState()
    const next = setBookmark(state, 'a', 'src/index.ts', 42, 'github:owner/repo#1')
    const bookmark = getBookmark(next, 'a')
    expect(bookmark).not.toBeNull()
    expect(bookmark?.register).toBe('a')
    expect(bookmark?.file).toBe('src/index.ts')
    expect(bookmark?.line).toBe(42)
    expect(bookmark?.prKey).toBe('github:owner/repo#1')
  })

  it('sets multiple bookmarks in different registers', () => {
    let state = createBookmarkState()
    state = setBookmark(state, 'a', 'file1.ts', 10, 'pr1')
    state = setBookmark(state, 'b', 'file2.ts', 20, 'pr1')
    state = setBookmark(state, 'c', 'file3.ts', 30, 'pr1')

    expect(getBookmark(state, 'a')?.file).toBe('file1.ts')
    expect(getBookmark(state, 'b')?.file).toBe('file2.ts')
    expect(getBookmark(state, 'c')?.file).toBe('file3.ts')
  })

  it('overrides existing bookmark in same register', () => {
    let state = createBookmarkState()
    state = setBookmark(state, 'a', 'file1.ts', 10, 'pr1')
    state = setBookmark(state, 'a', 'file2.ts', 99, 'pr1')

    const bookmark = getBookmark(state, 'a')
    expect(bookmark?.file).toBe('file2.ts')
    expect(bookmark?.line).toBe(99)
  })

  it('returns same state for invalid register', () => {
    const state = createBookmarkState()
    const result = setBookmark(state, '1', 'file.ts', 10, 'pr1')
    expect(result).toBe(state)
  })

  it('returns same state for empty register', () => {
    const state = createBookmarkState()
    const result = setBookmark(state, '', 'file.ts', 10, 'pr1')
    expect(result).toBe(state)
  })

  it('returns same state for uppercase register', () => {
    const state = createBookmarkState()
    const result = setBookmark(state, 'A', 'file.ts', 10, 'pr1')
    expect(result).toBe(state)
  })
})

describe('getBookmark', () => {
  it('returns null for non-existent register', () => {
    const state = createBookmarkState()
    expect(getBookmark(state, 'a')).toBeNull()
  })

  it('returns null for empty state', () => {
    const state = createBookmarkState()
    expect(getBookmark(state, 'z')).toBeNull()
  })

  it('returns the bookmark for a valid register', () => {
    let state = createBookmarkState()
    state = setBookmark(state, 'm', 'utils/helpers.ts', 55, 'pr2')
    const bookmark = getBookmark(state, 'm')
    expect(bookmark).toEqual({
      register: 'm',
      file: 'utils/helpers.ts',
      line: 55,
      prKey: 'pr2',
    })
  })

  it('returns null for invalid register without crashing', () => {
    const state = createBookmarkState()
    expect(getBookmark(state, '!')).toBeNull()
    expect(getBookmark(state, '')).toBeNull()
  })
})

describe('removeBookmark', () => {
  it('removes an existing bookmark', () => {
    let state = createBookmarkState()
    state = setBookmark(state, 'a', 'file.ts', 10, 'pr1')
    state = removeBookmark(state, 'a')
    expect(getBookmark(state, 'a')).toBeNull()
  })

  it('returns same state when removing non-existent register', () => {
    const state = createBookmarkState()
    const result = removeBookmark(state, 'a')
    expect(result).toBe(state)
  })

  it('does not affect other bookmarks', () => {
    let state = createBookmarkState()
    state = setBookmark(state, 'a', 'file1.ts', 10, 'pr1')
    state = setBookmark(state, 'b', 'file2.ts', 20, 'pr1')
    state = removeBookmark(state, 'a')

    expect(getBookmark(state, 'a')).toBeNull()
    expect(getBookmark(state, 'b')?.file).toBe('file2.ts')
  })

  it('returns same state for invalid register', () => {
    let state = createBookmarkState()
    state = setBookmark(state, 'a', 'file.ts', 10, 'pr1')
    const result = removeBookmark(state, '1')
    expect(result).toBe(state)
  })
})

describe('listBookmarks', () => {
  it('returns empty array for empty state', () => {
    const state = createBookmarkState()
    expect(listBookmarks(state)).toEqual([])
  })

  it('returns bookmarks sorted by register', () => {
    let state = createBookmarkState()
    state = setBookmark(state, 'c', 'file3.ts', 30, 'pr1')
    state = setBookmark(state, 'a', 'file1.ts', 10, 'pr1')
    state = setBookmark(state, 'b', 'file2.ts', 20, 'pr1')

    const bookmarks = listBookmarks(state)
    expect(bookmarks).toHaveLength(3)
    expect(bookmarks[0]?.register).toBe('a')
    expect(bookmarks[1]?.register).toBe('b')
    expect(bookmarks[2]?.register).toBe('c')
  })

  it('returns all bookmark data in each entry', () => {
    let state = createBookmarkState()
    state = setBookmark(state, 'a', 'src/app.tsx', 42, 'github:user/repo#5')

    const bookmarks = listBookmarks(state)
    expect(bookmarks).toHaveLength(1)
    expect(bookmarks[0]).toEqual({
      register: 'a',
      file: 'src/app.tsx',
      line: 42,
      prKey: 'github:user/repo#5',
    })
  })

  it('reflects removals correctly', () => {
    let state = createBookmarkState()
    state = setBookmark(state, 'a', 'file1.ts', 10, 'pr1')
    state = setBookmark(state, 'b', 'file2.ts', 20, 'pr1')
    state = removeBookmark(state, 'a')

    const bookmarks = listBookmarks(state)
    expect(bookmarks).toHaveLength(1)
    expect(bookmarks[0]?.register).toBe('b')
  })

  it('returns a new array each time (not a reference to internal state)', () => {
    let state = createBookmarkState()
    state = setBookmark(state, 'a', 'file.ts', 10, 'pr1')

    const list1 = listBookmarks(state)
    const list2 = listBookmarks(state)
    expect(list1).toEqual(list2)
    expect(list1).not.toBe(list2)
  })
})

describe('immutability', () => {
  it('setBookmark returns a new state object', () => {
    const state = createBookmarkState()
    const next = setBookmark(state, 'a', 'file.ts', 10, 'pr1')
    expect(next).not.toBe(state)
  })

  it('removeBookmark returns a new state object when removing', () => {
    let state = createBookmarkState()
    state = setBookmark(state, 'a', 'file.ts', 10, 'pr1')
    const next = removeBookmark(state, 'a')
    expect(next).not.toBe(state)
  })

  it('original state is unchanged after setBookmark', () => {
    const original = createBookmarkState()
    setBookmark(original, 'a', 'file.ts', 10, 'pr1')
    expect(original.bookmarks.size).toBe(0)
  })

  it('original state is unchanged after removeBookmark', () => {
    let state = createBookmarkState()
    state = setBookmark(state, 'a', 'file.ts', 10, 'pr1')
    const withBookmark = state
    removeBookmark(withBookmark, 'a')
    expect(getBookmark(withBookmark, 'a')?.file).toBe('file.ts')
  })

  it('setBookmark returns a new Map, not the same reference', () => {
    const state = createBookmarkState()
    const next = setBookmark(state, 'a', 'file.ts', 10, 'pr1')
    expect(next.bookmarks).not.toBe(state.bookmarks)
  })
})

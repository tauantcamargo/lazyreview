/**
 * Pure state machine for diff bookmarks (vim marks style).
 * Supports register-based bookmarks (a-z) that reference
 * a specific file and line within a PR diff.
 * All operations are immutable -- each function returns a new BookmarkState.
 */

/** A single lowercase letter a-z used as a bookmark register. */
export type BookmarkRegister = string

/** A bookmark pointing to a specific file and line in a PR diff. */
export interface DiffBookmark {
  readonly register: BookmarkRegister
  readonly file: string
  readonly line: number
  readonly prKey: string
}

/** Immutable state container for all active bookmarks. */
export interface BookmarkState {
  readonly bookmarks: ReadonlyMap<string, DiffBookmark>
}

/** Validate that a register name is a single lowercase letter a-z. */
export function isValidRegister(char: string): boolean {
  return char.length === 1 && char >= 'a' && char <= 'z'
}

/** Create a new empty bookmark state. */
export function createBookmarkState(): BookmarkState {
  return { bookmarks: new Map() }
}

/**
 * Set a bookmark in the given register.
 * Returns a new state with the bookmark set, or the same state if the register is invalid.
 */
export function setBookmark(
  state: BookmarkState,
  register: string,
  file: string,
  line: number,
  prKey: string,
): BookmarkState {
  if (!isValidRegister(register)) return state

  const next = new Map(state.bookmarks)
  next.set(register, { register, file, line, prKey })
  return { bookmarks: next }
}

/**
 * Get the bookmark stored in the given register.
 * Returns null if no bookmark exists for that register.
 */
export function getBookmark(
  state: BookmarkState,
  register: string,
): DiffBookmark | null {
  return state.bookmarks.get(register) ?? null
}

/**
 * Remove the bookmark from the given register.
 * Returns the same state if the register does not exist or is invalid.
 */
export function removeBookmark(
  state: BookmarkState,
  register: string,
): BookmarkState {
  if (!state.bookmarks.has(register)) return state

  const next = new Map(state.bookmarks)
  next.delete(register)
  return { bookmarks: next }
}

/**
 * List all bookmarks sorted alphabetically by register.
 * Returns a new array each time (safe for consumers to hold references).
 */
export function listBookmarks(state: BookmarkState): readonly DiffBookmark[] {
  const entries = Array.from(state.bookmarks.values())
  return entries.sort((a, b) => a.register.localeCompare(b.register))
}

import { z } from 'zod'

export { StateError } from '../../models/errors'

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

/**
 * Build a PR-scoped key: `${provider}:${owner}/${repo}#${prNumber}`
 */
export function buildPRKey(
  provider: string,
  owner: string,
  repo: string,
  prNumber: number,
): string {
  return `${provider}:${owner}/${repo}#${prNumber}`
}

/**
 * Build a repo-scoped key: `${provider}:${owner}/${repo}`
 */
export function buildRepoKey(
  provider: string,
  owner: string,
  repo: string,
): string {
  return `${provider}:${owner}/${repo}`
}

// ---------------------------------------------------------------------------
// Zod schemas for stored entities
// ---------------------------------------------------------------------------

export const StoredPRNoteSchema = z.object({
  key: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type StoredPRNote = z.infer<typeof StoredPRNoteSchema>

export const StoredDiffBookmarkSchema = z.object({
  key: z.string(),
  register: z.string(),
  filePath: z.string(),
  lineNumber: z.number().int().nonnegative(),
  label: z.string().optional(),
  createdAt: z.string(),
})

export type StoredDiffBookmark = z.infer<typeof StoredDiffBookmarkSchema>

export const StoredChecklistItemSchema = z.object({
  key: z.string(),
  item: z.string(),
  checked: z.boolean(),
  updatedAt: z.string(),
})

export type StoredChecklistItem = z.infer<typeof StoredChecklistItemSchema>

export const StoredPRReadStateSchema = z.object({
  key: z.string(),
  lastSeenAt: z.string(),
  prUpdatedAt: z.string(),
})

export type StoredPRReadState = z.infer<typeof StoredPRReadStateSchema>

export const StoredViewedFileSchema = z.object({
  key: z.string(),
  filePath: z.string(),
  viewedAt: z.string(),
})

export type StoredViewedFile = z.infer<typeof StoredViewedFileSchema>

export const StoredBookmarkedRepoSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  addedAt: z.string(),
})

export type StoredBookmarkedRepo = z.infer<typeof StoredBookmarkedRepoSchema>

export const StoredRecentRepoSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  lastUsed: z.string(),
})

export type StoredRecentRepo = z.infer<typeof StoredRecentRepoSchema>

export const StoredKVSchema = z.object({
  key: z.string(),
  value: z.string(),
  updatedAt: z.string(),
})

export type StoredKV = z.infer<typeof StoredKVSchema>

// ---------------------------------------------------------------------------
// StateStore interface
// ---------------------------------------------------------------------------

export interface StateStore {
  // Lifecycle
  readonly open: () => Promise<void>
  readonly close: () => void

  // PR notes
  readonly getPRNotes: (key: string) => StoredPRNote | undefined
  readonly setPRNotes: (key: string, content: string) => void
  readonly deletePRNotes: (key: string) => void

  // Read state
  readonly getReadState: (key: string) => StoredPRReadState | undefined
  readonly setReadState: (key: string, prUpdatedAt: string) => void

  // Viewed files
  readonly getViewedFiles: (key: string) => readonly StoredViewedFile[]
  readonly setViewedFile: (key: string, filePath: string) => void
  readonly removeViewedFile: (key: string, filePath: string) => void

  // Bookmarked repos
  readonly getBookmarkedRepos: () => readonly StoredBookmarkedRepo[]
  readonly addBookmarkedRepo: (owner: string, repo: string) => void
  readonly removeBookmarkedRepo: (owner: string, repo: string) => void

  // Recent repos
  readonly getRecentRepos: () => readonly StoredRecentRepo[]
  readonly addRecentRepo: (owner: string, repo: string) => void

  // Diff bookmarks
  readonly getDiffBookmarks: (key: string) => readonly StoredDiffBookmark[]
  readonly setDiffBookmark: (key: string, bookmark: Omit<StoredDiffBookmark, 'key' | 'createdAt'>) => void
  readonly removeDiffBookmark: (key: string, register: string) => void

  // Review checklists
  readonly getChecklistState: (key: string) => readonly StoredChecklistItem[]
  readonly setChecklistItem: (key: string, item: string, checked: boolean) => void

  // Key-value store
  readonly getKV: (key: string) => string | undefined
  readonly setKV: (key: string, value: string) => void
  readonly deleteKV: (key: string) => void
}

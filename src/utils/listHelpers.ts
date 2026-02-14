import type { PullRequest } from '../models/pull-request'

/**
 * Find the index of the next unread PR in a list, starting after the given index.
 * If no unread PRs exist after the current index, wraps to the top.
 * Returns -1 if there are no unread PRs in the list.
 *
 * @param items - The list of PRs to search
 * @param currentIndex - The current cursor position
 * @param isUnread - Function to check if a PR is unread
 * @returns The index of the next unread PR, or -1 if none exist
 */
export function findNextUnread(
  items: readonly PullRequest[],
  currentIndex: number,
  isUnread: (htmlUrl: string, prUpdatedAt: string) => boolean,
): number {
  if (items.length === 0) return -1

  // Search forward from current position + 1
  for (let i = currentIndex + 1; i < items.length; i++) {
    const pr = items[i]!
    if (isUnread(pr.html_url, pr.updated_at)) {
      return i
    }
  }

  // Wrap around and search from the beginning to current position (inclusive)
  for (let i = 0; i <= currentIndex; i++) {
    const pr = items[i]!
    if (isUnread(pr.html_url, pr.updated_at)) {
      return i
    }
  }

  return -1
}

import type { Comment } from '../../models/comment'
import type { ReviewThread } from '../../services/GitHubApiTypes'
import type { DiffCommentThread } from './DiffComment'

/**
 * Build a map from line key (e.g., "RIGHT:42") to DiffCommentThread
 * for the given file, threading replies under their parent comments.
 */
export function buildCommentsByLine(
  comments: readonly Comment[] | undefined,
  reviewThreads: readonly ReviewThread[] | undefined,
  filename: string | undefined,
): ReadonlyMap<string, DiffCommentThread> | undefined {
  if (!comments || comments.length === 0 || !filename) return undefined

  const fileComments = comments.filter(
    (c) =>
      c.path === filename &&
      c.line != null &&
      c.in_reply_to_id == null,
  )
  if (fileComments.length === 0) return undefined

  const threadMap = new Map<
    number,
    { id: string; isResolved: boolean } | undefined
  >()
  if (reviewThreads) {
    for (const thread of reviewThreads) {
      for (const tc of thread.comments)
        threadMap.set(tc.databaseId, {
          id: thread.id,
          isResolved: thread.isResolved,
        })
    }
  }

  const replyMap = new Map<number, Comment[]>()
  for (const c of comments) {
    if (c.path === filename && c.in_reply_to_id != null) {
      replyMap.set(c.in_reply_to_id, [
        ...(replyMap.get(c.in_reply_to_id) ?? []),
        c,
      ])
    }
  }

  const result = new Map<string, DiffCommentThread>()
  for (const rc of fileComments) {
    const threadInfo = threadMap.get(rc.id)
    const side = rc.side === 'LEFT' ? 'LEFT' : 'RIGHT'
    const key = `${side}:${rc.line!}`
    result.set(key, {
      comments: [rc, ...(replyMap.get(rc.id) ?? [])],
      threadId: threadInfo?.id,
      isResolved: threadInfo?.isResolved,
    })
  }
  return result
}

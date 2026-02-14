import type { ReviewThread } from '../services/CodeReviewApiTypes'

// ---------------------------------------------------------------------------
// Optimistic ID counter (negative to avoid collisions with real IDs)
// ---------------------------------------------------------------------------

let optimisticIdCounter = -1

function nextOptimisticId(): number {
  const id = optimisticIdCounter
  optimisticIdCounter -= 1
  return id
}

// ---------------------------------------------------------------------------
// Placeholder user for optimistic objects
// ---------------------------------------------------------------------------

export const OPTIMISTIC_USER = {
  login: 'you',
  id: 0,
  avatar_url: '',
  html_url: '',
  type: 'User' as const,
} as const

// ---------------------------------------------------------------------------
// Review event to state mapping
// ---------------------------------------------------------------------------

type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
type ReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED'

function mapEventToState(event: ReviewEvent): ReviewState {
  switch (event) {
    case 'APPROVE':
      return 'APPROVED'
    case 'REQUEST_CHANGES':
      return 'CHANGES_REQUESTED'
    case 'COMMENT':
      return 'COMMENTED'
  }
}

// ---------------------------------------------------------------------------
// Optimistic object shapes (matching Effect Schema classes structurally)
// ---------------------------------------------------------------------------

export interface OptimisticCommentShape {
  readonly id: number
  readonly node_id?: string
  readonly body: string
  readonly user: { readonly login: string; readonly id: number; readonly avatar_url: string; readonly html_url: string }
  readonly created_at: string
  readonly updated_at: string
  readonly html_url: string
  readonly path?: string
  readonly line?: number | null
  readonly side?: 'LEFT' | 'RIGHT'
  readonly in_reply_to_id?: number
}

export interface OptimisticIssueCommentShape {
  readonly id: number
  readonly node_id?: string
  readonly body: string
  readonly user: { readonly login: string; readonly id: number; readonly avatar_url: string; readonly html_url: string }
  readonly created_at: string
  readonly updated_at: string
  readonly html_url: string
}

export interface OptimisticReviewShape {
  readonly id: number
  readonly body: string | null
  readonly state: string
  readonly user: { readonly login: string; readonly id: number; readonly avatar_url: string; readonly html_url: string }
  readonly html_url: string
  readonly submitted_at: string | null
}

type OptimisticComment = OptimisticCommentShape
type OptimisticIssueComment = OptimisticIssueCommentShape

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

interface CreateCommentInput {
  readonly body: string
  readonly path?: string
  readonly line?: number
  readonly side?: 'LEFT' | 'RIGHT'
  readonly inReplyToId?: number
}

export function createOptimisticComment(input: CreateCommentInput): OptimisticComment {
  const now = new Date().toISOString()
  return {
    id: nextOptimisticId(),
    body: input.body,
    user: OPTIMISTIC_USER,
    created_at: now,
    updated_at: now,
    html_url: '',
    path: input.path,
    line: input.line,
    side: input.side,
    in_reply_to_id: input.inReplyToId,
  }
}

interface CreateIssueCommentInput {
  readonly body: string
}

export function createOptimisticIssueComment(input: CreateIssueCommentInput): OptimisticIssueComment {
  const now = new Date().toISOString()
  return {
    id: nextOptimisticId(),
    body: input.body,
    user: OPTIMISTIC_USER,
    created_at: now,
    updated_at: now,
    html_url: '',
  }
}

interface CreateReviewInput {
  readonly body: string
  readonly event: ReviewEvent
}

export function createOptimisticReview(input: CreateReviewInput): OptimisticReviewShape {
  return {
    id: nextOptimisticId(),
    body: input.body,
    state: mapEventToState(input.event),
    user: OPTIMISTIC_USER,
    html_url: '',
    submitted_at: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Cache updaters (immutable)
// ---------------------------------------------------------------------------

export function applyOptimisticComment<T>(
  old: readonly T[] | undefined,
  newItem: T,
): readonly T[] {
  return old ? [...old, newItem] : [newItem]
}

export function applyOptimisticIssueComment<T>(
  old: readonly T[] | undefined,
  newItem: T,
): readonly T[] {
  return old ? [...old, newItem] : [newItem]
}

export function applyOptimisticReview<T>(
  old: readonly T[] | undefined,
  newItem: T,
): readonly T[] {
  return old ? [...old, newItem] : [newItem]
}

export function applyThreadResolution(
  old: readonly ReviewThread[] | undefined,
  threadId: string,
  isResolved: boolean,
): readonly ReviewThread[] {
  if (!old) return []
  return old.map((thread) =>
    thread.id === threadId
      ? { ...thread, isResolved }
      : thread,
  )
}

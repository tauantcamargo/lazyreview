import { z } from 'zod'

// ---------------------------------------------------------------------------
// Timeline event types — discriminated union
// ---------------------------------------------------------------------------

export const TimelineCommitEventSchema = z.object({
  type: z.literal('commit'),
  id: z.string(),
  timestamp: z.string(),
  sha: z.string(),
  message: z.string(),
  author: z.object({
    login: z.string(),
    avatarUrl: z.string().optional(),
  }),
})

export const TimelineReviewEventSchema = z.object({
  type: z.literal('review'),
  id: z.string(),
  timestamp: z.string(),
  state: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED', 'PENDING']),
  body: z.string(),
  author: z.object({
    login: z.string(),
    avatarUrl: z.string().optional(),
  }),
})

export const TimelineCommentEventSchema = z.object({
  type: z.literal('comment'),
  id: z.string(),
  timestamp: z.string(),
  body: z.string(),
  author: z.object({
    login: z.string(),
    avatarUrl: z.string().optional(),
  }),
  path: z.string().optional(),
  line: z.number().optional(),
})

export const TimelineLabelChangeEventSchema = z.object({
  type: z.literal('label-change'),
  id: z.string(),
  timestamp: z.string(),
  action: z.enum(['added', 'removed']),
  label: z.object({
    name: z.string(),
    color: z.string(),
  }),
  actor: z.object({
    login: z.string(),
    avatarUrl: z.string().optional(),
  }),
})

export const TimelineAssigneeChangeEventSchema = z.object({
  type: z.literal('assignee-change'),
  id: z.string(),
  timestamp: z.string(),
  action: z.enum(['assigned', 'unassigned']),
  assignee: z.object({
    login: z.string(),
    avatarUrl: z.string().optional(),
  }),
  actor: z.object({
    login: z.string(),
    avatarUrl: z.string().optional(),
  }),
})

export const TimelineStatusCheckEventSchema = z.object({
  type: z.literal('status-check'),
  id: z.string(),
  timestamp: z.string(),
  name: z.string(),
  status: z.enum(['pending', 'success', 'failure', 'error', 'cancelled']),
  detailsUrl: z.string().optional(),
})

export const TimelineForcePushEventSchema = z.object({
  type: z.literal('force-push'),
  id: z.string(),
  timestamp: z.string(),
  beforeSha: z.string(),
  afterSha: z.string(),
  actor: z.object({
    login: z.string(),
    avatarUrl: z.string().optional(),
  }),
})

export const TimelineEventSchema = z.discriminatedUnion('type', [
  TimelineCommitEventSchema,
  TimelineReviewEventSchema,
  TimelineCommentEventSchema,
  TimelineLabelChangeEventSchema,
  TimelineAssigneeChangeEventSchema,
  TimelineStatusCheckEventSchema,
  TimelineForcePushEventSchema,
])

export type TimelineEvent = z.infer<typeof TimelineEventSchema>

export type TimelineCommitEvent = z.infer<typeof TimelineCommitEventSchema>
export type TimelineReviewEvent = z.infer<typeof TimelineReviewEventSchema>
export type TimelineCommentEvent = z.infer<typeof TimelineCommentEventSchema>
export type TimelineLabelChangeEvent = z.infer<typeof TimelineLabelChangeEventSchema>
export type TimelineAssigneeChangeEvent = z.infer<typeof TimelineAssigneeChangeEventSchema>
export type TimelineStatusCheckEvent = z.infer<typeof TimelineStatusCheckEventSchema>
export type TimelineForcePushEvent = z.infer<typeof TimelineForcePushEventSchema>

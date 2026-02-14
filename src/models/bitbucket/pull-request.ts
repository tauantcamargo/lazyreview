import { z } from 'zod'

// ---------------------------------------------------------------------------
// Bitbucket User
// ---------------------------------------------------------------------------

export const BitbucketUserSchema = z.object({
  display_name: z.string(),
  uuid: z.string(),
  nickname: z.string().optional(),
  account_id: z.string().optional(),
  links: z
    .object({
      avatar: z.object({ href: z.string() }).optional(),
    })
    .optional(),
})

export type BitbucketUser = z.infer<typeof BitbucketUserSchema>

// ---------------------------------------------------------------------------
// Bitbucket Participant
// ---------------------------------------------------------------------------

export const BitbucketParticipantSchema = z.object({
  user: BitbucketUserSchema,
  role: z.enum(['PARTICIPANT', 'REVIEWER', 'AUTHOR']),
  approved: z.boolean(),
  state: z
    .enum(['approved', 'changes_requested', 'null'])
    .nullable()
    .optional(),
})

export type BitbucketParticipant = z.infer<typeof BitbucketParticipantSchema>

// ---------------------------------------------------------------------------
// Bitbucket Pull Request
// ---------------------------------------------------------------------------

export const BitbucketPullRequestSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullable().transform((v) => v ?? '').default(''),
  state: z.enum(['OPEN', 'MERGED', 'DECLINED', 'SUPERSEDED']),
  author: BitbucketUserSchema,
  source: z.object({
    branch: z.object({ name: z.string() }),
    commit: z.object({ hash: z.string() }),
    repository: z.object({ full_name: z.string() }).optional(),
  }),
  destination: z.object({
    branch: z.object({ name: z.string() }),
    commit: z.object({ hash: z.string() }),
    repository: z.object({ full_name: z.string() }).optional(),
  }),
  reviewers: z.array(BitbucketUserSchema).default([]),
  participants: z.array(BitbucketParticipantSchema).default([]),
  created_on: z.string(),
  updated_on: z.string(),
  close_source_branch: z.boolean().optional(),
  merge_commit: z.object({ hash: z.string() }).nullable().optional(),
  links: z.object({
    html: z.object({ href: z.string() }),
    diff: z.object({ href: z.string() }).optional(),
  }),
  comment_count: z.number().optional().default(0),
  task_count: z.number().optional().default(0),
})

export type BitbucketPullRequest = z.infer<typeof BitbucketPullRequestSchema>

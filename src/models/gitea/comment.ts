import { z } from 'zod'
import { GiteaUserSchema } from './pull-request'

// ---------------------------------------------------------------------------
// Gitea Issue Comment (general PR/issue comments)
// ---------------------------------------------------------------------------

export const GiteaIssueCommentSchema = z.object({
  id: z.number(),
  body: z.string(),
  user: GiteaUserSchema,
  created_at: z.string(),
  updated_at: z.string(),
  html_url: z.string().optional().default(''),
})

export type GiteaIssueComment = z.infer<typeof GiteaIssueCommentSchema>

// ---------------------------------------------------------------------------
// Gitea Pull Review Comment (inline diff comment)
// ---------------------------------------------------------------------------

export const GiteaReviewCommentSchema = z.object({
  id: z.number(),
  body: z.string(),
  user: GiteaUserSchema,
  path: z.string().optional().default(''),
  line: z.number().nullable().optional(),
  old_line_num: z.number().nullable().optional(),
  new_line_num: z.number().nullable().optional(),
  diff_hunk: z.string().optional().default(''),
  pull_request_review_id: z.number().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  html_url: z.string().optional().default(''),
  commit_id: z.string().optional().default(''),
  original_commit_id: z.string().optional().default(''),
})

export type GiteaReviewComment = z.infer<typeof GiteaReviewCommentSchema>

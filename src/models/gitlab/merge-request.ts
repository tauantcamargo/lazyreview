import { z } from 'zod'

// ---------------------------------------------------------------------------
// GitLab User
// ---------------------------------------------------------------------------

export const GitLabUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string(),
  avatar_url: z.string().nullable(),
  web_url: z.string(),
})

export type GitLabUser = z.infer<typeof GitLabUserSchema>

// ---------------------------------------------------------------------------
// GitLab Merge Request
// ---------------------------------------------------------------------------

export const GitLabDiffRefsSchema = z.object({
  base_sha: z.string(),
  head_sha: z.string(),
  start_sha: z.string(),
})

export type GitLabDiffRefs = z.infer<typeof GitLabDiffRefsSchema>

export const GitLabHeadPipelineSchema = z.object({
  id: z.number(),
  status: z.string(),
  web_url: z.string(),
})

export type GitLabHeadPipeline = z.infer<typeof GitLabHeadPipelineSchema>

export const GitLabMergeRequestSchema = z.object({
  id: z.number(),
  iid: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  state: z.enum(['opened', 'closed', 'merged', 'locked']),
  draft: z.boolean().optional().default(false),
  source_branch: z.string(),
  target_branch: z.string(),
  author: GitLabUserSchema,
  assignees: z.array(GitLabUserSchema).optional().default([]),
  reviewers: z.array(GitLabUserSchema).optional().default([]),
  labels: z.array(z.string()).optional().default([]),
  created_at: z.string(),
  updated_at: z.string(),
  merged_at: z.string().nullable().optional(),
  closed_at: z.string().nullable().optional(),
  merge_commit_sha: z.string().nullable().optional(),
  sha: z.string(),
  diff_refs: GitLabDiffRefsSchema.optional(),
  web_url: z.string(),
  user_notes_count: z.number().optional().default(0),
  has_conflicts: z.boolean().optional().default(false),
  merge_status: z.string().optional(),
  head_pipeline: GitLabHeadPipelineSchema.nullable().optional(),
})

export type GitLabMergeRequest = z.infer<typeof GitLabMergeRequestSchema>

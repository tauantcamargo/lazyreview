import { z } from 'zod'

// ---------------------------------------------------------------------------
// Gitea User
// ---------------------------------------------------------------------------

export const GiteaUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  full_name: z.string().optional().default(''),
  avatar_url: z.string().optional().default(''),
})

export type GiteaUser = z.infer<typeof GiteaUserSchema>

// ---------------------------------------------------------------------------
// Gitea Label
// ---------------------------------------------------------------------------

export const GiteaLabelSchema = z.object({
  name: z.string(),
  color: z.string(),
})

export type GiteaLabel = z.infer<typeof GiteaLabelSchema>

// ---------------------------------------------------------------------------
// Gitea Branch Ref
// ---------------------------------------------------------------------------

export const GiteaBranchRefSchema = z.object({
  label: z.string(),
  ref: z.string(),
  sha: z.string(),
  repo: z
    .object({ full_name: z.string() })
    .optional(),
})

export type GiteaBranchRef = z.infer<typeof GiteaBranchRefSchema>

// ---------------------------------------------------------------------------
// Gitea Pull Request
// ---------------------------------------------------------------------------

export const GiteaPullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable().default(''),
  state: z.enum(['open', 'closed']),
  is_locked: z.boolean().optional().default(false),
  user: GiteaUserSchema,
  labels: z.array(GiteaLabelSchema).default([]),
  assignees: z.array(GiteaUserSchema).default([]),
  requested_reviewers: z.array(GiteaUserSchema).default([]),
  created_at: z.string(),
  updated_at: z.string(),
  merged: z.boolean().optional().default(false),
  merged_by: GiteaUserSchema.nullable().optional(),
  merge_base: z.string().optional(),
  head: GiteaBranchRefSchema,
  base: GiteaBranchRefSchema,
  mergeable: z.boolean().optional(),
  html_url: z.string().optional().default(''),
  diff_url: z.string().optional().default(''),
  comments: z.number().optional().default(0),
})

export type GiteaPullRequest = z.infer<typeof GiteaPullRequestSchema>

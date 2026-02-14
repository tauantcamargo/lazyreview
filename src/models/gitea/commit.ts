import { z } from 'zod'
import { GiteaUserSchema } from './pull-request'

// ---------------------------------------------------------------------------
// Gitea Commit
// ---------------------------------------------------------------------------

export const GiteaCommitInfoSchema = z.object({
  message: z.string(),
  author: z.object({
    name: z.string(),
    email: z.string(),
    date: z.string(),
  }),
})

export const GiteaCommitSchema = z.object({
  sha: z.string(),
  commit: GiteaCommitInfoSchema,
  author: GiteaUserSchema.nullable().optional(),
  html_url: z.string().optional().default(''),
})

export type GiteaCommitInfo = z.infer<typeof GiteaCommitInfoSchema>
export type GiteaCommit = z.infer<typeof GiteaCommitSchema>

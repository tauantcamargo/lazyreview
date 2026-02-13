import { z } from 'zod'

// ---------------------------------------------------------------------------
// GitLab Commit
// ---------------------------------------------------------------------------

export const GitLabCommitSchema = z.object({
  id: z.string(),
  short_id: z.string(),
  title: z.string(),
  message: z.string(),
  author_name: z.string(),
  author_email: z.string(),
  authored_date: z.string(),
  committed_date: z.string(),
  web_url: z.string().optional(),
})

export type GitLabCommit = z.infer<typeof GitLabCommitSchema>

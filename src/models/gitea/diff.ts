import { z } from 'zod'

// ---------------------------------------------------------------------------
// Gitea Changed File (from PR files endpoint)
// ---------------------------------------------------------------------------

/**
 * Gitea returns file changes in a shape very similar to GitHub:
 * GET /repos/{owner}/{repo}/pulls/{index}/files
 */
export const GiteaChangedFileSchema = z.object({
  filename: z.string(),
  status: z.string().default('modified'),
  additions: z.number().optional().default(0),
  deletions: z.number().optional().default(0),
  changes: z.number().optional().default(0),
  html_url: z.string().optional().default(''),
  contents_url: z.string().optional().default(''),
  previous_filename: z.string().optional(),
})

export type GiteaChangedFile = z.infer<typeof GiteaChangedFileSchema>

import { z } from 'zod'
import { GiteaUserSchema } from './pull-request'

// ---------------------------------------------------------------------------
// Gitea Pull Request Review
// ---------------------------------------------------------------------------

/**
 * Gitea review states:
 *   PENDING, APPROVED, REQUEST_CHANGES, COMMENT, REQUEST_REVIEW
 */
export const GiteaReviewSchema = z.object({
  id: z.number(),
  user: GiteaUserSchema,
  body: z.string().nullable().default(''),
  state: z.string(),
  submitted_at: z.string().nullable().optional(),
  html_url: z.string().optional().default(''),
  commit_id: z.string().optional().default(''),
})

export type GiteaReview = z.infer<typeof GiteaReviewSchema>

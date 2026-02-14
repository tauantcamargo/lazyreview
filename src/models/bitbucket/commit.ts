import { z } from 'zod'
import { BitbucketUserSchema } from './pull-request'

// ---------------------------------------------------------------------------
// Bitbucket Commit
// ---------------------------------------------------------------------------

export const BitbucketCommitSchema = z.object({
  hash: z.string(),
  message: z.string(),
  date: z.string(),
  author: z.object({
    raw: z.string(),
    user: BitbucketUserSchema.optional(),
  }),
  links: z
    .object({
      html: z.object({ href: z.string() }).optional(),
    })
    .optional(),
})

export type BitbucketCommit = z.infer<typeof BitbucketCommitSchema>

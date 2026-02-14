import { z } from 'zod'

// ---------------------------------------------------------------------------
// Bitbucket DiffStat (file change entry in a PR diffstat)
// ---------------------------------------------------------------------------

export const BitbucketDiffStatSchema = z.object({
  status: z.enum([
    'added',
    'removed',
    'modified',
    'renamed',
    'merge conflict',
  ]),
  old: z.object({ path: z.string() }).nullable(),
  new: z.object({ path: z.string() }).nullable(),
  lines_added: z.number().optional().default(0),
  lines_removed: z.number().optional().default(0),
})

export type BitbucketDiffStat = z.infer<typeof BitbucketDiffStatSchema>

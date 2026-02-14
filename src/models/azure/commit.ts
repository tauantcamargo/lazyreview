import { z } from 'zod'

// ---------------------------------------------------------------------------
// Azure DevOps Commit
// ---------------------------------------------------------------------------

export const AzureCommitSchema = z.object({
  commitId: z.string(),
  comment: z.string().optional().default(''),
  author: z.object({
    name: z.string(),
    email: z.string(),
    date: z.string(),
  }),
  committer: z
    .object({
      name: z.string(),
      email: z.string(),
      date: z.string(),
    })
    .optional(),
  url: z.string().optional(),
  remoteUrl: z.string().optional(),
})

export type AzureCommit = z.infer<typeof AzureCommitSchema>

// ---------------------------------------------------------------------------
// Azure DevOps Commit Change
// ---------------------------------------------------------------------------

export const AzureCommitChangeSchema = z.object({
  item: z.object({
    path: z.string(),
  }),
  changeType: z
    .union([z.string(), z.number()])
    .transform((v) => String(v)),
})

export type AzureCommitChange = z.infer<typeof AzureCommitChangeSchema>

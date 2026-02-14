import { z } from 'zod'

// ---------------------------------------------------------------------------
// Azure DevOps Identity / User
// ---------------------------------------------------------------------------

export const AzureIdentitySchema = z.object({
  id: z.string(),
  displayName: z.string(),
  uniqueName: z.string().optional(),
  imageUrl: z.string().optional(),
  url: z.string().optional(),
})

export type AzureIdentity = z.infer<typeof AzureIdentitySchema>

// ---------------------------------------------------------------------------
// Azure DevOps Reviewer
// ---------------------------------------------------------------------------

export const AzureReviewerSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  uniqueName: z.string().optional(),
  imageUrl: z.string().optional(),
  vote: z.number().default(0),
  isRequired: z.boolean().optional(),
  hasDeclined: z.boolean().optional(),
  isFlagged: z.boolean().optional(),
})

export type AzureReviewer = z.infer<typeof AzureReviewerSchema>

// ---------------------------------------------------------------------------
// Azure DevOps Git Ref
// ---------------------------------------------------------------------------

export const AzureGitRefSchema = z.object({
  name: z.string(),
})

// ---------------------------------------------------------------------------
// Azure DevOps Repository
// ---------------------------------------------------------------------------

export const AzureRepositorySchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().optional(),
  project: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
})

export type AzureRepository = z.infer<typeof AzureRepositorySchema>

// ---------------------------------------------------------------------------
// Azure DevOps Completion Options
// ---------------------------------------------------------------------------

export const AzureCompletionOptionsSchema = z.object({
  mergeStrategy: z.string().optional(),
  deleteSourceBranch: z.boolean().optional(),
  mergeCommitMessage: z.string().optional(),
  squashMerge: z.boolean().optional(),
})

// ---------------------------------------------------------------------------
// Azure DevOps Pull Request
// ---------------------------------------------------------------------------

export const AzurePullRequestSchema = z.object({
  pullRequestId: z.number(),
  title: z.string(),
  description: z
    .string()
    .nullable()
    .transform((v) => v ?? '')
    .default(''),
  status: z.enum(['active', 'abandoned', 'completed', 'all', 'notSet']),
  createdBy: AzureIdentitySchema,
  creationDate: z.string(),
  closedDate: z.string().nullable().optional(),
  sourceRefName: z.string(),
  targetRefName: z.string(),
  mergeStatus: z.string().optional(),
  isDraft: z.boolean().optional().default(false),
  mergeId: z.string().optional(),
  lastMergeSourceCommit: z
    .object({ commitId: z.string() })
    .optional(),
  lastMergeTargetCommit: z
    .object({ commitId: z.string() })
    .optional(),
  lastMergeCommit: z
    .object({ commitId: z.string() })
    .nullable()
    .optional(),
  reviewers: z.array(AzureReviewerSchema).default([]),
  labels: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        active: z.boolean().optional(),
      }),
    )
    .optional()
    .default([]),
  url: z.string().optional(),
  repository: AzureRepositorySchema.optional(),
  completionOptions: AzureCompletionOptionsSchema.optional(),
  supportsIterations: z.boolean().optional(),
})

export type AzurePullRequest = z.infer<typeof AzurePullRequestSchema>

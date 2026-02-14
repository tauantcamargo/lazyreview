import { z } from 'zod'

// ---------------------------------------------------------------------------
// Azure DevOps Iteration
// ---------------------------------------------------------------------------

export const AzureIterationSchema = z.object({
  id: z.number(),
  description: z.string().optional(),
  author: z
    .object({
      id: z.string(),
      displayName: z.string(),
    })
    .optional(),
  createdDate: z.string().optional(),
  updatedDate: z.string().optional(),
  sourceRefCommit: z
    .object({ commitId: z.string() })
    .optional(),
  targetRefCommit: z
    .object({ commitId: z.string() })
    .optional(),
  commonRefCommit: z
    .object({ commitId: z.string() })
    .optional(),
})

export type AzureIteration = z.infer<typeof AzureIterationSchema>

// ---------------------------------------------------------------------------
// Azure DevOps Iteration Change
// ---------------------------------------------------------------------------

export const AzureChangeItemSchema = z.object({
  objectId: z.string().optional(),
  originalObjectId: z.string().optional(),
})

export const AzureIterationChangeSchema = z.object({
  changeId: z.number().optional(),
  changeTrackingId: z.number().optional(),
  item: z
    .object({
      path: z.string(),
    })
    .optional(),
  originalPath: z.string().optional(),
  changeType: z
    .union([z.string(), z.number()])
    .transform((v) => String(v)),
})

export type AzureIterationChange = z.infer<typeof AzureIterationChangeSchema>

// ---------------------------------------------------------------------------
// Azure DevOps Changes Response
// ---------------------------------------------------------------------------

export const AzureChangesResponseSchema = z.object({
  changeEntries: z.array(AzureIterationChangeSchema).default([]),
})

export type AzureChangesResponse = z.infer<typeof AzureChangesResponseSchema>

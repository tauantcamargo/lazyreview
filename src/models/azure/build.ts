import { z } from 'zod'

// ---------------------------------------------------------------------------
// Azure DevOps Build
// ---------------------------------------------------------------------------

export const AzureBuildSchema = z.object({
  id: z.number(),
  buildNumber: z.string().optional(),
  status: z.enum([
    'all',
    'cancelling',
    'completed',
    'inProgress',
    'none',
    'notStarted',
    'postponed',
  ]),
  result: z
    .enum([
      'canceled',
      'failed',
      'none',
      'partiallySucceeded',
      'succeeded',
    ])
    .nullable()
    .optional(),
  definition: z
    .object({
      id: z.number(),
      name: z.string(),
    })
    .optional(),
  sourceBranch: z.string().optional(),
  sourceVersion: z.string().optional(),
  startTime: z.string().nullable().optional(),
  finishTime: z.string().nullable().optional(),
  url: z.string().optional(),
  _links: z
    .object({
      web: z.object({ href: z.string() }).optional(),
    })
    .optional(),
})

export type AzureBuild = z.infer<typeof AzureBuildSchema>

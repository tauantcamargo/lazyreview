import { z } from 'zod'

// ---------------------------------------------------------------------------
// Bitbucket Pipeline Step Result
// ---------------------------------------------------------------------------

export const BitbucketPipelineStepResultSchema = z.object({
  name: z.enum([
    'SUCCESSFUL',
    'FAILED',
    'ERROR',
    'STOPPED',
    'EXPIRED',
    'NOT_RUN',
  ]),
})

export type BitbucketPipelineStepResult = z.infer<
  typeof BitbucketPipelineStepResultSchema
>

// ---------------------------------------------------------------------------
// Bitbucket Pipeline Step State
// ---------------------------------------------------------------------------

export const BitbucketPipelineStepStateSchema = z.object({
  name: z.enum([
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'PAUSED',
    'HALTED',
  ]),
  result: BitbucketPipelineStepResultSchema.optional(),
})

export type BitbucketPipelineStepState = z.infer<
  typeof BitbucketPipelineStepStateSchema
>

// ---------------------------------------------------------------------------
// Bitbucket Pipeline Step
// ---------------------------------------------------------------------------

export const BitbucketPipelineStepSchema = z.object({
  uuid: z.string(),
  name: z.string().optional(),
  state: BitbucketPipelineStepStateSchema,
  started_on: z.string().nullable().optional(),
  completed_on: z.string().nullable().optional(),
})

export type BitbucketPipelineStep = z.infer<typeof BitbucketPipelineStepSchema>

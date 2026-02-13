import { z } from 'zod'

// ---------------------------------------------------------------------------
// GitLab Pipeline Job
// ---------------------------------------------------------------------------

export const GitLabPipelineJobSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.enum([
    'created',
    'pending',
    'running',
    'failed',
    'success',
    'canceled',
    'skipped',
    'manual',
  ]),
  stage: z.string(),
  web_url: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  allow_failure: z.boolean().optional().default(false),
})

export type GitLabPipelineJob = z.infer<typeof GitLabPipelineJobSchema>

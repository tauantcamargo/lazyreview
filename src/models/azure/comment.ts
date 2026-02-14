import { z } from 'zod'
import { AzureIdentitySchema } from './pull-request'

// ---------------------------------------------------------------------------
// Azure DevOps Thread Comment
// ---------------------------------------------------------------------------

export const AzureCommentSchema = z.object({
  id: z.number(),
  parentCommentId: z.number().optional().default(0),
  content: z.string().optional().default(''),
  publishedDate: z.string().optional(),
  lastUpdatedDate: z.string().optional(),
  lastContentUpdatedDate: z.string().optional(),
  commentType: z.enum(['text', 'codeChange', 'system', 'unknown']).optional(),
  author: AzureIdentitySchema,
})

export type AzureComment = z.infer<typeof AzureCommentSchema>

// ---------------------------------------------------------------------------
// Azure DevOps Thread Context (inline position)
// ---------------------------------------------------------------------------

export const AzureThreadContextSchema = z.object({
  filePath: z.string(),
  rightFileStart: z
    .object({ line: z.number(), offset: z.number() })
    .nullable()
    .optional(),
  rightFileEnd: z
    .object({ line: z.number(), offset: z.number() })
    .nullable()
    .optional(),
  leftFileStart: z
    .object({ line: z.number(), offset: z.number() })
    .nullable()
    .optional(),
  leftFileEnd: z
    .object({ line: z.number(), offset: z.number() })
    .nullable()
    .optional(),
})

export type AzureThreadContext = z.infer<typeof AzureThreadContextSchema>

// ---------------------------------------------------------------------------
// Azure DevOps Thread
// ---------------------------------------------------------------------------

export const AzureThreadSchema = z.object({
  id: z.number(),
  publishedDate: z.string().optional(),
  lastUpdatedDate: z.string().optional(),
  comments: z.array(AzureCommentSchema).default([]),
  status: z
    .enum([
      'active',
      'byDesign',
      'closed',
      'fixed',
      'pending',
      'unknown',
      'wontFix',
    ])
    .optional(),
  threadContext: AzureThreadContextSchema.nullable().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  isDeleted: z.boolean().optional().default(false),
})

export type AzureThread = z.infer<typeof AzureThreadSchema>

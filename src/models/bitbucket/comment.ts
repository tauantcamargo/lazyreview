import { z } from 'zod'
import { BitbucketUserSchema } from './pull-request'

// ---------------------------------------------------------------------------
// Bitbucket Comment Content
// ---------------------------------------------------------------------------

export const BitbucketCommentContentSchema = z.object({
  raw: z.string(),
  markup: z.string().optional(),
  html: z.string().optional(),
})

export type BitbucketCommentContent = z.infer<
  typeof BitbucketCommentContentSchema
>

// ---------------------------------------------------------------------------
// Bitbucket Inline Position
// ---------------------------------------------------------------------------

export const BitbucketInlineSchema = z.object({
  path: z.string(),
  from: z.number().nullable().optional(),
  to: z.number().nullable().optional(),
})

export type BitbucketInline = z.infer<typeof BitbucketInlineSchema>

// ---------------------------------------------------------------------------
// Bitbucket Comment
// ---------------------------------------------------------------------------

export const BitbucketCommentSchema = z.object({
  id: z.number(),
  content: BitbucketCommentContentSchema,
  user: BitbucketUserSchema,
  created_on: z.string(),
  updated_on: z.string(),
  deleted: z.boolean().optional().default(false),
  parent: z.object({ id: z.number() }).nullable().optional(),
  inline: BitbucketInlineSchema.nullable().optional(),
})

export type BitbucketComment = z.infer<typeof BitbucketCommentSchema>

import { z } from 'zod'
import { GitLabUserSchema } from './merge-request'

// ---------------------------------------------------------------------------
// GitLab Note Position (for diff notes)
// ---------------------------------------------------------------------------

export const GitLabNotePositionSchema = z.object({
  base_sha: z.string(),
  head_sha: z.string(),
  start_sha: z.string(),
  old_path: z.string(),
  new_path: z.string(),
  old_line: z.number().nullable(),
  new_line: z.number().nullable(),
})

export type GitLabNotePosition = z.infer<typeof GitLabNotePositionSchema>

// ---------------------------------------------------------------------------
// GitLab Note (comments in GitLab are called "notes")
// ---------------------------------------------------------------------------

export const GitLabNoteSchema = z.object({
  id: z.number(),
  body: z.string(),
  author: GitLabUserSchema,
  created_at: z.string(),
  updated_at: z.string(),
  system: z.boolean(),
  resolvable: z.boolean().optional().default(false),
  resolved: z.boolean().optional().default(false),
  resolved_by: GitLabUserSchema.nullable().optional(),
  type: z.string().nullable().optional(),
  position: GitLabNotePositionSchema.optional(),
})

export type GitLabNote = z.infer<typeof GitLabNoteSchema>

// ---------------------------------------------------------------------------
// GitLab Discussion (thread of notes)
// ---------------------------------------------------------------------------

export const GitLabDiscussionSchema = z.object({
  id: z.string(),
  individual_note: z.boolean(),
  notes: z.array(GitLabNoteSchema),
})

export type GitLabDiscussion = z.infer<typeof GitLabDiscussionSchema>

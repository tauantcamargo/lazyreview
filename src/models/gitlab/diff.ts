import { z } from 'zod'

// ---------------------------------------------------------------------------
// GitLab Diff (file change in a merge request)
// ---------------------------------------------------------------------------

export const GitLabDiffSchema = z.object({
  old_path: z.string(),
  new_path: z.string(),
  a_mode: z.string(),
  b_mode: z.string(),
  diff: z.string(),
  new_file: z.boolean(),
  renamed_file: z.boolean(),
  deleted_file: z.boolean(),
})

export type GitLabDiff = z.infer<typeof GitLabDiffSchema>

import { z } from 'zod'

/**
 * Zod schema for a repository label from the GitHub API.
 * Used for validating GET /repos/{owner}/{repo}/labels responses.
 */
export const RepoLabelSchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
  description: z.union([z.string(), z.null()]).optional().default(null),
  default: z.boolean().optional().default(false),
})

export type RepoLabel = z.infer<typeof RepoLabelSchema>

/**
 * Schema for an array of repo labels.
 */
export const RepoLabelsSchema = z.array(RepoLabelSchema)

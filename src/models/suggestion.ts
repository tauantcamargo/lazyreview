import { z } from 'zod'

// ---------------------------------------------------------------------------
// Suggestion parameter types
// ---------------------------------------------------------------------------

export const SuggestionParamsSchema = z.object({
  prNumber: z.number(),
  body: z.string(),
  path: z.string(),
  line: z.number(),
  side: z.enum(['LEFT', 'RIGHT']),
  /** The suggested replacement code lines */
  suggestion: z.string(),
  /** Optional start line for multi-line suggestions */
  startLine: z.number().optional(),
  /** Commit SHA to attach the suggestion to */
  commitId: z.string().optional(),
})

export type SuggestionParams = z.infer<typeof SuggestionParamsSchema>

export const AcceptSuggestionParamsSchema = z.object({
  prNumber: z.number(),
  /** The comment ID containing the suggestion */
  commentId: z.number(),
  /** Optional commit message for the suggestion commit */
  commitMessage: z.string().optional(),
})

export type AcceptSuggestionParams = z.infer<typeof AcceptSuggestionParamsSchema>

// ---------------------------------------------------------------------------
// Helper to format suggestion body in GitHub-compatible markdown
// ---------------------------------------------------------------------------

/**
 * Wraps a code suggestion in the provider-appropriate markdown syntax.
 * GitHub uses triple-backtick suggestion blocks.
 */
export function formatSuggestionBody(
  body: string,
  suggestion: string,
): string {
  const suggestionBlock = [
    '```suggestion',
    suggestion,
    '```',
  ].join('\n')

  return body.length > 0
    ? `${body}\n\n${suggestionBlock}`
    : suggestionBlock
}

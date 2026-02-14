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
// Provider type for format selection (avoids circular import)
// ---------------------------------------------------------------------------

type SuggestionProviderType = 'github' | 'gitlab' | 'bitbucket' | 'azure' | 'gitea'

// ---------------------------------------------------------------------------
// GitHub suggestion formatting
// ---------------------------------------------------------------------------

/**
 * Wraps a code suggestion in GitHub-compatible markdown syntax.
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

// ---------------------------------------------------------------------------
// GitLab suggestion formatting
// ---------------------------------------------------------------------------

/**
 * Wraps a code suggestion in GitLab-compatible markdown syntax.
 * GitLab uses triple-backtick suggestion blocks with range metadata.
 */
export function formatGitLabSuggestionBody(
  body: string,
  suggestion: string,
): string {
  const suggestionBlock = [
    '```suggestion:-0+0',
    suggestion,
    '```',
  ].join('\n')

  return body.length > 0
    ? `${body}\n\n${suggestionBlock}`
    : suggestionBlock
}

// ---------------------------------------------------------------------------
// Fallback suggestion formatting (for providers without native support)
// ---------------------------------------------------------------------------

/**
 * Formats a suggestion as a plain comment with "Suggested change:" prefix.
 * Used for providers that do not support native suggestion blocks.
 */
export function formatFallbackSuggestionBody(
  body: string,
  suggestion: string,
): string {
  const codeBlock = [
    '```',
    suggestion,
    '```',
  ].join('\n')

  const suggestionSection = `**Suggested change:**\n${codeBlock}`

  return body.length > 0
    ? `${body}\n\n${suggestionSection}`
    : suggestionSection
}

// ---------------------------------------------------------------------------
// Provider-aware formatting dispatcher
// ---------------------------------------------------------------------------

/**
 * Formats a suggestion comment body using the appropriate syntax for the
 * given provider type.
 */
export function formatSuggestionForProvider(
  providerType: SuggestionProviderType,
  body: string,
  suggestion: string,
): string {
  switch (providerType) {
    case 'github':
      return formatSuggestionBody(body, suggestion)
    case 'gitlab':
      return formatGitLabSuggestionBody(body, suggestion)
    case 'bitbucket':
    case 'azure':
    case 'gitea':
      return formatFallbackSuggestionBody(body, suggestion)
  }
}

// ---------------------------------------------------------------------------
// Suggestion block parsing
// ---------------------------------------------------------------------------

/** Regex matching GitHub and GitLab suggestion fenced code blocks. */
const SUGGESTION_BLOCK_RE = /```suggestion(?::[^\n]*)?\n([\s\S]*?)\n```/

export interface ParsedSuggestion {
  /** The suggested replacement code */
  readonly suggestion: string
  /** Any comment text preceding the suggestion block */
  readonly commentText: string
}

/**
 * Parses a comment body to extract a suggestion block.
 * Returns null if no suggestion block is found.
 */
export function parseSuggestionBlock(body: string): ParsedSuggestion | null {
  if (!body) return null

  const match = SUGGESTION_BLOCK_RE.exec(body)
  if (!match) return null

  const suggestion = match[1] ?? ''
  const blockStart = match.index ?? 0
  const commentText = body.slice(0, blockStart).replace(/\n+$/, '').trim()

  return { suggestion, commentText }
}

/**
 * Checks whether a comment body contains a suggestion block.
 */
export function hasSuggestionBlock(body: string): boolean {
  return SUGGESTION_BLOCK_RE.test(body)
}

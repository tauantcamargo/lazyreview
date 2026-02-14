/**
 * AI PR summary prompt templates for generating structured PR overviews.
 *
 * Builds messages for the AI service to analyze a PR's title, description,
 * commits, changed files, and diff content to produce a concise summary.
 */
import type { AiMessage } from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PRSummaryPromptParams {
  readonly title: string
  readonly description: string
  readonly commits: readonly { readonly message: string; readonly sha: string }[]
  readonly files: readonly {
    readonly filename: string
    readonly additions: number
    readonly deletions: number
  }[]
  readonly diffSample?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DESCRIPTION_LENGTH = 1000
const MAX_DIFF_CHARS = 16000
const MAX_COMMITS_SHOWN = 20
const MAX_FILES_SHOWN = 30

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a senior engineer summarizing a pull request for code reviewers.

Your task:
- Analyze the PR metadata, commits, changed files, and diff to produce a concise summary
- Help reviewers quickly understand what changed and where to focus
- Be specific and actionable — avoid generic statements
- Keep the total response under 400 words

Format your response as markdown with exactly these sections:

## What changed
2-3 sentences summarizing the key changes in this PR.

## Why
Infer the motivation from the PR title, description, and commit messages. If unclear, state what you can deduce.

## Risk areas
Bulleted list of files or patterns that need careful review. Consider:
- Complex logic changes
- Security-sensitive code (auth, crypto, input validation)
- Database/migration changes
- Public API surface changes
- Error handling gaps

If no significant risks, write "No significant risks identified."

## Complexity
Rate as **Low**, **Medium**, or **High** with a one-sentence justification.
- Low: Simple refactor, docs, config changes, or straightforward bug fixes
- Medium: Feature additions, moderate refactoring, multiple file changes
- High: Architectural changes, complex business logic, cross-cutting concerns
`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Truncate a diff sample to fit within token budget.
 * Approximately 4 chars per token, so 16000 chars ~ 4000 tokens.
 */
export function truncateDiffSample(
  diff: string | undefined,
  maxChars: number = MAX_DIFF_CHARS,
): string {
  if (!diff || diff.length === 0) return ''
  if (diff.length <= maxChars) return diff
  return diff.slice(0, maxChars) + '\n... (truncated)'
}

/**
 * Format commits as a bullet list with short SHAs.
 * Limits to MAX_COMMITS_SHOWN commits for large PRs.
 */
export function formatCommitList(
  commits: readonly { readonly message: string; readonly sha: string }[],
): string {
  if (commits.length === 0) return 'No commits available.'

  const shown = commits.slice(0, MAX_COMMITS_SHOWN)
  const lines = shown.map((c) => {
    const shortSha = c.sha.slice(0, 7)
    const firstLine = c.message.split('\n')[0] ?? c.message
    return `- ${shortSha} ${firstLine}`
  })

  if (commits.length > MAX_COMMITS_SHOWN) {
    const remaining = commits.length - MAX_COMMITS_SHOWN
    lines.push(`- ... and ${remaining} more commits`)
  }

  return lines.join('\n')
}

/**
 * Format file stats as a compact list with additions/deletions.
 * Limits to MAX_FILES_SHOWN files for large PRs.
 */
export function formatFileStats(
  files: readonly {
    readonly filename: string
    readonly additions: number
    readonly deletions: number
  }[],
): string {
  if (files.length === 0) return 'No files changed.'

  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0)
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0)
  const summary = `Total: ${files.length} files, +${totalAdditions} -${totalDeletions}`

  const shown = files.slice(0, MAX_FILES_SHOWN)
  const lines = shown.map(
    (f) => `- ${f.filename} (+${f.additions} -${f.deletions})`,
  )

  if (files.length > MAX_FILES_SHOWN) {
    const remaining = files.length - MAX_FILES_SHOWN
    lines.push(`- ... and ${remaining} more files`)
  }

  return `${summary}\n${lines.join('\n')}`
}

function buildUserContent(params: PRSummaryPromptParams): string {
  const parts: string[] = []

  parts.push(`## PR Title\n${params.title}`)

  parts.push(
    `\n## PR Description\n${
      params.description.length > 0
        ? params.description.length > MAX_DESCRIPTION_LENGTH
          ? params.description.slice(0, MAX_DESCRIPTION_LENGTH) + '...'
          : params.description
        : 'No description provided.'
    }`,
  )

  parts.push(`\n## Commits\n${formatCommitList(params.commits)}`)

  parts.push(`\n## Changed files\n${formatFileStats(params.files)}`)

  const truncatedDiff = truncateDiffSample(params.diffSample)
  if (truncatedDiff.length > 0) {
    parts.push(`\n## Diff sample\n\`\`\`diff\n${truncatedDiff}\n\`\`\``)
  }

  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the message array for an AI PR summary request.
 *
 * Returns a system message followed by a user message containing
 * PR metadata, commits, file stats, and an optional diff sample.
 */
export function buildPRSummaryPrompt(
  params: PRSummaryPromptParams,
): readonly AiMessage[] {
  return Object.freeze([
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: buildUserContent(params) },
  ])
}

/**
 * AI review prompt templates for line-level code analysis.
 *
 * Builds structured messages for the AI service to analyze
 * selected code from diff views.
 */
import type { AiMessage } from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LineContext = 'added' | 'removed' | 'unchanged' | 'mixed'

export interface LineReviewPromptParams {
  readonly code: string
  readonly filename: string
  readonly language: string
  readonly context: LineContext
  readonly prTitle?: string
  readonly prDescription?: string
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a senior code reviewer analyzing selected code from a pull request diff.

Your task:
- Analyze the selected code for bugs, security issues, and performance problems
- Suggest improvements with concise code examples
- Be actionable and specific — avoid vague advice
- Keep your response under 300 words

Format your response as markdown with these sections:

## Summary
One sentence describing what this code does and its overall quality.

## Issues
Bulleted list of bugs, security vulnerabilities, or logic errors found.
If none, write "No issues found."

## Suggestions
Bulleted list of concrete improvements with code snippets where helpful.
If none, write "Code looks good as-is."
`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function describeContext(context: LineContext): string {
  switch (context) {
    case 'added':
      return 'This code was added in the pull request.'
    case 'removed':
      return 'This code was removed in the pull request.'
    case 'unchanged':
      return 'This code is unchanged context around the diff.'
    case 'mixed':
      return 'This selection contains both added and removed lines from the diff.'
  }
}

function buildUserContent(params: LineReviewPromptParams): string {
  const parts: string[] = []

  if (params.prTitle) {
    parts.push(`PR Title: ${params.prTitle}`)
  }
  if (params.prDescription) {
    const desc = params.prDescription.length > 500
      ? `${params.prDescription.slice(0, 500)}...`
      : params.prDescription
    parts.push(`PR Description: ${desc}`)
  }

  parts.push(`File: ${params.filename}`)
  parts.push(`Language: ${params.language}`)
  parts.push(describeContext(params.context))
  parts.push('')
  parts.push('```' + params.language)
  parts.push(params.code)
  parts.push('```')

  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the message array for an AI line review request.
 *
 * Returns a system message followed by a user message containing
 * the code snippet and contextual metadata.
 */
export function buildLineReviewPrompt(
  params: LineReviewPromptParams,
): readonly AiMessage[] {
  return Object.freeze([
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: buildUserContent(params) },
  ])
}

/**
 * Determine the line context type from a set of diff line types.
 *
 * @param lineTypes - Set of line types ('add', 'del', 'context', 'header')
 * @returns The appropriate LineContext value
 */
export function determineLineContext(
  lineTypes: ReadonlySet<string>,
): LineContext {
  const hasAdd = lineTypes.has('add')
  const hasDel = lineTypes.has('del')
  const hasContext = lineTypes.has('context')

  if (hasAdd && hasDel) return 'mixed'
  if (hasAdd) return 'added'
  if (hasDel) return 'removed'
  if (hasContext) return 'unchanged'
  return 'mixed'
}

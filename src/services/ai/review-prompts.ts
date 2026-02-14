/**
 * AI diff analysis prompt templates for generating structured code review annotations.
 *
 * Builds messages for the AI service to analyze a file diff and produce
 * line-level annotations with severity, message, and optional suggestions.
 */
import { z } from 'zod'
import type { AiMessage } from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiAnnotationSeverity = 'info' | 'warning' | 'error'

export interface AiAnnotation {
  readonly line: number
  readonly severity: AiAnnotationSeverity
  readonly message: string
  readonly suggestion?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DIFF_CHARS = 32000

// ---------------------------------------------------------------------------
// Zod schema for parsing AI response
// ---------------------------------------------------------------------------

const AiAnnotationSchema = z.object({
  line: z.coerce.number().int().positive(),
  severity: z.enum(['info', 'warning', 'error']),
  message: z.string().min(1),
  suggestion: z.string().optional(),
})

const AiAnnotationsArraySchema = z.array(z.unknown())

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a senior code reviewer analyzing a diff for potential issues.

Your task:
- Analyze the diff carefully for bugs, security issues, performance problems, and code quality
- Report issues as a JSON array of annotation objects
- Be specific and actionable — avoid vague or generic feedback
- Focus on the changed lines (lines starting with + or -)
- Only report genuine issues, not style preferences

Respond with ONLY a JSON array in this exact format (no other text):

[
  {
    "line": <line_number>,
    "severity": "info" | "warning" | "error",
    "message": "<concise description of the issue>",
    "suggestion": "<optional fix or improvement>"
  }
]

Severity guidelines:
- "info": Style improvements, minor refactoring suggestions, documentation hints
- "warning": Potential bugs, missing error handling, edge cases, performance concerns
- "error": Security vulnerabilities, definite bugs, data loss risks, crashes

If no issues are found, respond with an empty array: []

The "line" field must be the line number in the NEW file (right side of the diff).
The "suggestion" field is optional — include it when you have a concrete fix.`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Truncate diff content to fit within token budget.
 */
function truncateDiff(diff: string): string {
  if (diff.length <= MAX_DIFF_CHARS) return diff
  return diff.slice(0, MAX_DIFF_CHARS) + '\n... (truncated)'
}

/**
 * Extract a JSON array from an AI response that may contain surrounding text.
 * Handles:
 * - Pure JSON array responses
 * - JSON wrapped in markdown code fences
 * - JSON array embedded in prose text
 */
function extractJsonArray(response: string): string | null {
  // Try the raw response first
  const trimmed = response.trim()
  if (trimmed.startsWith('[')) {
    return trimmed
  }

  // Try to extract from markdown code fences
  const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/.exec(response)
  if (fenceMatch?.[1]) {
    const inner = fenceMatch[1].trim()
    if (inner.startsWith('[')) {
      return inner
    }
  }

  // Try to find a bare JSON array in the text
  const arrayMatch = /\[[\s\S]*\]/.exec(response)
  if (arrayMatch?.[0]) {
    return arrayMatch[0]
  }

  return null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the message array for an AI diff analysis request.
 *
 * Returns a system message instructing structured JSON output followed
 * by a user message containing the filename and diff content.
 */
export function buildDiffAnalysisPrompt(
  filename: string,
  diffContent: string,
): readonly AiMessage[] {
  const truncatedDiff = truncateDiff(diffContent)
  const userContent = [
    `## File: ${filename}`,
    '',
    diffContent.length > 0
      ? `\`\`\`diff\n${truncatedDiff}\n\`\`\``
      : 'No diff content available.',
  ].join('\n')

  return Object.freeze([
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: userContent },
  ])
}

/**
 * Parse an AI response string into structured annotations.
 *
 * Handles various response formats:
 * - Pure JSON arrays
 * - JSON in markdown code fences
 * - JSON arrays embedded in prose
 *
 * Invalid or malformed responses return an empty array.
 * Individual annotations that fail validation are silently filtered out.
 */
export function parseAiAnnotations(response: string): readonly AiAnnotation[] {
  if (!response || response.trim().length === 0) {
    return []
  }

  const jsonStr = extractJsonArray(response)
  if (!jsonStr) {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return []
  }

  const arrayResult = AiAnnotationsArraySchema.safeParse(parsed)
  if (!arrayResult.success) {
    return []
  }

  const annotations: AiAnnotation[] = []

  for (const item of arrayResult.data) {
    const result = AiAnnotationSchema.safeParse(item)
    if (result.success) {
      annotations.push({
        line: result.data.line,
        severity: result.data.severity,
        message: result.data.message,
        suggestion: result.data.suggestion,
      })
    }
  }

  return annotations
}

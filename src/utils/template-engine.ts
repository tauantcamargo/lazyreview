import type { CommentTemplate } from '../models/comment-template'

/**
 * Variables available for substitution in comment templates.
 */
export interface TemplateVariables {
  readonly file?: string
  readonly line?: string
  readonly author?: string
}

/**
 * Result of resolving a template -- the final text and the cursor position offset.
 */
export interface ResolvedTemplate {
  readonly text: string
  readonly cursorOffset: number
}

const CURSOR_PLACEHOLDER = '{{cursor}}'

/**
 * Known variable patterns to substitute.
 */
const VARIABLE_PATTERN = /\{\{(file|line|author)\}\}/g

/**
 * Resolve a comment template by substituting variables and computing cursor position.
 *
 * The template body may contain:
 * - `{{file}}` -- replaced with the current filename
 * - `{{line}}` -- replaced with the current line number
 * - `{{author}}` -- replaced with the PR author
 * - `{{cursor}}` -- removed from output, cursor placed at this position
 *
 * The prefix is prepended to the body with a space separator (unless prefix
 * already ends with a space or is empty/undefined).
 *
 * @param template - The comment template to resolve
 * @param variables - Variable values to substitute
 * @returns Resolved text and cursor offset
 */
export function resolveTemplate(
  template: CommentTemplate,
  variables: TemplateVariables,
): ResolvedTemplate {
  // Substitute known variables in body (not cursor)
  const bodyWithVars = template.body.replace(
    VARIABLE_PATTERN,
    (_match, varName: string) => {
      const value = variables[varName as keyof TemplateVariables]
      return value ?? ''
    },
  )

  // Build full text with prefix
  const prefix = template.prefix ?? ''
  let fullText: string

  if (prefix.length === 0) {
    fullText = bodyWithVars
  } else if (prefix.endsWith(' ')) {
    fullText = `${prefix}${bodyWithVars}`
  } else {
    fullText = `${prefix} ${bodyWithVars}`
  }

  // Find cursor position and remove the placeholder
  const cursorIndex = fullText.indexOf(CURSOR_PLACEHOLDER)

  if (cursorIndex === -1) {
    // No cursor placeholder -- cursor goes to end
    return { text: fullText, cursorOffset: fullText.length }
  }

  const text = fullText.slice(0, cursorIndex) + fullText.slice(cursorIndex + CURSOR_PLACEHOLDER.length)
  return { text, cursorOffset: cursorIndex }
}

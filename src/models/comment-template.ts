import { z } from 'zod'

/**
 * Schema for a reusable comment template with optional prefix and variable substitution.
 */
export const CommentTemplateSchema = z.object({
  name: z.string().min(1),
  prefix: z.string().optional(),
  body: z.string().min(1),
  description: z.string().optional(),
})

export type CommentTemplate = z.infer<typeof CommentTemplateSchema>

/**
 * Default comment templates shipped with LazyReview.
 *
 * Variable placeholders:
 * - `{{file}}` -- current filename
 * - `{{line}}` -- current line number
 * - `{{author}}` -- PR author
 * - `{{cursor}}` -- cursor position after insertion
 */
export const DEFAULT_TEMPLATES: readonly CommentTemplate[] = [
  { name: 'Nit', prefix: 'nit:', body: '{{cursor}}', description: 'Minor style or preference issue' },
  { name: 'Blocking', prefix: 'blocking:', body: '{{cursor}}', description: 'Must be addressed before merge' },
  { name: 'Question', prefix: 'question:', body: '{{cursor}}', description: 'Clarification needed' },
  { name: 'Suggestion', prefix: 'suggestion:', body: 'Consider {{cursor}}', description: 'Alternative approach' },
  { name: 'Praise', prefix: '', body: 'Nice! {{cursor}}', description: 'Positive feedback' },
  { name: 'TODO', prefix: 'TODO:', body: '{{cursor}}', description: 'Follow-up task needed' },
  { name: 'Security', prefix: 'security:', body: 'Potential security concern: {{cursor}}', description: 'Security-related feedback' },
  { name: 'Performance', prefix: 'perf:', body: 'Performance consideration: {{cursor}}', description: 'Performance-related feedback' },
  { name: 'Missing Tests', prefix: '', body: 'Missing test coverage for {{cursor}}', description: 'Tests needed' },
  { name: 'Type Safety', prefix: '', body: 'Type safety concern: {{cursor}}', description: 'TypeScript type issue' },
] as const

/**
 * Merge default templates with user-provided templates.
 *
 * User templates with the same name as a default template override the default.
 * User templates with new names are appended after the defaults.
 */
export function mergeTemplates(
  defaults: readonly CommentTemplate[],
  userTemplates: readonly CommentTemplate[] | undefined,
): readonly CommentTemplate[] {
  if (!userTemplates || userTemplates.length === 0) {
    return defaults
  }

  const userByName = new Map(userTemplates.map((t) => [t.name, t]))

  // Replace defaults that have user overrides, keep the rest
  const merged = defaults.map((d) => userByName.get(d.name) ?? d)

  // Append user templates that are not overrides (new names only)
  const defaultNames = new Set(defaults.map((d) => d.name))
  const additions = userTemplates.filter((t) => !defaultNames.has(t.name))

  return [...merged, ...additions]
}

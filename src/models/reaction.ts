import { z } from 'zod'

/**
 * The standard reaction types supported by GitHub's API.
 * GitHub uses these exact string values in its API.
 */
export const REACTION_TYPES = [
  '+1',
  '-1',
  'laugh',
  'hooray',
  'confused',
  'heart',
  'rocket',
  'eyes',
] as const

export type ReactionType = (typeof REACTION_TYPES)[number]

/**
 * Human-readable labels for each reaction type.
 */
export const REACTION_LABELS: Readonly<Record<ReactionType, string>> = {
  '+1': 'thumbsup',
  '-1': 'thumbsdown',
  laugh: 'laugh',
  hooray: 'hooray',
  confused: 'confused',
  heart: 'heart',
  rocket: 'rocket',
  eyes: 'eyes',
}

/**
 * Emoji display for each reaction type in TUI.
 * Using text-safe characters that render well in terminals.
 */
export const REACTION_EMOJI: Readonly<Record<ReactionType, string>> = {
  '+1': '+1',
  '-1': '-1',
  laugh: 'laugh',
  hooray: 'hooray',
  confused: 'confused',
  heart: 'heart',
  rocket: 'rocket',
  eyes: 'eyes',
}

/**
 * Zod schema for a reaction summary on a comment.
 * Represents aggregated reaction counts per type.
 */
export const ReactionSummarySchema = z.object({
  '+1': z.number().default(0),
  '-1': z.number().default(0),
  laugh: z.number().default(0),
  hooray: z.number().default(0),
  confused: z.number().default(0),
  heart: z.number().default(0),
  rocket: z.number().default(0),
  eyes: z.number().default(0),
  total_count: z.number().default(0),
})

export type ReactionSummary = z.infer<typeof ReactionSummarySchema>

/**
 * Creates an empty reaction summary with all counts at zero.
 */
export function emptyReactionSummary(): ReactionSummary {
  return {
    '+1': 0,
    '-1': 0,
    laugh: 0,
    hooray: 0,
    confused: 0,
    heart: 0,
    rocket: 0,
    eyes: 0,
    total_count: 0,
  }
}

/**
 * Returns only the reactions that have a count > 0.
 */
export function activeReactions(
  summary: ReactionSummary,
): readonly { readonly type: ReactionType; readonly count: number }[] {
  return REACTION_TYPES.filter((type) => summary[type] > 0).map((type) => ({
    type,
    count: summary[type],
  }))
}

/**
 * Format a reaction summary into a compact display string.
 * Example: "+1 (3) heart (1)"
 */
export function formatReactionSummary(summary: ReactionSummary): string {
  const active = activeReactions(summary)
  if (active.length === 0) return ''
  return active.map((r) => `${REACTION_LABELS[r.type]} (${r.count})`).join('  ')
}

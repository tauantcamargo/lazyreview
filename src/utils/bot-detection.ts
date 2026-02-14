/**
 * Bot detection utilities for identifying bot-generated PR comments.
 *
 * Used to surface AI review summaries and CI bot comments in the
 * DescriptionTab's "Bot Summary" section.
 */

/**
 * Default patterns for detecting bot accounts.
 * A username ending with `[bot]` is the standard GitHub convention.
 */
export const DEFAULT_BOT_PATTERNS: readonly string[] = Object.freeze([
  '[bot]',
])

/**
 * Minimal comment shape required for bot detection.
 * Avoids coupling to the full Comment model.
 */
export interface BotDetectableComment {
  readonly id: number
  readonly body: string
  readonly user: { readonly login: string }
  readonly created_at: string
  readonly updated_at: string
  readonly html_url: string
}

/**
 * Check if a username belongs to a bot account.
 *
 * Detection rules:
 * 1. Username ends with `[bot]` (GitHub convention)
 * 2. Username is in the configurable custom bot list (case-insensitive)
 *
 * @param username - The username to check
 * @param customBotUsernames - Optional list of additional bot usernames
 * @returns true if the username is a bot
 */
export function isBotUser(
  username: string,
  customBotUsernames?: readonly string[],
): boolean {
  if (username === '') return false

  // Check GitHub [bot] suffix convention
  if (username.endsWith('[bot]')) return true

  // Check custom bot usernames (case-insensitive)
  if (customBotUsernames && customBotUsernames.length > 0) {
    const lowerUsername = username.toLowerCase()
    return customBotUsernames.some(
      (bot) => bot.toLowerCase() === lowerUsername,
    )
  }

  return false
}

/**
 * Find the most recent bot comment from a list of comments.
 *
 * Searches through issue comments to find ones authored by bot accounts,
 * then returns the most recently created one.
 *
 * @param comments - Array of comments to search
 * @param customBotUsernames - Optional list of additional bot usernames
 * @returns The most recent bot comment, or null if none found
 */
export function findMostRecentBotComment(
  comments: readonly BotDetectableComment[],
  customBotUsernames?: readonly string[],
): BotDetectableComment | null {
  const botComments = comments.filter((comment) =>
    isBotUser(comment.user.login, customBotUsernames),
  )

  if (botComments.length === 0) return null

  return botComments.reduce((most, current) =>
    current.created_at > most.created_at ? current : most,
  )
}

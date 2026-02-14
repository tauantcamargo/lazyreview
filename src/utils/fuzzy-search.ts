/**
 * Simple fuzzy matching algorithm for the command palette.
 *
 * Checks if all characters in the query appear in order in the target string.
 * Scores matches based on consecutive runs, word boundary matches, and prefix matches.
 */

export interface FuzzyResult {
  /** Match score -- higher is better */
  readonly score: number
  /** Indices in the target string that matched */
  readonly indices: readonly number[]
}

export interface FuzzyFilterResult<T> {
  readonly item: T
  readonly score: number
  readonly indices: readonly number[]
}

/**
 * Bonus points for different match characteristics.
 * These are additive: a match at a word boundary that is also consecutive
 * gets both bonuses.
 */
const CONSECUTIVE_BONUS = 5
const WORD_BOUNDARY_BONUS = 10
const PREFIX_BONUS = 15
const BASE_MATCH_SCORE = 1

/**
 * Check if a character is at a word boundary in the target string.
 * A word boundary is: start of string, after a space, after punctuation,
 * or a lowercase-to-uppercase transition (camelCase).
 */
function isWordBoundary(target: string, index: number): boolean {
  if (index === 0) return true
  const prev = target[index - 1]!
  const curr = target[index]!
  // After space or punctuation
  if (prev === ' ' || prev === '-' || prev === '_' || prev === '/' || prev === '+') return true
  // camelCase transition
  if (prev === prev.toLowerCase() && curr === curr.toUpperCase() && curr !== curr.toLowerCase()) {
    return true
  }
  return false
}

/**
 * Perform fuzzy matching of a query against a target string.
 *
 * All characters in the query must appear in order in the target.
 * Returns null if no match, or a FuzzyResult with score and match indices.
 *
 * @param query - The search query (case insensitive)
 * @param target - The string to match against
 * @returns FuzzyResult if matched, null otherwise
 */
export function fuzzyMatch(query: string, target: string): FuzzyResult | null {
  if (query.length === 0) {
    return { score: 0, indices: [] }
  }

  const queryLower = query.toLowerCase()
  const targetLower = target.toLowerCase()

  if (queryLower.length > targetLower.length) {
    return null
  }

  const indices: number[] = []
  let score = 0
  let queryIndex = 0
  let lastMatchIndex = -2 // Initialize to impossible value so first match is not consecutive

  for (let targetIndex = 0; targetIndex < targetLower.length && queryIndex < queryLower.length; targetIndex++) {
    if (targetLower[targetIndex] === queryLower[queryIndex]) {
      indices.push(targetIndex)
      score += BASE_MATCH_SCORE

      // Consecutive bonus
      if (targetIndex === lastMatchIndex + 1) {
        score += CONSECUTIVE_BONUS
      }

      // Word boundary bonus
      if (isWordBoundary(target, targetIndex)) {
        score += WORD_BOUNDARY_BONUS
      }

      // Prefix bonus (matching at the start of the string)
      if (targetIndex === queryIndex) {
        score += PREFIX_BONUS
      }

      lastMatchIndex = targetIndex
      queryIndex++
    }
  }

  // All query characters must be matched
  if (queryIndex !== queryLower.length) {
    return null
  }

  return { score, indices: [...indices] }
}

/**
 * Filter and sort items by fuzzy matching a query against a text property.
 *
 * @param items - The items to filter
 * @param query - The search query
 * @param getText - Function to extract the searchable text from an item
 * @returns Filtered and sorted results with match metadata
 */
export function fuzzyFilter<T>(
  items: readonly T[],
  query: string,
  getText: (item: T) => string,
): readonly FuzzyFilterResult<T>[] {
  if (query.length === 0) {
    return items.map((item) => ({
      item,
      score: 0,
      indices: [],
    }))
  }

  const results: FuzzyFilterResult<T>[] = []

  for (const item of items) {
    const text = getText(item)
    const match = fuzzyMatch(query, text)
    if (match !== null) {
      results.push({
        item,
        score: match.score,
        indices: match.indices,
      })
    }
  }

  // Sort by score descending (higher score = better match)
  return [...results].sort((a, b) => b.score - a.score)
}

/**
 * Word-level diff highlighting for paired add/del diff lines.
 *
 * Tokenizes two lines into words/punctuation/whitespace, computes LCS
 * to find matching tokens, and returns segments marked equal or changed.
 */

export interface WordDiffSegment {
  readonly text: string
  readonly type: 'equal' | 'changed'
}

export interface WordDiffResult {
  readonly oldSegments: readonly WordDiffSegment[]
  readonly newSegments: readonly WordDiffSegment[]
}

/**
 * Tokenize a line into an array of tokens.
 * Tokens are: runs of word characters, runs of whitespace, or individual punctuation.
 *
 * Examples:
 *   "hello world"   -> ["hello", " ", "world"]
 *   "foo.bar(baz)"  -> ["foo", ".", "bar", "(", "baz", ")"]
 *   "  const x = 1" -> ["  ", "const", " ", "x", " ", "=", " ", "1"]
 */
export function tokenize(line: string): readonly string[] {
  if (line.length === 0) return []

  const tokens: string[] = []
  // Match: word chars, whitespace runs, or individual punctuation
  const regex = /[a-zA-Z0-9_]+|\s+|[^\s\w]/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(line)) !== null) {
    tokens.push(match[0])
  }

  return tokens
}

/**
 * Compute the longest common subsequence table for two token arrays.
 * Returns a 2D array where dp[i][j] = LCS length for oldTokens[0..i-1] and newTokens[0..j-1].
 */
function computeLcsTable(
  oldTokens: readonly string[],
  newTokens: readonly string[],
): readonly (readonly number[])[] {
  const m = oldTokens.length
  const n = newTokens.length
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  )

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldTokens[i - 1] === newTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  return dp
}

/**
 * Backtrack through the LCS table to find which tokens are common.
 * Returns a set of indices in each array that are part of the LCS.
 */
function backtrackLcs(
  oldTokens: readonly string[],
  newTokens: readonly string[],
  dp: readonly (readonly number[])[],
): { readonly oldLcs: ReadonlySet<number>; readonly newLcs: ReadonlySet<number> } {
  const oldLcs = new Set<number>()
  const newLcs = new Set<number>()
  let i = oldTokens.length
  let j = newTokens.length

  while (i > 0 && j > 0) {
    if (oldTokens[i - 1] === newTokens[j - 1]) {
      oldLcs.add(i - 1)
      newLcs.add(j - 1)
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return { oldLcs, newLcs }
}

/**
 * Merge adjacent segments of the same type into single segments.
 * This produces cleaner output with fewer, larger segments.
 */
function mergeSegments(
  segments: readonly WordDiffSegment[],
): readonly WordDiffSegment[] {
  if (segments.length === 0) return []

  const merged: WordDiffSegment[] = []
  let current = segments[0]

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i]
    if (next.type === current.type) {
      current = { text: current.text + next.text, type: current.type }
    } else {
      merged.push(current)
      current = next
    }
  }

  merged.push(current)
  return merged
}

/**
 * Build segments from tokens, marking LCS members as equal and others as changed.
 */
function buildSegments(
  tokens: readonly string[],
  lcsIndices: ReadonlySet<number>,
): readonly WordDiffSegment[] {
  if (tokens.length === 0) return []

  const raw: WordDiffSegment[] = tokens.map((token, i) => ({
    text: token,
    type: lcsIndices.has(i) ? ('equal' as const) : ('changed' as const),
  }))

  return mergeSegments(raw)
}

/**
 * Compute word-level diff between two lines.
 *
 * Tokenizes both lines, computes LCS of tokens, and returns
 * segments for each line with equal/changed markers.
 *
 * For empty inputs, returns the entire non-empty side as a single "changed" segment.
 */
export function computeWordDiff(
  oldLine: string,
  newLine: string,
): WordDiffResult {
  // Both empty
  if (oldLine.length === 0 && newLine.length === 0) {
    return { oldSegments: [], newSegments: [] }
  }

  // One side empty
  if (oldLine.length === 0) {
    return {
      oldSegments: [],
      newSegments: [{ text: newLine, type: 'changed' }],
    }
  }
  if (newLine.length === 0) {
    return {
      oldSegments: [{ text: oldLine, type: 'changed' }],
      newSegments: [],
    }
  }

  // Fast path: identical lines
  if (oldLine === newLine) {
    return {
      oldSegments: [{ text: oldLine, type: 'equal' }],
      newSegments: [{ text: newLine, type: 'equal' }],
    }
  }

  const oldTokens = tokenize(oldLine)
  const newTokens = tokenize(newLine)

  const dp = computeLcsTable(oldTokens, newTokens)
  const { oldLcs, newLcs } = backtrackLcs(oldTokens, newTokens, dp)

  const oldSegments = buildSegments(oldTokens, oldLcs)
  const newSegments = buildSegments(newTokens, newLcs)

  return { oldSegments, newSegments }
}

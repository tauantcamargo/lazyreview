/**
 * Pure functions for detecting PR dependency relationships.
 *
 * Supports two detection methods:
 * 1. Body references: "Depends on #N", "Blocked by #N", "Stacks on #N"
 * 2. Branch matching: if another PR's head branch === this PR's base branch (stacked)
 */
import type { PullRequest } from '../models/pull-request'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DependencyNode {
  readonly prNumber: number
  readonly title: string
  readonly state: 'open' | 'closed' | 'merged'
  readonly relationship: 'depends-on' | 'blocks' | 'stacked-on'
}

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/**
 * Matches common dependency reference patterns in PR bodies.
 * Case-insensitive, allows extra whitespace between words.
 *
 * Supported patterns:
 * - "Depends on #N"
 * - "Blocked by #N"
 * - "Stacks on #N"
 */
const DEPENDENCY_PATTERNS: readonly RegExp[] = [
  /depends\s+on\s+#(\d+)/gi,
  /blocked\s+by\s+#(\d+)/gi,
  /stacks\s+on\s+#(\d+)/gi,
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse PR body text for dependency references.
 * Returns deduplicated PR numbers referenced in the body.
 */
export function parseDependencyReferences(
  body: string | null | undefined,
): readonly number[] {
  if (!body) {
    return []
  }

  const seen = new Set<number>()

  for (const pattern of DEPENDENCY_PATTERNS) {
    // Reset lastIndex for each pattern (global flag)
    pattern.lastIndex = 0
    let match: RegExpExecArray | null = pattern.exec(body)
    while (match !== null) {
      const num = parseInt(match[1], 10)
      if (!isNaN(num)) {
        seen.add(num)
      }
      match = pattern.exec(body)
    }
  }

  return [...seen]
}

/**
 * Derive the effective state for display purposes.
 * A PR that is closed AND merged should display as "merged".
 */
function getEffectiveState(pr: PullRequest): 'open' | 'closed' | 'merged' {
  if (pr.merged) {
    return 'merged'
  }
  return pr.state as 'open' | 'closed'
}

/**
 * Build the full dependency chain for a PR by combining:
 * 1. Branch-based detection (stacked PRs)
 * 2. Body-based references (depends-on)
 *
 * Deduplicates by PR number. Branch-based relationships take priority
 * over body-based ones when both refer to the same PR.
 */
export function buildDependencyChain(
  pr: PullRequest,
  allPRs: readonly PullRequest[],
): readonly DependencyNode[] {
  const nodes = new Map<number, DependencyNode>()

  const baseRef = pr.base.ref
  const headRef = pr.head.ref

  // Skip branch matching if refs are empty
  if (baseRef) {
    // 1. Stacked-on: another PR's head branch matches this PR's base branch
    for (const other of allPRs) {
      if (other.number === pr.number) continue
      if (other.head.ref && other.head.ref === baseRef) {
        nodes.set(other.number, {
          prNumber: other.number,
          title: other.title,
          state: getEffectiveState(other),
          relationship: 'stacked-on',
        })
      }
    }
  }

  if (headRef) {
    // 2. Blocks: another PR's base branch matches this PR's head branch
    for (const other of allPRs) {
      if (other.number === pr.number) continue
      if (other.base.ref && other.base.ref === headRef) {
        nodes.set(other.number, {
          prNumber: other.number,
          title: other.title,
          state: getEffectiveState(other),
          relationship: 'blocks',
        })
      }
    }
  }

  // 3. Body references (depends-on) -- only add if not already present from branch detection
  const bodyRefs = parseDependencyReferences(pr.body)
  for (const refNumber of bodyRefs) {
    if (refNumber === pr.number) continue
    if (nodes.has(refNumber)) continue

    const referencedPR = allPRs.find((p) => p.number === refNumber)
    if (!referencedPR) continue

    nodes.set(refNumber, {
      prNumber: referencedPR.number,
      title: referencedPR.title,
      state: getEffectiveState(referencedPR),
      relationship: 'depends-on',
    })
  }

  return [...nodes.values()]
}

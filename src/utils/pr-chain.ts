/**
 * Pure functions for detecting and visualizing stacked/dependent PR chains.
 *
 * Builds on the existing pr-dependencies.ts utilities to construct an ordered
 * chain of PRs suitable for visual rendering: parent -> child -> grandchild.
 *
 * Detection methods:
 * 1. Branch stacking: PR A's head branch === PR B's base branch
 * 2. Description references: "Depends on #N", "Stacks on #N", "Blocked by #N"
 */
import type { PullRequest } from '../models/pull-request'
import { parseDependencyReferences } from './pr-dependencies'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PRChainNodeStatus =
  | 'merged'
  | 'approved'
  | 'open'
  | 'draft'
  | 'conflicts'

export interface PRChainNode {
  readonly pr: PullRequest
  readonly status: PRChainNodeStatus
  readonly isCurrentlyViewing: boolean
}

export type ChainStatus = 'ready' | 'waiting' | 'blocked'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Derive the chain-node status from a PR's data.
 */
function deriveNodeStatus(pr: PullRequest): PRChainNodeStatus {
  if (pr.merged) {
    return 'merged'
  }
  if (
    pr.mergeable === false ||
    pr.mergeable_state === 'dirty'
  ) {
    return 'conflicts'
  }
  if (pr.draft) {
    return 'draft'
  }
  return 'open'
}

/**
 * Build a map from head branch ref to PR for fast lookup.
 * Only includes PRs with a non-empty head ref.
 */
function buildHeadRefMap(
  allPRs: readonly PullRequest[],
): ReadonlyMap<string, PullRequest> {
  const map = new Map<string, PullRequest>()
  for (const pr of allPRs) {
    if (pr.head.ref) {
      map.set(pr.head.ref, pr)
    }
  }
  return map
}

/**
 * Build a map from base branch ref to all PRs with that base.
 */
function buildBaseRefMap(
  allPRs: readonly PullRequest[],
): ReadonlyMap<string, readonly PullRequest[]> {
  const map = new Map<string, PullRequest[]>()
  for (const pr of allPRs) {
    if (pr.base.ref) {
      const existing = map.get(pr.base.ref) ?? []
      map.set(pr.base.ref, [...existing, pr])
    }
  }
  return map
}

/**
 * Walk upward from a PR through the branch chain to find the root parent.
 * Returns the ordered list of PRs from root to the given PR (inclusive).
 */
function walkUpChain(
  pr: PullRequest,
  headRefMap: ReadonlyMap<string, PullRequest>,
  visited: ReadonlySet<number>,
): readonly PullRequest[] {
  const ancestors: PullRequest[] = []
  let current = pr
  const seen = new Set<number>(visited)
  seen.add(current.number)

  // Walk upward: find the PR whose head branch === current's base branch
  while (current.base.ref) {
    const parent = headRefMap.get(current.base.ref)
    if (!parent || parent.number === current.number || seen.has(parent.number)) {
      break
    }
    seen.add(parent.number)
    ancestors.push(parent)
    current = parent
  }

  // ancestors is in reverse order (closest parent first), so reverse it
  return [...ancestors.reverse(), pr]
}

/**
 * Walk downward from a PR through the branch chain to find all children.
 * Returns the ordered list of PRs from the given PR's first child onward.
 */
function walkDownChain(
  pr: PullRequest,
  baseRefMap: ReadonlyMap<string, readonly PullRequest[]>,
  visited: ReadonlySet<number>,
): readonly PullRequest[] {
  const descendants: PullRequest[] = []
  let current = pr
  const seen = new Set<number>(visited)
  seen.add(current.number)

  while (current.head.ref) {
    const children = baseRefMap.get(current.head.ref) ?? []
    // Pick the first child that we haven't visited (avoid cycles)
    const child = children.find(
      (c) => c.number !== current.number && !seen.has(c.number),
    )
    if (!child) break
    seen.add(child.number)
    descendants.push(child)
    current = child
  }

  return descendants
}

/**
 * Try to extend the chain using description references.
 * Finds PRs referenced in the current PR's body that are not already in the chain.
 */
function findDescriptionParents(
  pr: PullRequest,
  allPRs: readonly PullRequest[],
  chainNumbers: ReadonlySet<number>,
): readonly PullRequest[] {
  const bodyRefs = parseDependencyReferences(pr.body)
  const parents: PullRequest[] = []

  for (const refNumber of bodyRefs) {
    if (refNumber === pr.number || chainNumbers.has(refNumber)) continue
    const referenced = allPRs.find((p) => p.number === refNumber)
    if (referenced) {
      parents.push(referenced)
    }
  }

  return parents
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the full PR chain for a given PR.
 *
 * Walks both upward (parents) and downward (children) through branch
 * stacking, then extends with description-based references.
 *
 * Returns an ordered array of PRChainNode from root to leaf,
 * with the current PR marked via `isCurrentlyViewing`.
 */
export function detectPRChain(
  pr: PullRequest,
  allPRs: readonly PullRequest[],
): readonly PRChainNode[] {
  const headRefMap = buildHeadRefMap(allPRs)
  const baseRefMap = buildBaseRefMap(allPRs)

  // Walk upward from current PR to find all ancestors
  const upwardChain = walkUpChain(pr, headRefMap, new Set())
  const visited = new Set(upwardChain.map((p) => p.number))

  // Walk downward from current PR to find all descendants
  const downwardChain = walkDownChain(pr, baseRefMap, visited)
  for (const d of downwardChain) {
    visited.add(d.number)
  }

  // Build the branch-based chain: ancestors (includes pr) + descendants
  const branchChain = [...upwardChain, ...downwardChain]

  // Extend with description-based references (prepend them as parents)
  const descriptionParents = findDescriptionParents(pr, allPRs, visited)

  // Full chain: description parents first, then branch chain
  const fullChainPRs = [...descriptionParents, ...branchChain]

  // Deduplicate by number (shouldn't happen, but safety net)
  const seen = new Set<number>()
  const deduped: PullRequest[] = []
  for (const p of fullChainPRs) {
    if (!seen.has(p.number)) {
      seen.add(p.number)
      deduped.push(p)
    }
  }

  return deduped.map((p) => ({
    pr: p,
    status: deriveNodeStatus(p),
    isCurrentlyViewing: p.number === pr.number,
  }))
}

/**
 * Compute the overall chain status based on all nodes.
 *
 * - "ready"   (green)  : all parent nodes are merged, or single-node chain
 * - "waiting" (yellow) : at least one parent is still open/draft/approved
 * - "blocked" (red)    : at least one node has conflicts
 */
export function computeChainStatus(
  chain: readonly PRChainNode[],
): ChainStatus {
  // Check for conflicts anywhere in the chain
  if (chain.some((node) => node.status === 'conflicts')) {
    return 'blocked'
  }

  // Single-node chain is always ready
  if (chain.length <= 1) {
    return 'ready'
  }

  // Find the index of the currently viewed PR
  const currentIndex = chain.findIndex((node) => node.isCurrentlyViewing)
  if (currentIndex <= 0) {
    // No parents or at the root -- ready
    return 'ready'
  }

  // Check all parent nodes (before current)
  const parents = chain.slice(0, currentIndex)
  const allParentsMerged = parents.every((node) => node.status === 'merged')
  if (allParentsMerged) {
    return 'ready'
  }

  return 'waiting'
}

/**
 * Find the index of the current PR in the chain.
 * Returns -1 if not found.
 */
export function findCurrentInChain(
  chain: readonly PRChainNode[],
  currentPR: PullRequest,
): number {
  return chain.findIndex((node) => node.pr.number === currentPR.number)
}

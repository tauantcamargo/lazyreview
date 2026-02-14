/**
 * Pure functions for detecting merge conflict state from PR mergeable fields.
 */

export interface ConflictState {
  readonly hasConflicts: boolean
  readonly mergeableState: string | null
  readonly conflictMessage: string
}

interface MergeableFields {
  readonly mergeable: boolean | null
  readonly mergeable_state: string | null
}

/**
 * Detects the conflict state of a pull request based on its mergeable
 * and mergeable_state fields.
 *
 * Priority:
 * 1. If mergeable is null, the merge status is still being computed.
 * 2. If mergeable is false, the PR has merge conflicts regardless of state.
 * 3. If mergeable is true, check mergeable_state for additional info.
 */
export function detectConflictState(pr: MergeableFields): ConflictState {
  const { mergeable, mergeable_state } = pr

  // Mergeability is still being computed by the platform
  if (mergeable === null) {
    return {
      hasConflicts: false,
      mergeableState: mergeable_state,
      conflictMessage: 'Mergeability is still being computing by the server',
    }
  }

  // PR has merge conflicts
  if (mergeable === false) {
    return {
      hasConflicts: true,
      mergeableState: mergeable_state,
      conflictMessage:
        'This PR has merge conflicts that must be resolved locally',
    }
  }

  // Mergeable is true -- check state for additional info
  return detectStateMessage(mergeable_state)
}

function detectStateMessage(state: string | null): ConflictState {
  switch (state) {
    case 'clean':
      return {
        hasConflicts: false,
        mergeableState: 'clean',
        conflictMessage: '',
      }
    case 'unstable':
      return {
        hasConflicts: false,
        mergeableState: 'unstable',
        conflictMessage: 'CI checks are failing or pending',
      }
    case 'blocked':
      return {
        hasConflicts: false,
        mergeableState: 'blocked',
        conflictMessage:
          'Merging is blocked by branch protection rules or required reviews',
      }
    case 'behind':
      return {
        hasConflicts: false,
        mergeableState: 'behind',
        conflictMessage:
          'Branch is behind the base branch and needs to be updated',
      }
    default:
      return {
        hasConflicts: false,
        mergeableState: state,
        conflictMessage: '',
      }
  }
}

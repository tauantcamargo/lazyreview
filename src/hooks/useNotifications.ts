import { useEffect, useRef } from 'react'
import { sendNotification } from '../utils/notifications'
import type { PullRequest } from '../models/pull-request'

export interface NotificationConfig {
  readonly enabled: boolean
  readonly notifyOnNewPR: boolean
  readonly notifyOnUpdate: boolean
  readonly notifyOnReviewRequest: boolean
}

interface PRSnapshot {
  readonly updated_at: string
  readonly requested_reviewers: readonly string[]
}

/**
 * Detect new PRs that appeared since last snapshot.
 * Does not notify on initial load (when previousMap is empty).
 */
export function detectNewPRs(
  currentPRs: readonly PullRequest[],
  previousMap: ReadonlyMap<number, PRSnapshot>,
): readonly PullRequest[] {
  if (previousMap.size === 0) return []

  return currentPRs.filter((pr) => !previousMap.has(pr.number))
}

/**
 * Detect PRs that have been updated since last snapshot.
 */
export function detectUpdatedPRs(
  currentPRs: readonly PullRequest[],
  previousMap: ReadonlyMap<number, PRSnapshot>,
): readonly PullRequest[] {
  if (previousMap.size === 0) return []

  return currentPRs.filter((pr) => {
    const prev = previousMap.get(pr.number)
    if (!prev) return false
    return prev.updated_at !== pr.updated_at
  })
}

/**
 * Detect PRs where the current user was newly added as a reviewer.
 */
export function detectNewReviewRequests(
  currentPRs: readonly PullRequest[],
  previousMap: ReadonlyMap<number, PRSnapshot>,
  currentUserLogin: string | undefined,
): readonly PullRequest[] {
  if (previousMap.size === 0 || !currentUserLogin) return []

  return currentPRs.filter((pr) => {
    const prev = previousMap.get(pr.number)
    if (!prev) return false

    const wasRequested = prev.requested_reviewers.includes(currentUserLogin)
    const isRequested = pr.requested_reviewers.some(
      (r) => r.login === currentUserLogin,
    )

    return !wasRequested && isRequested
  })
}

/**
 * Build a snapshot map from a list of PRs.
 */
export function buildSnapshotMap(
  prs: readonly PullRequest[],
): ReadonlyMap<number, PRSnapshot> {
  return new Map(
    prs.map((pr) => [
      pr.number,
      {
        updated_at: pr.updated_at,
        requested_reviewers: pr.requested_reviewers.map((r) => r.login),
      },
    ]),
  )
}

/**
 * Hook that monitors PR activity and fires desktop notifications.
 * Non-blocking, fire-and-forget notifications.
 * Does not notify on initial data load.
 */
export function useNotifications(
  prs: readonly PullRequest[] | undefined,
  config: NotificationConfig,
  currentUserLogin?: string,
): void {
  const previousPRsRef = useRef<ReadonlyMap<number, PRSnapshot>>(new Map())

  useEffect(() => {
    if (!config.enabled || !prs) return

    const prevMap = previousPRsRef.current

    if (config.notifyOnNewPR) {
      const newPRs = detectNewPRs(prs, prevMap)
      for (const pr of newPRs) {
        sendNotification({
          title: 'New PR',
          body: `#${pr.number}: ${pr.title}`,
          subtitle: pr.user.login,
        })
      }
    }

    if (config.notifyOnUpdate) {
      const updatedPRs = detectUpdatedPRs(prs, prevMap)
      for (const pr of updatedPRs) {
        sendNotification({
          title: 'PR Updated',
          body: `#${pr.number}: ${pr.title}`,
          subtitle: pr.user.login,
        })
      }
    }

    if (config.notifyOnReviewRequest) {
      const reviewRequests = detectNewReviewRequests(prs, prevMap, currentUserLogin)
      for (const pr of reviewRequests) {
        sendNotification({
          title: 'Review Requested',
          body: `#${pr.number}: ${pr.title}`,
          subtitle: pr.user.login,
        })
      }
    }

    previousPRsRef.current = buildSnapshotMap(prs)
  }, [prs, config.enabled, config.notifyOnNewPR, config.notifyOnUpdate, config.notifyOnReviewRequest, currentUserLogin])
}

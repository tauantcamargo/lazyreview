import { useMemo } from 'react'
import type { TeamMember } from '../models/team'
import { isAuthoredBy, isReviewRequestedFrom } from '../models/team'
import type { PullRequest } from '../models/pull-request'

export interface MemberStat {
  readonly member: TeamMember
  readonly authoredCount: number
  readonly reviewCount: number
}

export interface TeamDashboardResult {
  readonly memberStats: readonly MemberStat[]
  readonly totalOpen: number
  readonly totalPending: number
}

/**
 * Pure computation function for team dashboard stats.
 * Computes per-member authored and review-requested counts
 * from the provided PR list.
 */
export function computeTeamDashboard(
  members: readonly TeamMember[],
  prs: readonly PullRequest[],
): TeamDashboardResult {
  const memberStats: readonly MemberStat[] = members.map((member) => {
    let authoredCount = 0
    let reviewCount = 0

    for (const pr of prs) {
      if (isAuthoredBy(pr, member)) {
        authoredCount += 1
      }
      if (isReviewRequestedFrom(pr, member)) {
        reviewCount += 1
      }
    }

    return { member, authoredCount, reviewCount }
  })

  const totalOpen = prs.length
  const totalPending = memberStats.reduce((sum, s) => sum + s.reviewCount, 0)

  return { memberStats, totalOpen, totalPending }
}

/**
 * React hook that computes team dashboard stats from members and PRs.
 * Memoizes the computation so it only recalculates when inputs change.
 */
export function useTeamDashboard(
  members: readonly TeamMember[],
  prs: readonly PullRequest[],
): TeamDashboardResult {
  return useMemo(() => computeTeamDashboard(members, prs), [members, prs])
}

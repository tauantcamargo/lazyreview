import { z } from 'zod'
import type { PullRequest } from './pull-request'

/**
 * Schema for a team member configuration entry.
 */
export const TeamMemberSchema = z.object({
  username: z.string().min(1),
  provider: z
    .enum(['github', 'gitlab', 'bitbucket', 'azure', 'gitea'])
    .optional(),
})

export type TeamMember = z.infer<typeof TeamMemberSchema>

/**
 * Schema for the team configuration block.
 */
export const TeamConfigSchema = z.object({
  members: z.array(TeamMemberSchema),
})

export type TeamConfig = z.infer<typeof TeamConfigSchema>

/**
 * Build a unique key for a team member.
 * If provider is set, returns "provider:username", otherwise just "username".
 */
export function buildTeamMemberKey(member: TeamMember): string {
  return member.provider ? `${member.provider}:${member.username}` : member.username
}

/**
 * Check if a pull request was authored by the given team member.
 * Comparison is case-insensitive on the username.
 */
export function isAuthoredBy(pr: PullRequest, member: TeamMember): boolean {
  return pr.user.login.toLowerCase() === member.username.toLowerCase()
}

/**
 * Check if a review has been requested from the given team member.
 * Comparison is case-insensitive on the username.
 */
export function isReviewRequestedFrom(
  pr: PullRequest,
  member: TeamMember,
): boolean {
  const reviewers = pr.requested_reviewers ?? []
  return reviewers.some(
    (reviewer) =>
      reviewer.login.toLowerCase() === member.username.toLowerCase(),
  )
}

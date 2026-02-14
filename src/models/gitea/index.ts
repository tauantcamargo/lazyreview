// ---------------------------------------------------------------------------
// Gitea Zod schemas
// ---------------------------------------------------------------------------

export {
  GiteaUserSchema,
  GiteaLabelSchema,
  GiteaBranchRefSchema,
  GiteaPullRequestSchema,
} from './pull-request'
export type {
  GiteaUser,
  GiteaLabel,
  GiteaBranchRef,
  GiteaPullRequest,
} from './pull-request'

export {
  GiteaIssueCommentSchema,
  GiteaReviewCommentSchema,
} from './comment'
export type {
  GiteaIssueComment,
  GiteaReviewComment,
} from './comment'

export { GiteaReviewSchema } from './review'
export type { GiteaReview } from './review'

export { GiteaChangedFileSchema } from './diff'
export type { GiteaChangedFile } from './diff'

export { GiteaCommitInfoSchema, GiteaCommitSchema } from './commit'
export type { GiteaCommitInfo, GiteaCommit } from './commit'

// ---------------------------------------------------------------------------
// Mappers (Gitea -> normalized types)
// ---------------------------------------------------------------------------

export {
  mapGiteaUser,
  mapGiteaPRToPullRequest,
  mapGiteaReviewCommentToComment,
  mapGiteaReviewCommentsToComments,
  mapGiteaIssueCommentToIssueComment,
  mapGiteaIssueCommentsToIssueComments,
  mapGiteaReviewToReview,
  mapGiteaReviewsToReviews,
  mapGiteaChangedFileToFileChange,
  mapGiteaChangedFilesToFileChanges,
  mapGiteaCommitToCommit,
  mapGiteaCommitsToCommits,
} from './mappers'

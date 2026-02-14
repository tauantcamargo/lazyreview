// ---------------------------------------------------------------------------
// Azure DevOps Zod schemas
// ---------------------------------------------------------------------------

export {
  AzureIdentitySchema,
  AzureReviewerSchema,
  AzureGitRefSchema,
  AzureRepositorySchema,
  AzureCompletionOptionsSchema,
  AzurePullRequestSchema,
} from './pull-request'
export type {
  AzureIdentity,
  AzureReviewer,
  AzureRepository,
  AzurePullRequest,
} from './pull-request'

export {
  AzureCommentSchema,
  AzureThreadContextSchema,
  AzureThreadSchema,
} from './comment'
export type {
  AzureComment,
  AzureThreadContext,
  AzureThread,
} from './comment'

export {
  AzureIterationSchema,
  AzureIterationChangeSchema,
  AzureChangesResponseSchema,
} from './diff'
export type {
  AzureIteration,
  AzureIterationChange,
  AzureChangesResponse,
} from './diff'

export { AzureBuildSchema } from './build'
export type { AzureBuild } from './build'

export { AzureCommitSchema, AzureCommitChangeSchema } from './commit'
export type { AzureCommit, AzureCommitChange } from './commit'

// ---------------------------------------------------------------------------
// Mappers (Azure -> normalized types)
// ---------------------------------------------------------------------------

export {
  mapAzureIdentity,
  mapAzureReviewerToReview,
  mapAzureReviewersToReviews,
  mapAzurePRToPullRequest,
  mapAzureCommentToComment,
  mapAzureThreadsToComments,
  mapAzureThreadsToIssueComments,
  mapAzureChangeToFileChange,
  mapAzureCommitToCommit,
  mapAzureBuildToCheckRun,
  mapAzureBuildsToCheckRunsResponse,
} from './mappers'

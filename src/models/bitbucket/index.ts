// ---------------------------------------------------------------------------
// Bitbucket Zod schemas
// ---------------------------------------------------------------------------

export {
  BitbucketUserSchema,
  BitbucketParticipantSchema,
  BitbucketPullRequestSchema,
} from './pull-request'
export type {
  BitbucketUser,
  BitbucketParticipant,
  BitbucketPullRequest,
} from './pull-request'

export {
  BitbucketCommentContentSchema,
  BitbucketInlineSchema,
  BitbucketCommentSchema,
} from './comment'
export type {
  BitbucketCommentContent,
  BitbucketInline,
  BitbucketComment,
} from './comment'

export { BitbucketDiffStatSchema } from './diff'
export type { BitbucketDiffStat } from './diff'

export {
  BitbucketPipelineStepResultSchema,
  BitbucketPipelineStepStateSchema,
  BitbucketPipelineStepSchema,
} from './pipeline'
export type {
  BitbucketPipelineStepResult,
  BitbucketPipelineStepState,
  BitbucketPipelineStep,
} from './pipeline'

export { BitbucketCommitSchema } from './commit'
export type { BitbucketCommit } from './commit'

// ---------------------------------------------------------------------------
// Mappers (Bitbucket -> normalized types)
// ---------------------------------------------------------------------------

export {
  mapBitbucketUser,
  mapBitbucketPRToPullRequest,
  mapBitbucketCommentToComment,
  mapBitbucketCommentsToComments,
  mapBitbucketCommentToIssueComment,
  mapBitbucketCommentsToIssueComments,
  mapBitbucketDiffStatToFileChange,
  mapBitbucketCommitToCommit,
  mapBitbucketPipelineStepToCheckRun,
  mapBitbucketPipelineStepsToCheckRunsResponse,
  mapParticipantToReview,
  mapParticipantsToReviews,
} from './mappers'

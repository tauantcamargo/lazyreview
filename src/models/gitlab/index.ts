// ---------------------------------------------------------------------------
// GitLab Zod schemas
// ---------------------------------------------------------------------------

export {
  GitLabUserSchema,
  GitLabDiffRefsSchema,
  GitLabHeadPipelineSchema,
  GitLabMergeRequestSchema,
} from './merge-request'
export type {
  GitLabUser,
  GitLabDiffRefs,
  GitLabHeadPipeline,
  GitLabMergeRequest,
} from './merge-request'

export {
  GitLabNotePositionSchema,
  GitLabNoteSchema,
  GitLabDiscussionSchema,
} from './note'
export type {
  GitLabNotePosition,
  GitLabNote,
  GitLabDiscussion,
} from './note'

export { GitLabDiffSchema } from './diff'
export type { GitLabDiff } from './diff'

export { GitLabPipelineJobSchema } from './pipeline'
export type { GitLabPipelineJob } from './pipeline'

export { GitLabCommitSchema } from './commit'
export type { GitLabCommit } from './commit'

// ---------------------------------------------------------------------------
// Mappers (GitLab -> normalized types)
// ---------------------------------------------------------------------------

export {
  mapGitLabUser,
  mapMergeRequestToPR,
  mapNoteToComment,
  mapNotesToComments,
  mapNoteToIssueComment,
  mapNotesToIssueComments,
  mapDiffToFileChange,
  mapCommit,
  mapPipelineJobToCheckRun,
  mapPipelineJobsToCheckRunsResponse,
  mapApprovalToReview,
} from './mappers'

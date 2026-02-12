import { Context } from 'effect'
import type { CodeReviewApiService } from './CodeReviewApiTypes'

// Re-export all types from CodeReviewApiTypes for backwards compatibility
export type {
  ListPRsOptions,
  ApiError,
  ReviewThread,
  CodeReviewApiService,
} from './CodeReviewApiTypes'

// GitHubApiService is now an alias for CodeReviewApiService
export type GitHubApiService = CodeReviewApiService

// GitHubApi tag kept for backwards compatibility with existing code
// New code should use CodeReviewApi from CodeReviewApiTypes
export class GitHubApi extends Context.Tag('GitHubApi')<
  GitHubApi,
  GitHubApiService
>() {}

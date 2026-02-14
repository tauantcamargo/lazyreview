import { Data } from 'effect'

export class GitHubError extends Data.TaggedError('GitHubError')<{
  readonly message: string
  readonly detail?: string
  readonly status?: number
  readonly url?: string
  readonly retryAfterMs?: number
}> {}

export class AuthError extends Data.TaggedError('AuthError')<{
  readonly message: string
  readonly reason: 'no_token' | 'invalid_token' | 'expired_token' | 'save_failed'
}> {}

export class GitLabError extends Data.TaggedError('GitLabError')<{
  readonly message: string
  readonly detail?: string
  readonly status?: number
  readonly url?: string
  readonly retryAfterMs?: number
}> {}

export class BitbucketError extends Data.TaggedError('BitbucketError')<{
  readonly message: string
  readonly detail?: string
  readonly status?: number
  readonly url?: string
  readonly retryAfterMs?: number
}> {}

export class AzureError extends Data.TaggedError('AzureError')<{
  readonly message: string
  readonly detail?: string
  readonly status?: number
  readonly url?: string
  readonly retryAfterMs?: number
}> {}

export class GiteaError extends Data.TaggedError('GiteaError')<{
  readonly message: string
  readonly detail?: string
  readonly status?: number
  readonly url?: string
  readonly retryAfterMs?: number
}> {}

export class ConfigError extends Data.TaggedError('ConfigError')<{
  readonly message: string
  readonly path?: string
}> {}

export class NetworkError extends Data.TaggedError('NetworkError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export type AppError = GitHubError | GitLabError | BitbucketError | AzureError | GiteaError | AuthError | ConfigError | NetworkError

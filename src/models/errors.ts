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

export class ConfigError extends Data.TaggedError('ConfigError')<{
  readonly message: string
  readonly path?: string
}> {}

export class NetworkError extends Data.TaggedError('NetworkError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export type AppError = GitHubError | AuthError | ConfigError | NetworkError

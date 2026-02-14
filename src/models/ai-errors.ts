import { Data } from 'effect'

export class AiError extends Data.TaggedError('AiError')<{
  readonly message: string
  readonly detail?: string
  readonly provider?: string
  readonly status?: number
}> {}

export class AiConfigError extends Data.TaggedError('AiConfigError')<{
  readonly message: string
  readonly provider?: string
  readonly field?: string
}> {}

export class AiRateLimitError extends Data.TaggedError('AiRateLimitError')<{
  readonly message: string
  readonly provider: string
  readonly retryAfterMs?: number
}> {}

export class AiNetworkError extends Data.TaggedError('AiNetworkError')<{
  readonly message: string
  readonly provider: string
  readonly cause?: unknown
}> {}

export class AiResponseError extends Data.TaggedError('AiResponseError')<{
  readonly message: string
  readonly provider: string
  readonly status?: number
  readonly body?: string
}> {}

export type AiServiceError =
  | AiError
  | AiConfigError
  | AiRateLimitError
  | AiNetworkError
  | AiResponseError

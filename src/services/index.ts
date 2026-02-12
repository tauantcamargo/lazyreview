import { Effect, Layer } from 'effect'
import { ConfigLive } from './Config'
import { AuthLive } from './Auth'
import { GitHubApiLive } from './GitHubApi'
import { GitHubApi } from './GitHubApiTypes'
import { CodeReviewApi } from './CodeReviewApiTypes'

export { Config, type AppConfig, type ConfigService } from './Config'
export { Auth, type AuthService } from './Auth'
export {
  GitHubApi,
  type GitHubApiService,
  type ListPRsOptions,
} from './GitHubApi'
export {
  CodeReviewApi,
  type CodeReviewApiService,
} from './CodeReviewApiTypes'

// GitHubApiLive provides CodeReviewApi (the provider-agnostic interface)
const CodeReviewApiFullLive = GitHubApiLive.pipe(Layer.provide(AuthLive))

// Backwards-compatible GitHubApi layer that delegates to CodeReviewApi
const GitHubApiCompatLive = Layer.effect(
  GitHubApi,
  Effect.gen(function* () {
    const api = yield* CodeReviewApi
    return GitHubApi.of(api)
  }),
)

const GitHubApiFullCompatLive = GitHubApiCompatLive.pipe(
  Layer.provide(CodeReviewApiFullLive),
)

export const AppLayer = Layer.mergeAll(
  ConfigLive,
  AuthLive,
  CodeReviewApiFullLive,
  GitHubApiFullCompatLive,
)

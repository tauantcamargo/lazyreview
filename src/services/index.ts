import { Layer } from 'effect'
import { ConfigLive } from './Config'
import { AuthLive } from './Auth'
import { GitHubApiLive } from './GitHubApi'
import { LoadingLive } from './Loading'

export { Config, type AppConfig, type ConfigService } from './Config'
export { Auth, type AuthService } from './Auth'
export {
  GitHubApi,
  type GitHubApiService,
  type ListPRsOptions,
} from './GitHubApi'
export {
  Loading,
  type LoadingService,
  type LoadingState,
} from './Loading'

const GitHubApiFullLive = GitHubApiLive.pipe(Layer.provide(AuthLive))

export const AppLayer = Layer.mergeAll(
  ConfigLive,
  AuthLive,
  LoadingLive,
  GitHubApiFullLive,
)

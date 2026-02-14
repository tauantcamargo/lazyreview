/**
 * Config schema v2 migration utilities.
 *
 * Provides:
 * - V2 config type definitions (AiConfig, PluginConfig, V2ConfigFile)
 * - v1/v2 detection helpers
 * - Pure migration function: migrateV1Config()
 * - Environment variable resolution: resolveEnvVars()
 * - Repo config merge: mergeRepoConfig()
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiConfig {
  readonly provider: string
  readonly model: string
  readonly apiKey: string
  readonly endpoint: string
  readonly maxTokens: number
  readonly temperature: number
}

export type PluginConfig = Readonly<Record<string, unknown>>

export interface ProviderHostsConfig {
  readonly hosts: readonly string[]
}

export interface V2ProvidersConfig {
  readonly github: ProviderHostsConfig
  readonly gitlab: ProviderHostsConfig
  readonly bitbucket: ProviderHostsConfig
  readonly azure: ProviderHostsConfig
  readonly gitea: ProviderHostsConfig
}

export interface V2Defaults {
  readonly provider: string
  readonly theme: string
  readonly pageSize: number
  readonly refreshInterval: number
  readonly owner: string
  readonly repo: string
  readonly compactList: boolean
  readonly hasOnboarded?: boolean
  readonly notifications?: boolean
  readonly notifyOnNewPR?: boolean
  readonly notifyOnUpdate?: boolean
  readonly notifyOnReviewRequest?: boolean
  readonly baseUrl?: string
  readonly gitlab?: { readonly host: string }
  readonly keybindings?: {
    readonly toggleSidebar: string
    readonly help: string
    readonly quit: string
  }
  readonly hostMappings?: readonly { readonly host: string; readonly provider: string }[]
  readonly botUsernames?: readonly string[]
}

export interface V2ConfigFile {
  readonly version: 2
  readonly defaults: V2Defaults
  readonly providers: V2ProvidersConfig
  readonly ai: AiConfig
  readonly plugins: PluginConfig
  readonly keybindingOverrides: Readonly<Record<string, unknown>>
  readonly recentRepos: readonly { readonly owner: string; readonly repo: string; readonly lastUsed: string }[]
  readonly bookmarkedRepos: readonly { readonly owner: string; readonly repo: string }[]
}

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

export function isV1Config(input: unknown): boolean {
  if (input === null || input === undefined || typeof input !== 'object') {
    return false
  }
  const record = input as Record<string, unknown>
  return record['version'] === undefined
}

export function isV2Config(input: unknown): boolean {
  if (input === null || input === undefined || typeof input !== 'object') {
    return false
  }
  const record = input as Record<string, unknown>
  return record['version'] === 2
}

// ---------------------------------------------------------------------------
// V1 -> V2 migration (pure function)
// ---------------------------------------------------------------------------

const DEFAULT_AI_CONFIG: AiConfig = {
  provider: '',
  model: '',
  apiKey: '',
  endpoint: '',
  maxTokens: 4096,
  temperature: 0.3,
}

export function migrateV1Config(v1: Record<string, unknown>): V2ConfigFile {
  const v1Providers = (v1['providers'] ?? {}) as Record<string, unknown>
  const githubProviderConfig = (v1Providers['github'] ?? {}) as Record<string, unknown>
  const gitlabProviderConfig = (v1Providers['gitlab'] ?? {}) as Record<string, unknown>

  const defaults: V2Defaults = {
    provider: (v1['provider'] as string) ?? 'github',
    theme: (v1['theme'] as string) ?? 'tokyo-night',
    pageSize: (v1['pageSize'] as number) ?? 30,
    refreshInterval: (v1['refreshInterval'] as number) ?? 60,
    owner: (v1['defaultOwner'] as string) ?? '',
    repo: (v1['defaultRepo'] as string) ?? '',
    compactList: (v1['compactList'] as boolean) ?? false,
    ...(v1['hasOnboarded'] !== undefined ? { hasOnboarded: v1['hasOnboarded'] as boolean } : {}),
    ...(v1['notifications'] !== undefined ? { notifications: v1['notifications'] as boolean } : {}),
    ...(v1['notifyOnNewPR'] !== undefined ? { notifyOnNewPR: v1['notifyOnNewPR'] as boolean } : {}),
    ...(v1['notifyOnUpdate'] !== undefined ? { notifyOnUpdate: v1['notifyOnUpdate'] as boolean } : {}),
    ...(v1['notifyOnReviewRequest'] !== undefined ? { notifyOnReviewRequest: v1['notifyOnReviewRequest'] as boolean } : {}),
    ...(v1['baseUrl'] !== undefined ? { baseUrl: v1['baseUrl'] as string } : {}),
    ...(v1['gitlab'] !== undefined ? { gitlab: v1['gitlab'] as { host: string } } : {}),
    ...(v1['keybindings'] !== undefined ? { keybindings: v1['keybindings'] as V2Defaults['keybindings'] } : {}),
    ...(v1['hostMappings'] !== undefined ? { hostMappings: v1['hostMappings'] as V2Defaults['hostMappings'] } : {}),
    ...(v1['botUsernames'] !== undefined ? { botUsernames: v1['botUsernames'] as readonly string[] } : {}),
  }

  const providers: V2ProvidersConfig = {
    github: { hosts: (githubProviderConfig['hosts'] as readonly string[]) ?? [] },
    gitlab: { hosts: (gitlabProviderConfig['hosts'] as readonly string[]) ?? [] },
    bitbucket: { hosts: [] },
    azure: { hosts: [] },
    gitea: { hosts: [] },
  }

  return {
    version: 2,
    defaults,
    providers,
    ai: { ...DEFAULT_AI_CONFIG },
    plugins: {},
    keybindingOverrides: (v1['keybindingOverrides'] as Record<string, unknown>) ?? {},
    recentRepos: (v1['recentRepos'] as V2ConfigFile['recentRepos']) ?? [],
    bookmarkedRepos: (v1['bookmarkedRepos'] as V2ConfigFile['bookmarkedRepos']) ?? [],
  }
}

// ---------------------------------------------------------------------------
// Environment variable resolution
// ---------------------------------------------------------------------------

const ENV_VAR_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g

export function resolveEnvVars(value: string): string {
  return value.replace(ENV_VAR_PATTERN, (_match, varName: string) => {
    return process.env[varName] ?? ''
  })
}

// ---------------------------------------------------------------------------
// Repo config merge
// ---------------------------------------------------------------------------

/**
 * Merge a per-repo `.lazyreview.yaml` config with the global V2 config.
 *
 * - `defaults` is shallow-merged (repo overrides individual fields)
 * - `providers` is deep-merged (repo adds/overrides per-provider hosts)
 * - `ai` is shallow-merged (repo overrides individual fields)
 * - Other fields use global values (repo config cannot override recentRepos, etc.)
 */
export function mergeRepoConfig(
  global: V2ConfigFile,
  repo: Record<string, unknown>,
): V2ConfigFile {
  if (Object.keys(repo).length === 0) {
    return global
  }

  const repoDefaults = (repo['defaults'] ?? {}) as Partial<V2Defaults>
  const repoProviders = (repo['providers'] ?? {}) as Partial<Record<string, { hosts?: readonly string[] }>>
  const repoAi = (repo['ai'] ?? {}) as Partial<AiConfig>

  const mergedDefaults: V2Defaults = {
    ...global.defaults,
    ...repoDefaults,
  }

  const mergedProviders: V2ProvidersConfig = {
    github: repoProviders['github']
      ? { hosts: repoProviders['github'].hosts ?? global.providers.github.hosts }
      : global.providers.github,
    gitlab: repoProviders['gitlab']
      ? { hosts: repoProviders['gitlab'].hosts ?? global.providers.gitlab.hosts }
      : global.providers.gitlab,
    bitbucket: repoProviders['bitbucket']
      ? { hosts: repoProviders['bitbucket'].hosts ?? global.providers.bitbucket.hosts }
      : global.providers.bitbucket,
    azure: repoProviders['azure']
      ? { hosts: repoProviders['azure'].hosts ?? global.providers.azure.hosts }
      : global.providers.azure,
    gitea: repoProviders['gitea']
      ? { hosts: repoProviders['gitea'].hosts ?? global.providers.gitea.hosts }
      : global.providers.gitea,
  }

  const mergedAi: AiConfig = {
    ...global.ai,
    ...repoAi,
  }

  return {
    ...global,
    defaults: mergedDefaults,
    providers: mergedProviders,
    ai: mergedAi,
  }
}

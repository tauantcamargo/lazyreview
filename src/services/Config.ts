import { Context, Effect, Layer, Schema as S } from 'effect'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { parse, stringify } from 'yaml'
import { ConfigError } from '../models/errors'
import {
  isV1Config,
  isV2Config,
  migrateV1Config,
  resolveEnvVars,
  mergeRepoConfig,
  type V2ConfigFile,
  type AiConfig,
  type PluginConfig,
} from './config-migration'

const KeybindingsSchema = S.Struct({
  toggleSidebar: S.optionalWith(S.String, { default: () => 'b' }),
  help: S.optionalWith(S.String, { default: () => '?' }),
  quit: S.optionalWith(S.String, { default: () => 'q' }),
})

export type Provider = 'github' | 'gitlab' | 'bitbucket' | 'azure' | 'gitea'

const GitLabConfigSchema = S.Struct({
  host: S.optionalWith(S.String, { default: () => 'https://gitlab.com' }),
})

const GitHubConfigSchema = S.Struct({
  hosts: S.optionalWith(S.Array(S.String), { default: () => [] as readonly string[] }),
})

const HostMappingSchema = S.Struct({
  host: S.String,
  provider: S.Union(
    S.Literal('github'),
    S.Literal('gitlab'),
    S.Literal('bitbucket'),
    S.Literal('azure'),
    S.Literal('gitea'),
  ),
})

export type HostMapping = S.Schema.Type<typeof HostMappingSchema>

const GitLabProviderConfigSchema = S.Struct({
  hosts: S.optionalWith(S.Array(S.String), { default: () => [] as readonly string[] }),
})

const ProvidersConfigSchema = S.Struct({
  github: S.optionalWith(GitHubConfigSchema, {
    default: () => ({ hosts: [] as readonly string[] }),
  }),
  gitlab: S.optionalWith(GitLabProviderConfigSchema, {
    default: () => ({ hosts: [] as readonly string[] }),
  }),
})

export type ProvidersConfig = S.Schema.Type<typeof ProvidersConfigSchema>

const RecentRepoSchema = S.Struct({
  owner: S.String,
  repo: S.String,
  lastUsed: S.String,
})

export type RecentRepo = S.Schema.Type<typeof RecentRepoSchema>

const BookmarkedRepoSchema = S.Struct({
  owner: S.String,
  repo: S.String,
})

export type BookmarkedRepo = S.Schema.Type<typeof BookmarkedRepoSchema>

export class AppConfig extends S.Class<AppConfig>('AppConfig')({
  provider: S.optionalWith(
    S.Union(
      S.Literal('github'),
      S.Literal('gitlab'),
      S.Literal('bitbucket'),
      S.Literal('azure'),
      S.Literal('gitea'),
    ),
    { default: () => 'github' as const },
  ),
  baseUrl: S.optional(S.String),
  gitlab: S.optional(GitLabConfigSchema),
  theme: S.optionalWith(S.String, { default: () => 'tokyo-night' }),
  defaultOwner: S.optional(S.String),
  defaultRepo: S.optional(S.String),
  pageSize: S.optionalWith(S.Number.pipe(S.int(), S.between(1, 100)), {
    default: () => 30,
  }),
  refreshInterval: S.optionalWith(S.Number.pipe(S.int(), S.between(10, 600)), {
    default: () => 60,
  }),
  keybindings: S.optionalWith(KeybindingsSchema, {
    default: () => ({ toggleSidebar: 'b', help: '?', quit: 'q' }),
  }),
  recentRepos: S.optionalWith(S.Array(RecentRepoSchema), {
    default: () => [],
  }),
  bookmarkedRepos: S.optionalWith(S.Array(BookmarkedRepoSchema), {
    default: () => [],
  }),
  hasOnboarded: S.optionalWith(S.Boolean, {
    default: () => false,
  }),
  keybindingOverrides: S.optional(
    S.Record({ key: S.String, value: S.Record({ key: S.String, value: S.Union(S.String, S.Array(S.String)) }) }),
  ),
  notifications: S.optionalWith(S.Boolean, {
    default: () => true,
  }),
  notifyOnNewPR: S.optionalWith(S.Boolean, {
    default: () => true,
  }),
  notifyOnUpdate: S.optionalWith(S.Boolean, {
    default: () => true,
  }),
  notifyOnReviewRequest: S.optionalWith(S.Boolean, {
    default: () => true,
  }),
  providers: S.optionalWith(ProvidersConfigSchema, {
    default: () => ({
      github: { hosts: [] as readonly string[] },
      gitlab: { hosts: [] as readonly string[] },
    }),
  }),
  hostMappings: S.optionalWith(S.Array(HostMappingSchema), {
    default: () => [],
  }),
  botUsernames: S.optionalWith(S.Array(S.String), {
    default: () => [] as readonly string[],
  }),
  compactList: S.optionalWith(S.Boolean, {
    default: () => false,
  }),
  prefetchEnabled: S.optionalWith(S.Boolean, {
    default: () => true,
  }),
  prefetchDelayMs: S.optionalWith(S.Number.pipe(S.int(), S.between(100, 5000)), {
    default: () => 500,
  }),
  commentTemplates: S.optionalWith(
    S.Array(
      S.Struct({
        name: S.String,
        prefix: S.optional(S.String),
        body: S.String,
        description: S.optional(S.String),
      }),
    ),
    { default: () => [] },
  ),
  reviewChecklist: S.optionalWith(
    S.Array(
      S.Struct({
        label: S.String,
        description: S.optionalWith(S.String, { default: () => '' }),
      }),
    ),
    { default: () => [] },
  ),
  aiProvider: S.optionalWith(S.String, { default: () => '' }),
  aiModel: S.optionalWith(S.String, { default: () => '' }),
  aiApiKey: S.optionalWith(S.String, { default: () => '' }),
  aiEndpoint: S.optionalWith(S.String, { default: () => '' }),
  aiMaxTokens: S.optionalWith(S.Number.pipe(S.int(), S.positive()), {
    default: () => 4096,
  }),
  aiTemperature: S.optionalWith(S.Number.pipe(S.between(0, 2)), {
    default: () => 0.3,
  }),
}) {}

// ---------------------------------------------------------------------------
// V2 Effect Schema definitions
// ---------------------------------------------------------------------------

const AiConfigSchema = S.Struct({
  provider: S.optionalWith(S.String, { default: () => '' }),
  model: S.optionalWith(S.String, { default: () => '' }),
  apiKey: S.optionalWith(S.String, { default: () => '' }),
  endpoint: S.optionalWith(S.String, { default: () => '' }),
  maxTokens: S.optionalWith(S.Number.pipe(S.int(), S.positive()), {
    default: () => 4096,
  }),
  temperature: S.optionalWith(S.Number.pipe(S.between(0, 2)), {
    default: () => 0.3,
  }),
})

const PluginConfigSchema = S.Record({
  key: S.String,
  value: S.Unknown,
})

export { type AiConfig, type PluginConfig }

const defaultConfig = S.decodeUnknownSync(AppConfig)({})

/**
 * Build a host-to-provider lookup map from an AppConfig.
 *
 * Sources:
 * 1. `providers.github.hosts` -- each entry maps to 'github'
 * 2. `providers.gitlab.hosts` -- each entry maps to 'gitlab'
 * 3. `hostMappings` -- each entry maps host -> provider (any provider type)
 *
 * Explicit `hostMappings` entries take precedence over provider-specific hosts.
 */
export function buildHostMappings(
  config: AppConfig,
): ReadonlyMap<string, Provider> {
  const map = new Map<string, Provider>()

  // Add providers.github.hosts entries
  const gheHosts = config.providers?.github?.hosts ?? []
  for (const host of gheHosts) {
    map.set(host.toLowerCase(), 'github')
  }

  // Add providers.gitlab.hosts entries
  const glHosts = config.providers?.gitlab?.hosts ?? []
  for (const host of glHosts) {
    map.set(host.toLowerCase(), 'gitlab')
  }

  // Add explicit hostMappings (takes precedence)
  const mappings = config.hostMappings ?? []
  for (const mapping of mappings) {
    map.set(mapping.host.toLowerCase(), mapping.provider)
  }

  return map
}

/**
 * Convert a buildHostMappings result to the ConfiguredHosts record
 * expected by detectProvider / parseGitRemote in git.ts.
 */
export function toConfiguredHosts(
  config: AppConfig,
): Record<string, Provider> {
  const map = buildHostMappings(config)
  const result: Record<string, Provider> = {}
  for (const [host, provider] of map) {
    result[host] = provider
  }
  return result
}

// ---------------------------------------------------------------------------
// Multi-instance support
// ---------------------------------------------------------------------------

/**
 * A configured provider instance, combining provider type with its host.
 */
export interface ConfiguredInstance {
  readonly provider: Provider
  readonly host: string
  readonly isDefault: boolean
}

const DEFAULT_HOSTS: Readonly<Record<Provider, string>> = {
  github: 'github.com',
  gitlab: 'gitlab.com',
  bitbucket: 'bitbucket.org',
  azure: 'dev.azure.com',
  gitea: 'gitea.com',
}

const ALL_PROVIDERS: readonly Provider[] = ['github', 'gitlab', 'bitbucket', 'azure', 'gitea']

/**
 * Build a list of all configured provider instances from AppConfig.
 *
 * Includes:
 * - Default host for each provider type
 * - Custom hosts from providers.github.hosts and providers.gitlab.hosts
 * - Custom hosts from hostMappings
 *
 * De-duplicates by provider+host combination.
 */
export function getConfiguredInstances(config: AppConfig): readonly ConfiguredInstance[] {
  const seen = new Set<string>()
  const instances: ConfiguredInstance[] = []

  function addInstance(provider: Provider, host: string, isDefault: boolean): void {
    const key = `${provider}:${host.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    instances.push({ provider, host: host.toLowerCase(), isDefault })
  }

  // Add default instances for all providers
  for (const provider of ALL_PROVIDERS) {
    addInstance(provider, DEFAULT_HOSTS[provider], true)
  }

  // Add custom github hosts
  const gheHosts = config.providers?.github?.hosts ?? []
  for (const host of gheHosts) {
    addInstance('github', host, false)
  }

  // Add custom gitlab hosts
  const glHosts = config.providers?.gitlab?.hosts ?? []
  for (const host of glHosts) {
    addInstance('gitlab', host, false)
  }

  // Add hosts from hostMappings
  const mappings = config.hostMappings ?? []
  for (const mapping of mappings) {
    addInstance(mapping.provider, mapping.host, false)
  }

  return instances
}

export interface ConfigService {
  readonly load: () => Effect.Effect<AppConfig, ConfigError>
  readonly save: (config: AppConfig) => Effect.Effect<void, ConfigError>
  readonly getPath: () => string
}

export class Config extends Context.Tag('Config')<Config, ConfigService>() {}

function getConfigPath(): string {
  return join(homedir(), '.config', 'lazyreview', 'config.yaml')
}

// ---------------------------------------------------------------------------
// V2 <-> AppConfig flattening
// ---------------------------------------------------------------------------

/**
 * Flatten a V2ConfigFile into the runtime AppConfig type.
 * This ensures backward compatibility -- hooks and components
 * continue reading the same fields they always have.
 */
export function flattenV2ToAppConfig(v2: V2ConfigFile): AppConfig {
  const d = v2.defaults
  const flat: Record<string, unknown> = {
    provider: d.provider,
    theme: d.theme,
    pageSize: d.pageSize,
    refreshInterval: d.refreshInterval,
    defaultOwner: d.owner || undefined,
    defaultRepo: d.repo || undefined,
    compactList: d.compactList,
    prefetchEnabled: d.prefetchEnabled,
    prefetchDelayMs: d.prefetchDelayMs,
    hasOnboarded: d.hasOnboarded,
    notifications: d.notifications,
    notifyOnNewPR: d.notifyOnNewPR,
    notifyOnUpdate: d.notifyOnUpdate,
    notifyOnReviewRequest: d.notifyOnReviewRequest,
    baseUrl: d.baseUrl,
    gitlab: d.gitlab,
    keybindings: d.keybindings,
    hostMappings: d.hostMappings,
    botUsernames: d.botUsernames,
    providers: {
      github: { hosts: v2.providers.github.hosts },
      gitlab: { hosts: v2.providers.gitlab.hosts },
    },
    keybindingOverrides: Object.keys(v2.keybindingOverrides).length > 0
      ? v2.keybindingOverrides
      : undefined,
    recentRepos: v2.recentRepos,
    bookmarkedRepos: v2.bookmarkedRepos,
    commentTemplates: v2.commentTemplates,
    reviewChecklist: v2.reviewChecklist,
    aiProvider: v2.ai.provider || '',
    aiModel: v2.ai.model || '',
    aiApiKey: v2.ai.apiKey || '',
    aiEndpoint: v2.ai.endpoint || '',
    aiMaxTokens: v2.ai.maxTokens,
    aiTemperature: v2.ai.temperature,
  }
  return S.decodeUnknownSync(AppConfig)(flat)
}

/**
 * Convert an AppConfig to V2ConfigFile for storage.
 */
export function appConfigToV2(config: AppConfig): V2ConfigFile {
  const base = migrateV1Config(config as unknown as Record<string, unknown>)
  return {
    ...base,
    ai: {
      provider: config.aiProvider ?? '',
      model: config.aiModel ?? '',
      apiKey: config.aiApiKey ?? '',
      endpoint: config.aiEndpoint ?? '',
      maxTokens: config.aiMaxTokens ?? 4096,
      temperature: config.aiTemperature ?? 0.3,
    },
  }
}

// ---------------------------------------------------------------------------
// Repo config loading
// ---------------------------------------------------------------------------

/**
 * Load a `.lazyreview.yaml` file from a repository root directory.
 * Returns the parsed YAML as a record, or empty object if not found.
 */
export async function loadRepoConfig(repoRoot: string): Promise<Record<string, unknown>> {
  const repoConfigPath = join(repoRoot, '.lazyreview.yaml')
  try {
    const content = await readFile(repoConfigPath, 'utf-8')
    const parsed = parse(content, { maxAliasCount: 10 })
    return (parsed as Record<string, unknown>) ?? {}
  } catch {
    return {}
  }
}

/**
 * Load global config, then merge with repo-level config if present.
 * Env vars in ai.apiKey and ai.endpoint are resolved.
 */
export async function loadConfigWithRepoOverrides(
  repoRoot: string,
  configPath?: string,
): Promise<AppConfig> {
  const cfgPath = configPath ?? getConfigPath()
  let globalV2: V2ConfigFile

  try {
    const content = await readFile(cfgPath, 'utf-8')
    const parsed = parse(content, { maxAliasCount: 10 })

    if (isV2Config(parsed)) {
      globalV2 = parsed as V2ConfigFile
    } else {
      globalV2 = migrateV1Config((parsed ?? {}) as Record<string, unknown>)
    }
  } catch {
    globalV2 = migrateV1Config({})
  }

  const repoConfig = await loadRepoConfig(repoRoot)
  const merged = mergeRepoConfig(globalV2, repoConfig)

  // Resolve env vars in AI config
  const resolvedAi: AiConfig = {
    ...merged.ai,
    apiKey: resolveEnvVars(merged.ai.apiKey),
    endpoint: resolveEnvVars(merged.ai.endpoint),
  }

  const withResolvedAi: V2ConfigFile = { ...merged, ai: resolvedAi }
  return flattenV2ToAppConfig(withResolvedAi)
}

// ---------------------------------------------------------------------------
// ConfigLive layer
// ---------------------------------------------------------------------------

export const ConfigLive = Layer.succeed(
  Config,
  Config.of({
    getPath: getConfigPath,

    load: () =>
      Effect.tryPromise({
        try: async () => {
          const configPath = getConfigPath()
          try {
            const content = await readFile(configPath, 'utf-8')
            const parsed = parse(content, { maxAliasCount: 10 })

            // V2 config -- flatten to AppConfig
            if (isV2Config(parsed)) {
              return flattenV2ToAppConfig(parsed as V2ConfigFile)
            }

            // V1 config -- migrate, backup, and save as V2
            if (isV1Config(parsed)) {
              const v2 = migrateV1Config((parsed ?? {}) as Record<string, unknown>)

              // Save backup (best-effort, don't fail if it errors)
              try {
                const backupPath = configPath + '.v1.backup'
                await writeFile(backupPath, content, { encoding: 'utf-8', mode: 0o600 })
              } catch {
                // backup is best-effort
              }

              // Save migrated V2 config
              try {
                await writeFile(configPath, stringify(v2), { encoding: 'utf-8', mode: 0o600 })
              } catch {
                // save is best-effort during migration
              }

              return flattenV2ToAppConfig(v2)
            }

            // Unknown format -- try decoding as AppConfig directly
            return S.decodeUnknownSync(AppConfig)(parsed)
          } catch {
            return defaultConfig
          }
        },
        catch: (error) =>
          new ConfigError({
            message: `Failed to load config: ${String(error)}`,
            path: getConfigPath(),
          }),
      }),

    save: (config: AppConfig) =>
      Effect.tryPromise({
        try: async () => {
          const configPath = getConfigPath()
          await mkdir(dirname(configPath), { recursive: true, mode: 0o700 })
          // Save in V2 format
          const v2 = appConfigToV2(config)
          await writeFile(configPath, stringify(v2), { encoding: 'utf-8', mode: 0o600 })
        },
        catch: (error) =>
          new ConfigError({
            message: `Failed to save config: ${String(error)}`,
            path: getConfigPath(),
          }),
      }),
  }),
)

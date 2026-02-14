import { Context, Effect, Layer, Schema as S } from 'effect'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { parse, stringify } from 'yaml'
import { ConfigError } from '../models/errors'

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
}) {}

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

export interface ConfigService {
  readonly load: () => Effect.Effect<AppConfig, ConfigError>
  readonly save: (config: AppConfig) => Effect.Effect<void, ConfigError>
  readonly getPath: () => string
}

export class Config extends Context.Tag('Config')<Config, ConfigService>() {}

function getConfigPath(): string {
  return join(homedir(), '.config', 'lazyreview', 'config.yaml')
}

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
          await writeFile(configPath, stringify(config), { encoding: 'utf-8', mode: 0o600 })
        },
        catch: (error) =>
          new ConfigError({
            message: `Failed to save config: ${String(error)}`,
            path: getConfigPath(),
          }),
      }),
  }),
)

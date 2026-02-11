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

export class AppConfig extends S.Class<AppConfig>('AppConfig')({
  provider: S.optionalWith(S.Literal('github'), {
    default: () => 'github' as const,
  }),
  theme: S.optionalWith(S.String, { default: () => 'tokyo-night' }),
  defaultOwner: S.optional(S.String),
  defaultRepo: S.optional(S.String),
  pageSize: S.optionalWith(S.Number.pipe(S.int(), S.between(1, 100)), {
    default: () => 30,
  }),
  keybindings: S.optionalWith(KeybindingsSchema, {
    default: () => ({ toggleSidebar: 'b', help: '?', quit: 'q' }),
  }),
}) {}

const defaultConfig = S.decodeUnknownSync(AppConfig)({})

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
            const parsed = parse(content)
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
          await mkdir(dirname(configPath), { recursive: true })
          await writeFile(configPath, stringify(config), 'utf-8')
        },
        catch: (error) =>
          new ConfigError({
            message: `Failed to save config: ${String(error)}`,
            path: getConfigPath(),
          }),
      }),
  }),
)

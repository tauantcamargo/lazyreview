import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import { ensureDir, getConfigDir } from '@lazyreview/platform';

const DefaultQuerySchema = z
  .object({
    state: z.string().optional(),
    reviewRequested: z.string().optional(),
    author: z.string().optional(),
    assignee: z.string().optional(),
    labels: z.string().optional(),
  })
  .optional();

const ProviderSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['github', 'gitlab', 'bitbucket', 'azuredevops']),
  host: z.string().min(1).optional(),
  baseUrl: z.string().min(1).optional(),
  tokenEnv: z.string().min(1).optional(),
  defaultQuery: DefaultQuerySchema,
  isDefault: z.boolean().optional(),
});

const AiConfigSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  baseUrl: z.string().optional(),
  enabled: z.boolean().optional(),
  strictness: z.enum(['relaxed', 'standard', 'strict']).optional(),
  costWarningThreshold: z.number().optional(),
  costMonthlyLimit: z.number().optional(),
  showCostEstimate: z.boolean().optional(),
  fallbackChain: z.array(z.string()).optional(),
}).optional();

const UiConfigSchema = z.object({
  theme: z.string().optional(),
  paging: z.boolean().optional(),
  showChecks: z.boolean().optional(),
  vimMode: z.boolean().optional(),
  editor: z.string().optional(),
  unicodeMode: z.enum(['auto', 'on', 'off']).optional(),
}).optional();

const PerformanceSchema = z.object({
  cacheTtl: z.number().optional(),
  commentCacheTtl: z.number().optional(),
  maxConcurrency: z.number().optional(),
  rateLimitPerSecond: z.number().optional(),
}).optional();

const ConfigSchema = z.object({
  version: z.string().optional(),
  defaultProvider: z.string().optional(),
  ui: UiConfigSchema,
  performance: PerformanceSchema,
  ai: AiConfigSchema,
  providers: z.array(ProviderSchema).optional(),
});

export type AppConfig = z.infer<typeof ConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderSchema>;

export const DEFAULT_CONFIG: AppConfig = {
  version: '0.1',
  defaultProvider: '',
  ui: {
    theme: 'lazygit',
    paging: true,
    showChecks: true,
    vimMode: true,
    editor: '',
    unicodeMode: 'auto',
  },
  performance: {
    cacheTtl: 120,
    commentCacheTtl: 20,
    maxConcurrency: 6,
    rateLimitPerSecond: 10,
  },
  ai: {
    provider: '',
    model: '',
    baseUrl: '',
    enabled: false,
    strictness: 'standard',
    costWarningThreshold: 10.0,
    costMonthlyLimit: 50.0,
    showCostEstimate: true,
    fallbackChain: ['openai', 'anthropic', 'ollama'],
  },
  providers: [],
};

export function getConfigPath(): string {
  return join(getConfigDir(), 'config.yaml');
}

export function loadConfig(): AppConfig {
  const path = getConfigPath();
  try {
    const raw = readFileSync(path, 'utf8');
    const data = normalizeConfig(YAML.parse(raw) ?? {});
    const parsed = ConfigSchema.parse(data ?? {});
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      ui: { ...DEFAULT_CONFIG.ui, ...parsed.ui },
      performance: { ...DEFAULT_CONFIG.performance, ...parsed.performance },
      ai: { ...DEFAULT_CONFIG.ai, ...parsed.ai },
      providers: parsed.providers ?? [],
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: AppConfig): void {
  const path = getConfigPath();
  ensureDir(getConfigDir());
  const content = YAML.stringify(serializeConfig(config));
  writeFileSync(path, content, 'utf8');
}

export function getDefaultProvider(config: AppConfig): ProviderConfig | null {
  if (!config.providers || config.providers.length === 0) {
    return null;
  }

  if (config.defaultProvider) {
    const byName = config.providers.find((provider) => provider.name === config.defaultProvider);
    if (byName) {
      return byName;
    }
  }

  return config.providers[0] ?? null;
}

function normalizeConfig(raw: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...raw };

  if (raw.default_provider && !raw.defaultProvider) {
    normalized.defaultProvider = raw.default_provider;
  }

  if (raw.ui && typeof raw.ui === 'object') {
    const ui = raw.ui as Record<string, unknown>;
    normalized.ui = {
      ...ui,
      showChecks: ui.show_checks ?? ui.showChecks,
      vimMode: ui.vim_mode ?? ui.vimMode,
      unicodeMode: ui.unicode_mode ?? ui.unicodeMode,
    };
  }

  if (raw.performance && typeof raw.performance === 'object') {
    const perf = raw.performance as Record<string, unknown>;
    normalized.performance = {
      ...perf,
      cacheTtl: perf.cache_ttl ?? perf.cacheTtl,
      commentCacheTtl: perf.comment_cache_ttl ?? perf.commentCacheTtl,
      maxConcurrency: perf.max_concurrency ?? perf.maxConcurrency,
      rateLimitPerSecond: perf.rate_limit_per_second ?? perf.rateLimitPerSecond,
    };
  }

  if (raw.ai && typeof raw.ai === 'object') {
    const ai = raw.ai as Record<string, unknown>;
    normalized.ai = {
      ...ai,
      baseUrl: ai.base_url ?? ai.baseUrl,
      costWarningThreshold: ai.cost_warning_threshold ?? ai.costWarningThreshold,
      costMonthlyLimit: ai.cost_monthly_limit ?? ai.costMonthlyLimit,
      showCostEstimate: ai.show_cost_estimate ?? ai.showCostEstimate,
      fallbackChain: ai.fallback_chain ?? ai.fallbackChain,
    };
  }

  if (Array.isArray(raw.providers)) {
    normalized.providers = raw.providers.map((provider) => {
      if (!provider || typeof provider !== 'object') {
        return provider;
      }
      const p = provider as Record<string, unknown>;
      const defaultQuery = (p.default_query ?? p.defaultQuery) as Record<string, unknown> | undefined;
      return {
        ...p,
        baseUrl: p.base_url ?? p.baseUrl,
        tokenEnv: p.token_env ?? p.tokenEnv,
        defaultQuery: defaultQuery
          ? {
              ...defaultQuery,
              reviewRequested: defaultQuery.review_requested ?? defaultQuery.reviewRequested,
            }
          : undefined,
      };
    });
  }

  return normalized;
}

function serializeConfig(config: AppConfig): Record<string, unknown> {
  return {
    version: config.version,
    default_provider: config.defaultProvider,
    ui: config.ui
      ? {
          theme: config.ui.theme,
          paging: config.ui.paging,
          show_checks: config.ui.showChecks,
          vim_mode: config.ui.vimMode,
          editor: config.ui.editor,
          unicode_mode: config.ui.unicodeMode,
        }
      : undefined,
    performance: config.performance
      ? {
          cache_ttl: config.performance.cacheTtl,
          comment_cache_ttl: config.performance.commentCacheTtl,
          max_concurrency: config.performance.maxConcurrency,
          rate_limit_per_second: config.performance.rateLimitPerSecond,
        }
      : undefined,
    ai: config.ai
      ? {
          provider: config.ai.provider,
          model: config.ai.model,
          base_url: config.ai.baseUrl,
          enabled: config.ai.enabled,
          strictness: config.ai.strictness,
          cost_warning_threshold: config.ai.costWarningThreshold,
          cost_monthly_limit: config.ai.costMonthlyLimit,
          show_cost_estimate: config.ai.showCostEstimate,
          fallback_chain: config.ai.fallbackChain,
        }
      : undefined,
    providers: config.providers?.map((provider) => ({
      name: provider.name,
      type: provider.type,
      host: provider.host,
      base_url: provider.baseUrl,
      token_env: provider.tokenEnv,
      default_query: provider.defaultQuery
        ? {
            state: provider.defaultQuery.state,
            review_requested: provider.defaultQuery.reviewRequested,
            author: provider.defaultQuery.author,
            assignee: provider.defaultQuery.assignee,
            labels: provider.defaultQuery.labels,
          }
        : undefined,
    })),
  };
}

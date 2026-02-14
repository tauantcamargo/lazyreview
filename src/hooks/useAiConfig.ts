/**
 * Hook for accessing the AI configuration from the V2 config.
 *
 * The AI config lives in the V2 config structure but is not part of
 * the flattened AppConfig. This hook loads the raw config file and
 * extracts the AI section.
 */
import { useQuery } from '@tanstack/react-query'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { parse } from 'yaml'
import type { AiConfig } from '../services/config-migration'
import { isV2Config, resolveEnvVars } from '../services/config-migration'

interface UseAiConfigReturn {
  readonly aiConfig: AiConfig | undefined
  readonly isLoading: boolean
}

const DEFAULT_AI_CONFIG: AiConfig = {
  provider: '',
  model: '',
  apiKey: '',
  endpoint: '',
  maxTokens: 4096,
  temperature: 0.3,
}

function getConfigPath(): string {
  return join(homedir(), '.config', 'lazyreview', 'config.yaml')
}

async function loadAiConfig(): Promise<AiConfig> {
  try {
    const content = await readFile(getConfigPath(), 'utf-8')
    const parsed = parse(content, { maxAliasCount: 10 })

    if (isV2Config(parsed)) {
      const v2 = parsed as { readonly ai?: Partial<AiConfig> }
      const raw = v2.ai ?? {}
      return {
        provider: raw.provider ?? DEFAULT_AI_CONFIG.provider,
        model: raw.model ?? DEFAULT_AI_CONFIG.model,
        apiKey: resolveEnvVars(raw.apiKey ?? DEFAULT_AI_CONFIG.apiKey),
        endpoint: resolveEnvVars(raw.endpoint ?? DEFAULT_AI_CONFIG.endpoint),
        maxTokens: raw.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens,
        temperature: raw.temperature ?? DEFAULT_AI_CONFIG.temperature,
      }
    }

    return DEFAULT_AI_CONFIG
  } catch {
    return DEFAULT_AI_CONFIG
  }
}

export function useAiConfig(): UseAiConfigReturn {
  const { data, isLoading } = useQuery({
    queryKey: ['aiConfig'],
    queryFn: loadAiConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    aiConfig: data,
    isLoading,
  }
}

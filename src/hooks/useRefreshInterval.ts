import { useConfig } from './useConfig'
import { useRateLimit } from './useRateLimit'

const RATE_LIMIT_THRESHOLD = 100
const SLOW_INTERVAL_MS = 5 * 60 * 1000

export function useRefreshInterval(overrideSeconds?: number): number {
  const { config } = useConfig()
  const baseSeconds = overrideSeconds ?? config?.refreshInterval ?? 60
  const baseMs = baseSeconds * 1000

  const { remaining } = useRateLimit()
  if (remaining < RATE_LIMIT_THRESHOLD) {
    return SLOW_INTERVAL_MS
  }

  return baseMs
}

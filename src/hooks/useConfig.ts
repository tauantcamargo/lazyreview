import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import { Config, ConfigLive, type AppConfig } from '../services/Config'

interface UseConfigReturn {
  readonly config: AppConfig | null
  readonly error: string | null
  readonly loading: boolean
  readonly updateConfig: (updates: Partial<AppConfig>) => void
}

export function useConfig(): UseConfigReturn {
  const queryClient = useQueryClient()

  const { data, error, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const configService = yield* Config
          return yield* configService.load()
        }).pipe(Effect.provide(ConfigLive)),
      ),
  })

  const mutation = useMutation({
    mutationFn: (newConfig: AppConfig) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const configService = yield* Config
          yield* configService.save(newConfig)
        }).pipe(Effect.provide(ConfigLive)),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] })
    },
  })

  const updateConfig = (updates: Partial<AppConfig>) => {
    if (!data) return
    const newConfig = { ...data, ...updates } as AppConfig
    queryClient.setQueryData(['config'], newConfig)
    mutation.mutate(newConfig)
  }

  return {
    config: data ?? null,
    error: error ? String(error) : null,
    loading: isLoading,
    updateConfig,
  }
}

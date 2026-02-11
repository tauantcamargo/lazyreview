import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import { Auth, AuthLive } from '../services/Auth'
import type { TokenSource, TokenInfo } from '../services/Auth'
import type { User } from '../models/user'

interface UseAuthReturn {
  readonly user: User | null
  readonly isAuthenticated: boolean
  readonly error: string | null
  readonly loading: boolean
  readonly saveToken: (token: string) => Promise<void>
  readonly isSavingToken: boolean
  readonly tokenInfo: TokenInfo | null
  readonly availableSources: TokenSource[]
  readonly setPreferredSource: (source: TokenSource) => Promise<void>
  readonly clearManualToken: () => Promise<void>
  readonly refetch: () => void
}

export function useAuth(): UseAuthReturn {
  const queryClient = useQueryClient()

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['auth'],
    queryFn: () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const auth = yield* Auth
          const authenticated = yield* auth.isAuthenticated()

          if (!authenticated) {
            return { user: null, isAuthenticated: false }
          }

          const currentUser = yield* auth.getUser()
          return { user: currentUser, isAuthenticated: true }
        }).pipe(Effect.provide(AuthLive)),
      ),
    staleTime: Infinity,
  })

  const { data: tokenInfoData } = useQuery({
    queryKey: ['tokenInfo'],
    queryFn: () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const auth = yield* Auth
          return yield* auth.getTokenInfo()
        }).pipe(Effect.provide(AuthLive)),
      ),
    staleTime: 0, // Always refetch
  })

  const { data: availableSourcesData } = useQuery({
    queryKey: ['availableSources'],
    queryFn: () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const auth = yield* Auth
          return yield* auth.getAvailableSources()
        }).pipe(Effect.provide(AuthLive)),
      ),
    staleTime: 0,
  })

  const saveTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      await Effect.runPromise(
        Effect.gen(function* () {
          const auth = yield* Auth
          yield* auth.setToken(token)
        }).pipe(Effect.provide(AuthLive)),
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] })
      queryClient.invalidateQueries({ queryKey: ['tokenInfo'] })
      queryClient.invalidateQueries({ queryKey: ['availableSources'] })
    },
  })

  const setPreferredSourceMutation = useMutation({
    mutationFn: async (source: TokenSource) => {
      await Effect.runPromise(
        Effect.gen(function* () {
          const auth = yield* Auth
          yield* auth.setPreferredSource(source)
        }).pipe(Effect.provide(AuthLive)),
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] })
      queryClient.invalidateQueries({ queryKey: ['tokenInfo'] })
    },
  })

  const clearManualTokenMutation = useMutation({
    mutationFn: async () => {
      await Effect.runPromise(
        Effect.gen(function* () {
          const auth = yield* Auth
          yield* auth.clearManualToken()
        }).pipe(Effect.provide(AuthLive)),
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] })
      queryClient.invalidateQueries({ queryKey: ['tokenInfo'] })
      queryClient.invalidateQueries({ queryKey: ['availableSources'] })
    },
  })

  return {
    user: data?.user ?? null,
    isAuthenticated: data?.isAuthenticated ?? false,
    error: error ? String(error) : null,
    loading: isLoading,
    saveToken: saveTokenMutation.mutateAsync,
    isSavingToken: saveTokenMutation.isPending,
    tokenInfo: tokenInfoData ?? null,
    availableSources: availableSourcesData ?? [],
    setPreferredSource: setPreferredSourceMutation.mutateAsync,
    clearManualToken: clearManualTokenMutation.mutateAsync,
    refetch: () => {
      refetch()
      queryClient.invalidateQueries({ queryKey: ['tokenInfo'] })
      queryClient.invalidateQueries({ queryKey: ['availableSources'] })
    },
  }
}

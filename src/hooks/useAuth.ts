import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import { Auth, AuthLive } from '../services/Auth'
import type { User } from '../models/user'

interface UseAuthReturn {
  readonly user: User | null
  readonly isAuthenticated: boolean
  readonly error: string | null
  readonly loading: boolean
  readonly saveToken: (token: string) => Promise<void>
  readonly isSavingToken: boolean
}

export function useAuth(): UseAuthReturn {
  const queryClient = useQueryClient()

  const { data, error, isLoading } = useQuery({
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

  const saveTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      await Effect.runPromise(
        Effect.gen(function* () {
          const auth = yield* Auth
          // Set token in session
          yield* auth.setToken(token)
          // Save to shell profile
          yield* auth.saveTokenToShell(token)
        }).pipe(Effect.provide(AuthLive)),
      )
    },
    onSuccess: () => {
      // Invalidate auth query to refetch with new token
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
  })

  return {
    user: data?.user ?? null,
    isAuthenticated: data?.isAuthenticated ?? false,
    error: error ? String(error) : null,
    loading: isLoading,
    saveToken: saveTokenMutation.mutateAsync,
    isSavingToken: saveTokenMutation.isPending,
  }
}

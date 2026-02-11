import { useQuery } from '@tanstack/react-query'
import { Effect } from 'effect'
import { Auth, AuthLive } from '../services/Auth'
import type { User } from '../models/user'

interface UseAuthReturn {
  readonly user: User | null
  readonly isAuthenticated: boolean
  readonly error: string | null
  readonly loading: boolean
}

export function useAuth(): UseAuthReturn {
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

  return {
    user: data?.user ?? null,
    isAuthenticated: data?.isAuthenticated ?? false,
    error: error ? String(error) : null,
    loading: isLoading,
  }
}

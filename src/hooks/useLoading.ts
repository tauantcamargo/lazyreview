export interface LoadingState {
  readonly isLoading: boolean
  readonly message: string | null
}

const emptyState: LoadingState = { isLoading: false, message: null }

/**
 * Returns the current loading state.
 * Currently always returns the empty state since no loading service is wired up.
 * The StatusBar uses this to show a spinner when loading.
 */
export function useLoading(): LoadingState {
  return emptyState
}

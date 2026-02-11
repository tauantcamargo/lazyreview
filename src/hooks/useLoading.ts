import { useSyncExternalStore } from 'react'
import type { LoadingState, LoadingService } from '../services/Loading'

let loadingService: LoadingService | null = null

export function setLoadingService(service: LoadingService): void {
  loadingService = service
}

export function getLoadingService(): LoadingService | null {
  return loadingService
}

const emptyState: LoadingState = { isLoading: false, message: null }

export function useLoading(): LoadingState {
  return useSyncExternalStore(
    (callback) => {
      if (!loadingService) return () => {}
      return loadingService.subscribe(callback)
    },
    () => loadingService?.getState() ?? emptyState,
    () => emptyState,
  )
}

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useInput } from 'ink'
import { useStatusMessage } from './useStatusMessage'

interface UseManualRefreshOptions {
  readonly isActive?: boolean
  readonly queryKeys?: readonly string[][]
}

export function useManualRefresh({
  isActive = true,
  queryKeys,
}: UseManualRefreshOptions = {}): {
  readonly refresh: () => void
} {
  const queryClient = useQueryClient()
  const { setStatusMessage } = useStatusMessage()

  const refresh = useCallback(() => {
    if (queryKeys && queryKeys.length > 0) {
      queryKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key })
      })
    } else {
      queryClient.invalidateQueries()
    }
    setStatusMessage('Refreshing...')
  }, [queryClient, queryKeys, setStatusMessage])

  useInput(
    (input) => {
      if (input === 'R') {
        refresh()
      }
    },
    { isActive },
  )

  return { refresh } as const
}

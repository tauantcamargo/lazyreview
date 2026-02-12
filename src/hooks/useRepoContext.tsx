import React, { createContext, useContext, useState, useCallback } from 'react'

export interface RepoIdentifier {
  readonly owner: string
  readonly repo: string
}

interface RepoContextType {
  readonly localRepo: RepoIdentifier | null
  readonly browseRepo: RepoIdentifier | null
  readonly setBrowseRepo: (owner: string, repo: string) => void
  readonly clearBrowseRepo: () => void
}

const RepoContext = createContext<RepoContextType>({
  localRepo: null,
  browseRepo: null,
  setBrowseRepo: () => {},
  clearBrowseRepo: () => {},
})

interface RepoContextProviderProps {
  readonly localRepo: RepoIdentifier | null
  readonly children: React.ReactNode
}

export function RepoContextProvider({
  localRepo,
  children,
}: RepoContextProviderProps): React.ReactElement {
  const [browseRepo, setBrowseRepoState] = useState<RepoIdentifier | null>(null)

  const setBrowseRepo = useCallback((owner: string, repo: string) => {
    setBrowseRepoState({ owner, repo })
  }, [])

  const clearBrowseRepo = useCallback(() => {
    setBrowseRepoState(null)
  }, [])

  return React.createElement(
    RepoContext.Provider,
    {
      value: {
        localRepo,
        browseRepo,
        setBrowseRepo,
        clearBrowseRepo,
      },
    },
    children,
  )
}

export function useRepoContext(): RepoContextType {
  return useContext(RepoContext)
}

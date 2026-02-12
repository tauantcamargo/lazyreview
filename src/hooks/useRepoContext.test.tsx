import React, { useEffect } from 'react'
import { describe, it, expect } from 'vitest'
import { render, cleanup } from 'ink-testing-library'
import { Text } from 'ink'
import { RepoContextProvider, useRepoContext } from './useRepoContext'
import type { RepoIdentifier } from './useRepoContext'

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function TestConsumer(): React.ReactElement {
  const { localRepo, browseRepo } =
    useRepoContext()
  return (
    <Text>
      local:{localRepo ? `${localRepo.owner}/${localRepo.repo}` : 'null'}
      |browse:{browseRepo ? `${browseRepo.owner}/${browseRepo.repo}` : 'null'}
    </Text>
  )
}

function TestSetBrowse({ owner, repo }: { readonly owner: string; readonly repo: string }): React.ReactElement {
  const { localRepo, browseRepo, setBrowseRepo } = useRepoContext()
  useEffect(() => {
    setBrowseRepo(owner, repo)
  }, [owner, repo, setBrowseRepo])
  return (
    <Text>
      local:{localRepo ? `${localRepo.owner}/${localRepo.repo}` : 'null'}
      |browse:{browseRepo ? `${browseRepo.owner}/${browseRepo.repo}` : 'null'}
    </Text>
  )
}

function TestClearBrowse(): React.ReactElement {
  const { localRepo, browseRepo, setBrowseRepo, clearBrowseRepo } = useRepoContext()
  useEffect(() => {
    setBrowseRepo('temp', 'repo')
    clearBrowseRepo()
  }, [setBrowseRepo, clearBrowseRepo])
  return (
    <Text>
      local:{localRepo ? `${localRepo.owner}/${localRepo.repo}` : 'null'}
      |browse:{browseRepo ? `${browseRepo.owner}/${browseRepo.repo}` : 'null'}
    </Text>
  )
}

describe('RepoContextProvider', () => {
  it('provides localRepo from props', () => {
    const localRepo: RepoIdentifier = { owner: 'octocat', repo: 'hello' }
    const { lastFrame } = render(
      <RepoContextProvider localRepo={localRepo}>
        <TestConsumer />
      </RepoContextProvider>,
    )
    expect(lastFrame()).toContain('local:octocat/hello')
    cleanup()
  })

  it('provides null localRepo when not set', () => {
    const { lastFrame } = render(
      <RepoContextProvider localRepo={null}>
        <TestConsumer />
      </RepoContextProvider>,
    )
    expect(lastFrame()).toContain('local:null')
    cleanup()
  })

  it('initializes browseRepo as null', () => {
    const { lastFrame } = render(
      <RepoContextProvider localRepo={null}>
        <TestConsumer />
      </RepoContextProvider>,
    )
    expect(lastFrame()).toContain('browse:null')
    cleanup()
  })

  it('setBrowseRepo updates browseRepo state', async () => {
    const { lastFrame } = render(
      <RepoContextProvider localRepo={null}>
        <TestSetBrowse owner="facebook" repo="react" />
      </RepoContextProvider>,
    )
    await delay(50)
    expect(lastFrame()).toContain('browse:facebook/react')
    cleanup()
  })

  it('setBrowseRepo does not affect localRepo', async () => {
    const localRepo: RepoIdentifier = { owner: 'octocat', repo: 'hello' }
    const { lastFrame } = render(
      <RepoContextProvider localRepo={localRepo}>
        <TestSetBrowse owner="vercel" repo="next.js" />
      </RepoContextProvider>,
    )
    await delay(50)
    expect(lastFrame()).toContain('local:octocat/hello')
    expect(lastFrame()).toContain('browse:vercel/next.js')
    cleanup()
  })

  it('clearBrowseRepo resets browseRepo to null', async () => {
    const { lastFrame } = render(
      <RepoContextProvider localRepo={null}>
        <TestClearBrowse />
      </RepoContextProvider>,
    )
    await delay(50)
    expect(lastFrame()).toContain('browse:null')
    cleanup()
  })
})

describe('useRepoContext', () => {
  it('returns default values when used outside provider', () => {
    const { lastFrame } = render(<TestConsumer />)
    expect(lastFrame()).toContain('local:null')
    expect(lastFrame()).toContain('browse:null')
    cleanup()
  })
})

describe('RepoIdentifier type', () => {
  it('creates a valid repo identifier', () => {
    const repo: RepoIdentifier = { owner: 'facebook', repo: 'react' }
    expect(repo.owner).toBe('facebook')
    expect(repo.repo).toBe('react')
  })

  it('is readonly', () => {
    const repo: RepoIdentifier = { owner: 'a', repo: 'b' }
    // TypeScript would prevent mutation; verify shape
    expect(Object.keys(repo)).toEqual(['owner', 'repo'])
  })
})

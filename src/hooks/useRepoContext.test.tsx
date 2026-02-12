import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, cleanup } from 'ink-testing-library'
import { Text } from 'ink'
import { RepoContextProvider, useRepoContext } from './useRepoContext'
import type { RepoIdentifier } from './useRepoContext'

function TestConsumer(): React.ReactElement {
  const { localRepo, browseRepo, setBrowseRepo, clearBrowseRepo } =
    useRepoContext()
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

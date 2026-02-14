import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import {
  createMockGitHubProvider,
  createMockGitLabProvider,
  createMockBitbucketProvider,
  createMinimalMockProvider,
  createMockUser,
  createMockProvider,
} from './mock-helpers'
import { createUnsupportedProvider } from '../github'

describe('provider assignee capabilities', () => {
  it('GitHub provider supports assignees', () => {
    const provider = createMockGitHubProvider()
    expect(provider.capabilities.supportsAssignees).toBe(true)
  })

  it('GitLab provider does not support assignees', () => {
    const provider = createMockGitLabProvider()
    expect(provider.capabilities.supportsAssignees).toBe(false)
  })

  it('Bitbucket provider does not support assignees', () => {
    const provider = createMockBitbucketProvider()
    expect(provider.capabilities.supportsAssignees).toBe(false)
  })

  it('minimal provider does not support assignees', () => {
    const provider = createMinimalMockProvider()
    expect(provider.capabilities.supportsAssignees).toBe(false)
  })

  it('unsupported provider does not support assignees', () => {
    const provider = createUnsupportedProvider('custom')
    expect(provider.capabilities.supportsAssignees).toBe(false)
  })
})

describe('provider assignee methods', () => {
  it('getCollaborators returns users for mock provider', async () => {
    const provider = createMockGitHubProvider()
    const users = await Effect.runPromise(provider.getCollaborators())
    expect(Array.isArray(users)).toBe(true)
    expect(users).toHaveLength(1)
    expect(users[0]!.login).toBe('testuser')
  })

  it('updateAssignees succeeds for mock provider', async () => {
    const provider = createMockGitHubProvider()
    await expect(
      Effect.runPromise(provider.updateAssignees(1, ['alice', 'bob'])),
    ).resolves.toBeUndefined()
  })

  it('getCollaborators fails for unsupported provider', async () => {
    const provider = createUnsupportedProvider('custom')
    const result = await Effect.runPromiseExit(provider.getCollaborators())
    expect(result._tag).toBe('Failure')
  })

  it('updateAssignees fails for unsupported provider', async () => {
    const provider = createUnsupportedProvider('custom')
    const result = await Effect.runPromiseExit(
      provider.updateAssignees(1, ['alice']),
    )
    expect(result._tag).toBe('Failure')
  })

  it('allows overriding getCollaborators', async () => {
    const customUser = createMockUser({ login: 'custom-user' })
    const provider = createMockProvider('github', undefined, {
      getCollaborators: () => Effect.succeed([customUser]),
    })
    const users = await Effect.runPromise(provider.getCollaborators())
    expect(users).toHaveLength(1)
    expect(users[0]!.login).toBe('custom-user')
  })

  it('allows overriding updateAssignees', async () => {
    let capturedAssignees: readonly string[] = []
    const provider = createMockProvider('github', undefined, {
      updateAssignees: (_prNumber, assignees) => {
        capturedAssignees = assignees
        return Effect.succeed(undefined as void)
      },
    })
    await Effect.runPromise(provider.updateAssignees(1, ['alice', 'bob']))
    expect(capturedAssignees).toEqual(['alice', 'bob'])
  })

  it('getCollaborators returns multiple users when overridden', async () => {
    const users = [
      createMockUser({ login: 'alice' }),
      createMockUser({ login: 'bob' }),
      createMockUser({ login: 'charlie' }),
    ]
    const provider = createMockProvider('github', undefined, {
      getCollaborators: () => Effect.succeed(users),
    })
    const result = await Effect.runPromise(provider.getCollaborators())
    expect(result).toHaveLength(3)
    expect(result.map((u) => u.login)).toEqual(['alice', 'bob', 'charlie'])
  })
})

describe('createMockUser', () => {
  it('creates a user with defaults', () => {
    const user = createMockUser()
    expect(user.login).toBe('testuser')
    expect(user.id).toBe(1)
    expect(user.avatar_url).toBe('https://example.com/avatar.png')
    expect(user.html_url).toBe('https://github.com/testuser')
    expect(user.type).toBe('User')
  })

  it('allows overrides', () => {
    const user = createMockUser({ login: 'alice', id: 42 })
    expect(user.login).toBe('alice')
    expect(user.id).toBe(42)
  })
})

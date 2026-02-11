import { describe, it, expect } from 'vitest'
import { Schema as S } from 'effect'
import { User } from './user'

describe('User schema', () => {
  const decode = S.decodeUnknownSync(User)

  it('decodes a valid user', () => {
    const result = decode({
      login: 'octocat',
      id: 1,
      avatar_url: 'https://avatars.githubusercontent.com/u/1',
      html_url: 'https://github.com/octocat',
    })
    expect(result.login).toBe('octocat')
    expect(result.id).toBe(1)
    expect(result.type).toBe('User')
  })

  it('decodes a user with custom type', () => {
    const result = decode({
      login: 'bot',
      id: 2,
      avatar_url: 'https://avatars.githubusercontent.com/u/2',
      html_url: 'https://github.com/bot',
      type: 'Bot',
    })
    expect(result.type).toBe('Bot')
  })

  it('rejects missing login', () => {
    expect(() =>
      decode({
        id: 1,
        avatar_url: 'https://avatars.githubusercontent.com/u/1',
        html_url: 'https://github.com/octocat',
      }),
    ).toThrow()
  })

  it('rejects non-numeric id', () => {
    expect(() =>
      decode({
        login: 'octocat',
        id: 'not-a-number',
        avatar_url: 'https://example.com',
        html_url: 'https://example.com',
      }),
    ).toThrow()
  })
})

import { describe, it, expect } from 'vitest'
import { providerBadge } from './provider-helpers'

describe('providerBadge', () => {
  it('returns [GH] for github', () => {
    expect(providerBadge('github')).toBe('[GH]')
  })

  it('returns [GL] for gitlab', () => {
    expect(providerBadge('gitlab')).toBe('[GL]')
  })

  it('returns [BB] for bitbucket', () => {
    expect(providerBadge('bitbucket')).toBe('[BB]')
  })

  it('returns [AZ] for azure', () => {
    expect(providerBadge('azure')).toBe('[AZ]')
  })

  it('returns [GT] for gitea', () => {
    expect(providerBadge('gitea')).toBe('[GT]')
  })

  it('returns empty string for an unknown provider', () => {
    expect(providerBadge('unknown-provider')).toBe('')
  })

  it('returns empty string when provider is undefined', () => {
    expect(providerBadge(undefined)).toBe('')
  })
})

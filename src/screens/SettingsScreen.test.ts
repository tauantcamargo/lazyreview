import { describe, it, expect } from 'vitest'
import { toggleEnabledProvidersList } from './SettingsScreen'

describe('toggleEnabledProvidersList', () => {
  it('enables a provider that is not currently enabled', () => {
    const result = toggleEnabledProvidersList(['github'], 'bitbucket')
    expect(result).toEqual(['github', 'bitbucket'])
  })

  it('disables a provider that is currently enabled', () => {
    const result = toggleEnabledProvidersList(
      ['github', 'bitbucket'],
      'bitbucket',
    )
    expect(result).toEqual(['github'])
  })

  it('refuses to disable the last remaining provider', () => {
    const result = toggleEnabledProvidersList(['github'], 'github')
    expect(result).toBeNull()
  })

  it('does not mutate the input array', () => {
    const input = ['github']
    toggleEnabledProvidersList(input, 'bitbucket')
    expect(input).toEqual(['github'])
  })

  it('toggling twice returns to the original set', () => {
    const enabled = toggleEnabledProvidersList(['github'], 'bitbucket')
    expect(enabled).not.toBeNull()
    const disabled = toggleEnabledProvidersList(enabled!, 'bitbucket')
    expect(disabled).toEqual(['github'])
  })
})

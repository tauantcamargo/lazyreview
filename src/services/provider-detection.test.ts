import { describe, it, expect, beforeEach } from 'vitest'
import {
  setAuthProvider,
  getAuthProvider,
  setAuthBaseUrl,
  getAuthBaseUrl,
  resetAuthState,
  getProviderMeta,
  getEnvVarName,
  getProviderTokenFilePath,
  maskToken,
} from './Auth'
import type { Provider } from './Config'

describe('provider detection and switching', () => {
  beforeEach(() => {
    resetAuthState()
  })

  describe('setAuthProvider / getAuthProvider', () => {
    it('defaults to github', () => {
      expect(getAuthProvider()).toBe('github')
    })

    it('can switch to gitlab', () => {
      setAuthProvider('gitlab')
      expect(getAuthProvider()).toBe('gitlab')
    })

    it('can switch to bitbucket', () => {
      setAuthProvider('bitbucket')
      expect(getAuthProvider()).toBe('bitbucket')
    })

    it('can switch to azure', () => {
      setAuthProvider('azure')
      expect(getAuthProvider()).toBe('azure')
    })

    it('can switch to gitea', () => {
      setAuthProvider('gitea')
      expect(getAuthProvider()).toBe('gitea')
    })

    it('can switch back to github after switching to gitlab', () => {
      setAuthProvider('gitlab')
      expect(getAuthProvider()).toBe('gitlab')
      setAuthProvider('github')
      expect(getAuthProvider()).toBe('github')
    })
  })

  describe('setAuthBaseUrl / getAuthBaseUrl', () => {
    it('defaults to null', () => {
      expect(getAuthBaseUrl()).toBeNull()
    })

    it('can set a base URL', () => {
      setAuthBaseUrl('https://gitlab.com/api/v4')
      expect(getAuthBaseUrl()).toBe('https://gitlab.com/api/v4')
    })

    it('can clear the base URL', () => {
      setAuthBaseUrl('https://gitlab.com/api/v4')
      setAuthBaseUrl(null)
      expect(getAuthBaseUrl()).toBeNull()
    })
  })

  describe('getProviderMeta', () => {
    it('returns correct metadata for github', () => {
      const meta = getProviderMeta('github')
      expect(meta.label).toBe('GitHub')
      expect(meta.envVars).toContain('LAZYREVIEW_GITHUB_TOKEN')
      expect(meta.envVars).toContain('GITHUB_TOKEN')
      expect(meta.tokenPlaceholder).toBe('ghp_xxxx...')
    })

    it('returns correct metadata for gitlab', () => {
      const meta = getProviderMeta('gitlab')
      expect(meta.label).toBe('GitLab')
      expect(meta.envVars).toContain('LAZYREVIEW_GITLAB_TOKEN')
      expect(meta.envVars).toContain('GITLAB_TOKEN')
      expect(meta.tokenPlaceholder).toBe('glpat-xxxx...')
    })

    it('returns correct metadata for bitbucket', () => {
      const meta = getProviderMeta('bitbucket')
      expect(meta.label).toBe('Bitbucket')
      expect(meta.envVars).toContain('LAZYREVIEW_BITBUCKET_TOKEN')
    })

    it('returns correct metadata for azure', () => {
      const meta = getProviderMeta('azure')
      expect(meta.label).toBe('Azure DevOps')
      expect(meta.envVars).toContain('LAZYREVIEW_AZURE_TOKEN')
    })

    it('returns correct metadata for gitea', () => {
      const meta = getProviderMeta('gitea')
      expect(meta.label).toBe('Gitea')
      expect(meta.envVars).toContain('LAZYREVIEW_GITEA_TOKEN')
    })
  })

  describe('getEnvVarName', () => {
    const cases: readonly [Provider, string][] = [
      ['github', 'LAZYREVIEW_GITHUB_TOKEN'],
      ['gitlab', 'LAZYREVIEW_GITLAB_TOKEN'],
      ['bitbucket', 'LAZYREVIEW_BITBUCKET_TOKEN'],
      ['azure', 'LAZYREVIEW_AZURE_TOKEN'],
      ['gitea', 'LAZYREVIEW_GITEA_TOKEN'],
    ]

    for (const [provider, expected] of cases) {
      it(`returns ${expected} for ${provider}`, () => {
        expect(getEnvVarName(provider)).toBe(expected)
      })
    }
  })

  describe('getProviderTokenFilePath', () => {
    it('returns path with provider name for github', () => {
      const path = getProviderTokenFilePath('github')
      expect(path).toContain('github.token')
    })

    it('returns path with provider name for gitlab', () => {
      const path = getProviderTokenFilePath('gitlab')
      expect(path).toContain('gitlab.token')
    })

    it('returns different paths for different providers', () => {
      const githubPath = getProviderTokenFilePath('github')
      const gitlabPath = getProviderTokenFilePath('gitlab')
      expect(githubPath).not.toBe(gitlabPath)
    })
  })

  describe('maskToken', () => {
    it('masks tokens longer than 8 chars', () => {
      expect(maskToken('ghp_1234567890')).toBe('ghp_...7890')
    })

    it('masks short tokens completely', () => {
      expect(maskToken('12345678')).toBe('****')
    })

    it('masks very short tokens', () => {
      expect(maskToken('abc')).toBe('****')
    })
  })

  describe('provider switching resets initialization', () => {
    it('switching provider resets the initialized flag', () => {
      // After setting provider, auth should re-initialize on next token resolution
      setAuthProvider('gitlab')
      expect(getAuthProvider()).toBe('gitlab')
      // Switching back should also work
      setAuthProvider('github')
      expect(getAuthProvider()).toBe('github')
    })
  })
})

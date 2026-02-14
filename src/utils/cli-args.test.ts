import { describe, it, expect } from 'vitest'
import { parseCliArgs } from './cli-args'
import type { ParsedCliArgs, DirectPR } from './cli-args'

// Helper to create argv from user-provided args
function argv(...userArgs: string[]): readonly string[] {
  return ['node', 'lazyreview', ...userArgs]
}

// ===========================================================================
// Help and version flags
// ===========================================================================

describe('parseCliArgs', () => {
  describe('help flag', () => {
    it('returns help command for --help', () => {
      const result = parseCliArgs(argv('--help'))
      expect(result.command).toBe('help')
    })

    it('returns help command for -h', () => {
      const result = parseCliArgs(argv('-h'))
      expect(result.command).toBe('help')
    })

    it('prioritizes help over other flags', () => {
      const result = parseCliArgs(argv('--pr', '42', '--help'))
      expect(result.command).toBe('help')
    })
  })

  describe('version flag', () => {
    it('returns version command for --version', () => {
      const result = parseCliArgs(argv('--version'))
      expect(result.command).toBe('version')
    })

    it('returns version command for -v', () => {
      const result = parseCliArgs(argv('-v'))
      expect(result.command).toBe('version')
    })
  })

  // ===========================================================================
  // No arguments (default launch)
  // ===========================================================================

  describe('no arguments', () => {
    it('returns run command with no directPR', () => {
      const result = parseCliArgs(argv())
      expect(result).toEqual<ParsedCliArgs>({
        command: 'run',
        owner: null,
        repo: null,
        directPR: null,
        provider: null,
      })
    })
  })

  // ===========================================================================
  // --pr / -p flag (no repo specified)
  // ===========================================================================

  describe('--pr flag without repo', () => {
    it('parses --pr 42', () => {
      const result = parseCliArgs(argv('--pr', '42'))
      expect(result.command).toBe('run')
      expect(result.directPR).toEqual<DirectPR>({
        prNumber: 42,
        owner: null,
        repo: null,
        provider: null,
      })
    })

    it('parses -p 42', () => {
      const result = parseCliArgs(argv('-p', '42'))
      expect(result.command).toBe('run')
      expect(result.directPR).toEqual<DirectPR>({
        prNumber: 42,
        owner: null,
        repo: null,
        provider: null,
      })
    })

    it('returns null directPR for --pr without number', () => {
      const result = parseCliArgs(argv('--pr'))
      expect(result.directPR).toBeNull()
    })

    it('returns null directPR for --pr with non-numeric value', () => {
      const result = parseCliArgs(argv('--pr', 'abc'))
      expect(result.directPR).toBeNull()
    })

    it('returns null directPR for --pr with zero', () => {
      const result = parseCliArgs(argv('--pr', '0'))
      expect(result.directPR).toBeNull()
    })

    it('returns null directPR for --pr with negative number', () => {
      const result = parseCliArgs(argv('--pr', '-1'))
      expect(result.directPR).toBeNull()
    })

    it('returns null directPR for --pr with decimal', () => {
      const result = parseCliArgs(argv('--pr', '1.5'))
      expect(result.directPR).toBeNull()
    })
  })

  // ===========================================================================
  // owner/repo + --pr flag
  // ===========================================================================

  describe('owner/repo with --pr flag', () => {
    it('parses owner/repo --pr 42', () => {
      const result = parseCliArgs(argv('owner/repo', '--pr', '42'))
      expect(result).toEqual<ParsedCliArgs>({
        command: 'run',
        owner: 'owner',
        repo: 'repo',
        directPR: {
          prNumber: 42,
          owner: 'owner',
          repo: 'repo',
          provider: null,
        },
        provider: null,
      })
    })

    it('parses --pr 42 owner/repo (flag before positional)', () => {
      const result = parseCliArgs(argv('--pr', '42', 'owner/repo'))
      expect(result).toEqual<ParsedCliArgs>({
        command: 'run',
        owner: 'owner',
        repo: 'repo',
        directPR: {
          prNumber: 42,
          owner: 'owner',
          repo: 'repo',
          provider: null,
        },
        provider: null,
      })
    })

    it('parses owner/repo -p 7', () => {
      const result = parseCliArgs(argv('owner/repo', '-p', '7'))
      expect(result.directPR).toEqual<DirectPR>({
        prNumber: 7,
        owner: 'owner',
        repo: 'repo',
        provider: null,
      })
    })
  })

  // ===========================================================================
  // owner/repo without --pr flag
  // ===========================================================================

  describe('owner/repo without --pr flag', () => {
    it('parses owner/repo', () => {
      const result = parseCliArgs(argv('owner/repo'))
      expect(result).toEqual<ParsedCliArgs>({
        command: 'run',
        owner: 'owner',
        repo: 'repo',
        directPR: null,
        provider: null,
      })
    })

    it('rejects invalid owner characters', () => {
      const result = parseCliArgs(argv('inv@lid/repo'))
      expect(result.owner).toBeNull()
    })

    it('rejects invalid repo characters', () => {
      const result = parseCliArgs(argv('owner/inv@lid'))
      expect(result.owner).toBeNull()
    })
  })

  // ===========================================================================
  // Full PR URLs (all providers)
  // ===========================================================================

  describe('full PR URL as positional argument', () => {
    it('parses GitHub PR URL', () => {
      const result = parseCliArgs(
        argv('https://github.com/facebook/react/pull/42'),
      )
      expect(result).toEqual<ParsedCliArgs>({
        command: 'run',
        owner: 'facebook',
        repo: 'react',
        directPR: {
          prNumber: 42,
          owner: 'facebook',
          repo: 'react',
          provider: 'github',
        },
        provider: 'github',
      })
    })

    it('parses GitLab MR URL', () => {
      const result = parseCliArgs(
        argv('https://gitlab.com/org/project/-/merge_requests/99'),
      )
      expect(result).toEqual<ParsedCliArgs>({
        command: 'run',
        owner: 'org',
        repo: 'project',
        directPR: {
          prNumber: 99,
          owner: 'org',
          repo: 'project',
          provider: 'gitlab',
        },
        provider: 'gitlab',
      })
    })

    it('parses Bitbucket PR URL', () => {
      const result = parseCliArgs(
        argv('https://bitbucket.org/team/repo/pull-requests/5'),
      )
      expect(result).toEqual<ParsedCliArgs>({
        command: 'run',
        owner: 'team',
        repo: 'repo',
        directPR: {
          prNumber: 5,
          owner: 'team',
          repo: 'repo',
          provider: 'bitbucket',
        },
        provider: 'bitbucket',
      })
    })

    it('parses Azure DevOps PR URL', () => {
      const result = parseCliArgs(
        argv(
          'https://dev.azure.com/myorg/myproject/_git/myrepo/pullrequest/10',
        ),
      )
      expect(result).toEqual<ParsedCliArgs>({
        command: 'run',
        owner: 'myorg/myproject',
        repo: 'myrepo',
        directPR: {
          prNumber: 10,
          owner: 'myorg/myproject',
          repo: 'myrepo',
          provider: 'azure',
        },
        provider: 'azure',
      })
    })

    it('parses Gitea PR URL', () => {
      const result = parseCliArgs(
        argv('https://gitea.example.com/owner/repo/pulls/77'),
      )
      expect(result).toEqual<ParsedCliArgs>({
        command: 'run',
        owner: 'owner',
        repo: 'repo',
        directPR: {
          prNumber: 77,
          owner: 'owner',
          repo: 'repo',
          provider: 'gitea',
        },
        provider: 'gitea',
      })
    })

    it('ignores --pr flag when URL already contains PR number', () => {
      const result = parseCliArgs(
        argv('https://github.com/owner/repo/pull/42', '--pr', '99'),
      )
      // URL takes precedence
      expect(result.directPR?.prNumber).toBe(42)
    })
  })

  // ===========================================================================
  // Edge cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles unknown positional argument gracefully', () => {
      const result = parseCliArgs(argv('not-a-valid-arg'))
      expect(result).toEqual<ParsedCliArgs>({
        command: 'run',
        owner: null,
        repo: null,
        directPR: null,
        provider: null,
      })
    })

    it('handles repo URL without PR path (not a PR URL)', () => {
      const result = parseCliArgs(
        argv('https://github.com/owner/repo'),
      )
      // This is not a recognized PR URL and not a valid owner/repo positional
      expect(result.directPR).toBeNull()
    })

    it('parses large PR numbers', () => {
      const result = parseCliArgs(argv('--pr', '99999'))
      expect(result.directPR?.prNumber).toBe(99999)
    })

    it('handles multiple slashes in positional (ignored)', () => {
      const result = parseCliArgs(argv('a/b/c'))
      // Not a valid owner/repo (3 parts), not a URL
      expect(result.owner).toBeNull()
    })
  })
})

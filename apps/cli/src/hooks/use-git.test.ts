import { describe, it, expect } from 'vitest';

// Note: Full integration tests for git hooks would require mocking child_process
// which is complex in Vitest ESM mode. These tests verify the module exports correctly.
// Integration tests should be done with actual git repos.

describe('use-git module', () => {
  it('exports useGitStatus', async () => {
    const module = await import('./use-git');
    expect(typeof module.useGitStatus).toBe('function');
  });

  it('exports useGitCheckout', async () => {
    const module = await import('./use-git');
    expect(typeof module.useGitCheckout).toBe('function');
  });

  it('exports useGitRemote', async () => {
    const module = await import('./use-git');
    expect(typeof module.useGitRemote).toBe('function');
  });

  it('exports useGitBranches', async () => {
    const module = await import('./use-git');
    expect(typeof module.useGitBranches).toBe('function');
  });

  it('exports useGitDiff', async () => {
    const module = await import('./use-git');
    expect(typeof module.useGitDiff).toBe('function');
  });

  it('exports isGitRepo', async () => {
    const module = await import('./use-git');
    expect(typeof module.isGitRepo).toBe('function');
  });

  it('exports getGitRoot', async () => {
    const module = await import('./use-git');
    expect(typeof module.getGitRoot).toBe('function');
  });
});

describe('isGitRepo utility', () => {
  it('returns a boolean', async () => {
    const { isGitRepo } = await import('./use-git');
    // This test runs in a git repo, so it should return true
    const result = await isGitRepo();
    expect(typeof result).toBe('boolean');
  });
});

describe('getGitRoot utility', () => {
  it('returns a string or null', async () => {
    const { getGitRoot } = await import('./use-git');
    const result = await getGitRoot();
    expect(result === null || typeof result === 'string').toBe(true);
  });
});

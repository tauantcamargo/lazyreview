import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProvider } from './factory';

describe('createProvider factory', () => {
  it('should create a GitHub provider', () => {
    const provider = createProvider({
      type: 'github',
      token: 'test-token',
    });

    expect(provider.type).toBe('github');
    expect(provider.name).toBe('GitHub');
  });

  it('should create a GitLab provider', () => {
    const provider = createProvider({
      type: 'gitlab',
      token: 'test-token',
    });

    expect(provider.type).toBe('gitlab');
    expect(provider.name).toBe('GitLab');
  });

  it('should create a Bitbucket provider', () => {
    const provider = createProvider({
      type: 'bitbucket',
      token: 'test-token',
    });

    expect(provider.type).toBe('bitbucket');
    expect(provider.name).toBe('Bitbucket');
  });

  it('should create an Azure DevOps provider', () => {
    const provider = createProvider({
      type: 'azuredevops',
      token: 'test-token',
    });

    expect(provider.type).toBe('azuredevops');
    expect(provider.name).toBe('Azure DevOps');
  });

  it('should throw for unsupported provider type', () => {
    expect(() =>
      createProvider({
        type: 'unsupported' as any,
        token: 'test-token',
      })
    ).toThrow('Unsupported provider: unsupported');
  });

  it('should pass custom baseUrl to GitHub provider', () => {
    const provider = createProvider({
      type: 'github',
      token: 'test-token',
      baseUrl: 'https://github.enterprise.com/api/v3',
    });

    expect(provider.type).toBe('github');
  });

  it('should pass custom baseUrl to GitLab provider', () => {
    const provider = createProvider({
      type: 'gitlab',
      token: 'test-token',
      baseUrl: 'https://gitlab.example.com/api/v4',
    });

    expect(provider.type).toBe('gitlab');
  });
});

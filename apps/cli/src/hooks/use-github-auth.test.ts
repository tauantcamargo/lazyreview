/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGitHubAuth } from './use-github-auth';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useGitHubAuth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should enter demo mode when GITHUB_TOKEN is not set', async () => {
    delete process.env.GITHUB_TOKEN;

    const { result } = renderHook(() => useGitHubAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isDemoMode).toBe(true);
    expect(result.current.user).toBe(null);
    expect(result.current.error).toBe(null);
    expect(result.current.token).toBe(null);
  });

  it('should successfully authenticate with valid token', async () => {
    process.env.GITHUB_TOKEN = 'ghp_validtoken123';

    const mockUser = {
      login: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      avatar_url: 'https://github.com/avatar.png',
      bio: 'Test bio',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockUser,
    });

    const { result } = renderHook(() => useGitHubAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isDemoMode).toBe(false);
    expect(result.current.user).toEqual({
      login: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      avatarUrl: 'https://github.com/avatar.png',
      bio: 'Test bio',
    });
    expect(result.current.error).toBe(null);
    expect(result.current.token).toBe('ghp_validtoken123');

    expect(mockFetch).toHaveBeenCalledWith('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ghp_validtoken123',
        'User-Agent': 'lazyreview-ts',
      },
    });
  });

  it('should handle 401 unauthorized error', async () => {
    process.env.GITHUB_TOKEN = 'ghp_invalidtoken';

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Bad credentials',
    });

    const { result } = renderHook(() => useGitHubAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isDemoMode).toBe(true);
    expect(result.current.user).toBe(null);
    expect(result.current.error).toBe(
      'Invalid or expired GitHub token. Please check GITHUB_TOKEN environment variable.'
    );
  });

  it('should handle 403 forbidden error (insufficient permissions)', async () => {
    process.env.GITHUB_TOKEN = 'ghp_nopermissions';

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Insufficient permissions',
    });

    const { result } = renderHook(() => useGitHubAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isDemoMode).toBe(true);
    expect(result.current.error).toBe(
      'GitHub token lacks required permissions. Ensure it has "repo" and "read:org" scopes.'
    );
  });

  it('should handle network errors', async () => {
    process.env.GITHUB_TOKEN = 'ghp_validtoken';

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useGitHubAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isDemoMode).toBe(true);
    expect(result.current.user).toBe(null);
    expect(result.current.error).toBe('Network error');
  });

  it('should handle user with null optional fields', async () => {
    process.env.GITHUB_TOKEN = 'ghp_validtoken';

    const mockUser = {
      login: 'minimalistuser',
      name: null,
      email: null,
      avatar_url: '',
      bio: null,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockUser,
    });

    const { result } = renderHook(() => useGitHubAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual({
      login: 'minimalistuser',
      name: null,
      email: null,
      avatarUrl: '',
      bio: null,
    });
  });

  it('should handle other API errors', async () => {
    process.env.GITHUB_TOKEN = 'ghp_validtoken';

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const { result } = renderHook(() => useGitHubAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isDemoMode).toBe(true);
    expect(result.current.error).toBe('GitHub API error (500): Internal Server Error');
  });

  it('should allow manual token validation via validateToken', async () => {
    process.env.GITHUB_TOKEN = 'ghp_validtoken';

    const mockUser = {
      login: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      avatar_url: 'https://github.com/avatar.png',
      bio: null,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockUser,
    });

    const { result } = renderHook(() => useGitHubAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Clear mock calls from initial validation
    mockFetch.mockClear();

    // Manually trigger validation again
    await result.current.validateToken();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should set isLoading to true during validation', async () => {
    process.env.GITHUB_TOKEN = 'ghp_validtoken';

    let resolvePromise: ((value: unknown) => void) | null = null;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValueOnce(promise);

    const { result } = renderHook(() => useGitHubAuth());

    // Should start loading
    expect(result.current.isLoading).toBe(true);

    // Resolve the promise
    const mockUser = {
      login: 'testuser',
      name: null,
      email: null,
      avatar_url: '',
      bio: null,
    };

    resolvePromise?.({
      ok: true,
      status: 200,
      json: async () => mockUser,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
  });
});

import { useState, useEffect } from 'react';

export interface GitHubUser {
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string;
  bio: string | null;
}

export interface GitHubAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: GitHubUser | null;
  error: string | null;
  isDemoMode: boolean;
}

export interface UseGitHubAuthResult extends GitHubAuthState {
  token: string | null;
  validateToken: () => Promise<void>;
}

/**
 * Hook to handle GitHub authentication using GITHUB_TOKEN environment variable
 *
 * Reads GITHUB_TOKEN from process.env, validates it with GitHub API,
 * and stores authenticated user state. Falls back to demo mode if no token found.
 */
export function useGitHubAuth(): UseGitHubAuthResult {
  const [state, setState] = useState<GitHubAuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
    isDemoMode: false,
  });

  const token = process.env.GITHUB_TOKEN || null;

  const validateToken = async () => {
    if (!token) {
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
        isDemoMode: true,
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'lazyreview-ts',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to validate GitHub token';

        if (response.status === 401) {
          errorMessage = 'Invalid or expired GitHub token. Please check GITHUB_TOKEN environment variable.';
        } else if (response.status === 403) {
          errorMessage = 'GitHub token lacks required permissions. Ensure it has "repo" and "read:org" scopes.';
        } else {
          errorMessage = `GitHub API error (${response.status}): ${errorText}`;
        }

        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: errorMessage,
          isDemoMode: true,
        });
        return;
      }

      const userData = await response.json();

      console.log('userData', userData);

      const user: GitHubUser = {
        login: userData.login,
        name: userData.name || null,
        email: userData.email || null,
        avatarUrl: userData.avatar_url || '',
        bio: userData.bio || null,
      };

      setState({
        isAuthenticated: true,
        isLoading: false,
        user,
        error: null,
        isDemoMode: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error validating GitHub token';
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: errorMessage,
        isDemoMode: true,
      });
    }
  };

  useEffect(() => {
    validateToken();
  }, [token]);

  return {
    ...state,
    token,
    validateToken,
  };
}

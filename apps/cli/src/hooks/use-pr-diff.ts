import { useState, useEffect } from 'react';
import { createProvider, type ProviderType } from '@lazyreview/core';

export interface UsePRDiffOptions {
  providerType: ProviderType;
  token: string;
  baseUrl?: string;
  owner: string;
  repo: string;
  prNumber: number;
  enabled?: boolean;
}

export interface UsePRDiffResult {
  diff: string | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to fetch PR diff from provider
 */
export function usePRDiff(options: UsePRDiffOptions): UsePRDiffResult {
  const { providerType, token, baseUrl, owner, repo, prNumber, enabled = true } = options;
  const [diff, setDiff] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDiff = async () => {
    if (!enabled || !owner || !repo || !prNumber) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const provider = createProvider(providerType, { token, baseUrl });
      const diffContent = await provider.getPullRequestDiff(owner, repo, prNumber);
      setDiff(diffContent);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch PR diff'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchDiff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo, prNumber, enabled]);

  return {
    diff,
    isLoading,
    error,
    refetch: fetchDiff,
  };
}

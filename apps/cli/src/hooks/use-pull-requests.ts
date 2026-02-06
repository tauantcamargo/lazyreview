import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createProvider,
  readToken,
  buildProviderBaseUrl,
  defaultProviderHost,
  loadConfig,
  type ProviderType,
  type PullRequest,
} from '@lazyreview/core';
import type { PRFilter } from '../stores/app-store';

// Query keys factory for type safety and consistency
export const pullRequestKeys = {
  all: ['pull-requests'] as const,
  lists: () => [...pullRequestKeys.all, 'list'] as const,
  list: (owner: string, repo: string, provider: string, filters?: PRFilter) =>
    [...pullRequestKeys.lists(), owner, repo, provider, filters] as const,
  details: () => [...pullRequestKeys.all, 'detail'] as const,
  detail: (owner: string, repo: string, provider: string, number: number) =>
    [...pullRequestKeys.details(), owner, repo, provider, number] as const,
  diffs: () => [...pullRequestKeys.all, 'diff'] as const,
  diff: (owner: string, repo: string, provider: string, number: number) =>
    [...pullRequestKeys.diffs(), owner, repo, provider, number] as const,
};

interface UseListPullRequestsOptions {
  owner: string;
  repo: string;
  provider: ProviderType;
  filters?: PRFilter;
  enabled?: boolean;
}

async function getProviderClient(providerType: ProviderType) {
  const config = loadConfig();
  const providerConfig = config.providers?.find((p) => p.type === providerType);
  const host = providerConfig?.host ?? defaultProviderHost(providerType);
  const envToken = providerConfig?.tokenEnv ? process.env[providerConfig.tokenEnv] : undefined;
  let token: string | undefined = (await readToken(providerType, host)) ?? envToken ?? process.env.LAZYREVIEW_TOKEN ?? undefined;

  // Fallback to alternate hosts for common providers
  if (!token && providerType === 'github' && host === 'github.com') {
    token = (await readToken(providerType, 'api.github.com')) ?? undefined;
  }
  if (!token && providerType === 'bitbucket' && host === 'bitbucket.org') {
    token = (await readToken(providerType, 'api.bitbucket.org')) ?? undefined;
  }

  if (!token) {
    throw new Error(`Missing token for ${providerType}. Run: lazyreview auth login --provider ${providerType}`);
  }

  const baseUrl = providerConfig?.baseUrl ?? buildProviderBaseUrl(providerType, host);
  return createProvider({ type: providerType, token, baseUrl });
}

export function useListPullRequests({ owner, repo, provider, filters, enabled = true }: UseListPullRequestsOptions) {
  return useQuery({
    queryKey: pullRequestKeys.list(owner, repo, provider, filters),
    queryFn: async (): Promise<PullRequest[]> => {
      const client = await getProviderClient(provider);
      return client.listPullRequests(owner, repo, {
        limit: 50,
        state: filters?.state,
      });
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: enabled && !!owner && !!repo,
  });
}

interface UsePullRequestDiffOptions {
  owner: string;
  repo: string;
  provider: ProviderType;
  number: number;
  enabled?: boolean;
}

export function usePullRequestDiff({ owner, repo, provider, number, enabled = true }: UsePullRequestDiffOptions) {
  return useQuery({
    queryKey: pullRequestKeys.diff(owner, repo, provider, number),
    queryFn: async (): Promise<string> => {
      const client = await getProviderClient(provider);
      return client.getPullRequestDiff(owner, repo, number);
    },
    staleTime: 30 * 1000, // 30 seconds for detail view
    enabled: enabled && !!owner && !!repo && !!number,
  });
}

interface ApproveInput {
  owner: string;
  repo: string;
  provider: ProviderType;
  number: number;
  body?: string;
}

export function useApprovePR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ owner, repo, provider, number, body }: ApproveInput) => {
      const client = await getProviderClient(provider);
      await client.approveReview(owner, repo, number, body);
    },
    onSuccess: (_, { owner, repo, provider, number }) => {
      // Invalidate the PR list and detail
      queryClient.invalidateQueries({ queryKey: pullRequestKeys.list(owner, repo, provider) });
      queryClient.invalidateQueries({ queryKey: pullRequestKeys.detail(owner, repo, provider, number) });
    },
  });
}

interface RequestChangesInput {
  owner: string;
  repo: string;
  provider: ProviderType;
  number: number;
  body: string;
}

export function useRequestChanges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ owner, repo, provider, number, body }: RequestChangesInput) => {
      const client = await getProviderClient(provider);
      await client.requestChanges(owner, repo, number, body);
    },
    onSuccess: (_, { owner, repo, provider, number }) => {
      queryClient.invalidateQueries({ queryKey: pullRequestKeys.list(owner, repo, provider) });
      queryClient.invalidateQueries({ queryKey: pullRequestKeys.detail(owner, repo, provider, number) });
    },
  });
}

interface CommentInput {
  owner: string;
  repo: string;
  provider: ProviderType;
  number: number;
  body: string;
  path?: string;
  line?: number;
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ owner, repo, provider, number, body, path, line }: CommentInput) => {
      const client = await getProviderClient(provider);
      await client.createComment(owner, repo, number, { body, path, line });
    },
    onSuccess: (_, { owner, repo, provider, number }) => {
      queryClient.invalidateQueries({ queryKey: pullRequestKeys.detail(owner, repo, provider, number) });
    },
  });
}

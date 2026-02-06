import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createProvider,
  buildProviderBaseUrl,
  defaultProviderHost,
  readToken,
  loadConfig,
  type ProviderType,
  type PullRequest,
  type ReviewInput,
  type CommentInput,
} from '@lazyreview/core';
import { useAppStore } from '../stores/app-store';

// Query key factory for type safety
export const pullRequestKeys = {
  all: ['pull-requests'] as const,
  lists: () => [...pullRequestKeys.all, 'list'] as const,
  list: (provider: string, owner: string, repo: string, filters?: Record<string, unknown>) =>
    [...pullRequestKeys.lists(), provider, owner, repo, filters] as const,
  details: () => [...pullRequestKeys.all, 'detail'] as const,
  detail: (provider: string, owner: string, repo: string, number: number) =>
    [...pullRequestKeys.details(), provider, owner, repo, number] as const,
  diff: (provider: string, owner: string, repo: string, number: number) =>
    [...pullRequestKeys.detail(provider, owner, repo, number), 'diff'] as const,
};

async function getProviderClient(providerType: ProviderType, owner: string, repo: string) {
  const config = loadConfig();
  const providerConfig = config.providers?.find((p) => p.type === providerType);
  const host = providerConfig?.host ?? defaultProviderHost(providerType);
  const envToken = providerConfig?.tokenEnv ? process.env[providerConfig.tokenEnv] : undefined;
  let token = (await readToken(providerType, host)) ?? envToken ?? process.env.LAZYREVIEW_TOKEN;

  // Fallback for github.com to api.github.com
  if (!token && providerType === 'github' && host === 'github.com') {
    token = (await readToken(providerType, 'api.github.com')) ?? undefined;
  }

  if (!token) {
    throw new Error(`Missing token for ${providerType}. Run: lazyreview auth login --provider ${providerType}`);
  }

  const baseUrl = providerConfig?.baseUrl ?? buildProviderBaseUrl(providerType, host);
  return createProvider({ type: providerType, token, baseUrl });
}

// Hook: List pull requests
export function usePullRequests(provider: ProviderType, owner: string, repo: string, options?: { limit?: number }) {
  return useQuery({
    queryKey: pullRequestKeys.list(provider, owner, repo, options),
    queryFn: async () => {
      const client = await getProviderClient(provider, owner, repo);
      return client.listPullRequests(owner, repo, { limit: options?.limit ?? 50 });
    },
    enabled: Boolean(owner && repo),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Hook: Get PR diff
export function usePullRequestDiff(provider: ProviderType, owner: string, repo: string, number: number) {
  return useQuery({
    queryKey: pullRequestKeys.diff(provider, owner, repo, number),
    queryFn: async () => {
      const client = await getProviderClient(provider, owner, repo);
      return client.getPullRequestDiff(owner, repo, number);
    },
    enabled: Boolean(owner && repo && number),
    staleTime: 30 * 1000, // 30 seconds for diff
  });
}

// Hook: Approve PR
export function useApprovePR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      provider,
      owner,
      repo,
      number,
      body,
    }: {
      provider: ProviderType;
      owner: string;
      repo: string;
      number: number;
      body?: string;
    }) => {
      const client = await getProviderClient(provider, owner, repo);
      await client.approveReview(owner, repo, number, body);
    },
    onSuccess: (_, { provider, owner, repo, number }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: pullRequestKeys.detail(provider, owner, repo, number),
      });
      queryClient.invalidateQueries({
        queryKey: pullRequestKeys.list(provider, owner, repo),
      });
    },
  });
}

// Hook: Request changes
export function useRequestChanges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      provider,
      owner,
      repo,
      number,
      body,
    }: {
      provider: ProviderType;
      owner: string;
      repo: string;
      number: number;
      body?: string;
    }) => {
      const client = await getProviderClient(provider, owner, repo);
      await client.requestChanges(owner, repo, number, body);
    },
    onSuccess: (_, { provider, owner, repo, number }) => {
      queryClient.invalidateQueries({
        queryKey: pullRequestKeys.detail(provider, owner, repo, number),
      });
    },
  });
}

// Hook: Create comment
export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      provider,
      owner,
      repo,
      number,
      comment,
    }: {
      provider: ProviderType;
      owner: string;
      repo: string;
      number: number;
      comment: CommentInput;
    }) => {
      const client = await getProviderClient(provider, owner, repo);
      await client.createComment(owner, repo, number, comment);
    },
    onSuccess: (_, { provider, owner, repo, number }) => {
      queryClient.invalidateQueries({
        queryKey: pullRequestKeys.detail(provider, owner, repo, number),
      });
    },
  });
}

// Hook: Create review
export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      provider,
      owner,
      repo,
      number,
      review,
    }: {
      provider: ProviderType;
      owner: string;
      repo: string;
      number: number;
      review: ReviewInput;
    }) => {
      const client = await getProviderClient(provider, owner, repo);
      await client.createReview(owner, repo, number, review);
    },
    onSuccess: (_, { provider, owner, repo, number }) => {
      queryClient.invalidateQueries({
        queryKey: pullRequestKeys.detail(provider, owner, repo, number),
      });
      queryClient.invalidateQueries({
        queryKey: pullRequestKeys.list(provider, owner, repo),
      });
    },
  });
}

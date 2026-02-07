import { useQuery } from '@tanstack/react-query';
import {
  createProvider,
  readToken,
  buildProviderBaseUrl,
  defaultProviderHost,
  loadConfig,
  type ProviderType,
  type FileChange,
} from '@lazyreview/core';
import { pullRequestKeys } from './use-pull-requests';

interface UsePRFilesOptions {
  owner: string;
  repo: string;
  provider: ProviderType;
  number: number;
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

/**
 * Hook to fetch changed files for a pull request
 */
export function usePRFiles({ owner, repo, provider, number, enabled = true }: UsePRFilesOptions) {
  return useQuery({
    queryKey: [...pullRequestKeys.detail(owner, repo, provider, number), 'files'],
    queryFn: async (): Promise<FileChange[]> => {
      const client = await getProviderClient(provider);
      return client.getPullRequestFiles(owner, repo, number);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: enabled && !!owner && !!repo && !!number,
  });
}

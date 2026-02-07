import { buildProviderBaseUrl, createProvider, defaultProviderHost, loadConfig, readToken, type ProviderType } from '@lazyreview/core';

type PrListOptions = {
  provider?: string;
  repo: string;
  limit: number;
  json: boolean;
  state?: 'open' | 'closed' | 'all';
};

function parseRepo(input: string, provider: string): { owner: string; repo: string } {
  const parts = input.split('/');
  if (provider === 'azuredevops') {
    if (parts.length < 3) {
      throw new Error('Azure DevOps repo must be in org/project/repo format');
    }
    const org = parts[0] ?? '';
    const project = parts[1] ?? '';
    const repoName = parts[2] ?? '';
    return { owner: `${org}/${project}`, repo: repoName };
  }

  if (parts.length < 2) {
    throw new Error('Repository must be in owner/name format');
  }

  const owner = parts[0] ?? '';
  const repoName = parts[1] ?? '';
  return { owner, repo: repoName };
}

function resolveProviderHost(provider: ProviderType): string {
  return defaultProviderHost(provider);
}

export async function listPullRequests(options: PrListOptions): Promise<void> {
  const config = loadConfig();
  const fallbackProvider = config.defaultProvider || 'github';
  const provider = (options.provider || fallbackProvider).toLowerCase() as ProviderType;
  const providerConfig = config.providers?.find((p) => p.type === provider);
  const host = providerConfig?.host ?? resolveProviderHost(provider);
  const envToken = providerConfig?.tokenEnv ? process.env[providerConfig.tokenEnv] : undefined;
  let token: string | undefined = (await readToken(provider, host)) ?? envToken ?? process.env.LAZYREVIEW_TOKEN ?? undefined;
  if (!token && provider === 'github' && host === 'github.com') {
    token = (await readToken(provider, 'api.github.com')) ?? undefined;
  }
  if (!token && provider === 'bitbucket' && host === 'bitbucket.org') {
    token = (await readToken(provider, 'api.bitbucket.org')) ?? undefined;
  }
  if (!token) {
    throw new Error('Provider token is required (use lazyreview auth login or LAZYREVIEW_TOKEN)');
  }

  const { owner, repo } = parseRepo(options.repo, provider);
  const baseUrl = providerConfig?.baseUrl ?? buildProviderBaseUrl(provider as ProviderType, host);
  const client = createProvider({ type: provider as ProviderType, token, baseUrl });
  const state = options.state ?? (providerConfig?.defaultQuery?.state as 'open' | 'closed' | 'all' | undefined);
  const prs = await client.listPullRequests(owner, repo, { limit: options.limit, state });

  if (options.json) {
    console.log(JSON.stringify(prs, null, 2));
    return;
  }

  for (const pr of prs) {
    console.log(`#${pr.number} ${pr.title} (${pr.state}) ${pr.author.login} • ${pr.updatedAt}`);
  }
}

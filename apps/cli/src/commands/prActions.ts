import {
  buildProviderBaseUrl,
  createProvider,
  defaultProviderHost,
  loadConfig,
  readToken,
  type CommentInput,
  type ProviderType,
} from '@lazyreview/core';

type ProviderContext = {
  provider: ProviderType;
  host: string;
  baseUrl: string;
  token: string;
};

function parseRepo(input: string, provider: ProviderType): { owner: string; repo: string } {
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

async function resolveProviderContext(providerInput?: string): Promise<ProviderContext> {
  const config = loadConfig();
  const fallbackProvider = (config.defaultProvider || 'github') as ProviderType;
  const provider = (providerInput || fallbackProvider).toLowerCase() as ProviderType;
  const providerConfig = config.providers?.find((p) => p.type === provider);
  const host = providerConfig?.host ?? defaultProviderHost(provider);
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

  const baseUrl = providerConfig?.baseUrl ?? buildProviderBaseUrl(provider, host);
  return { provider, host, baseUrl, token };
}

export async function prApprove(options: { provider?: string; repo: string; number: number; body?: string }): Promise<void> {
  const context = await resolveProviderContext(options.provider);
  const client = createProvider({ type: context.provider, token: context.token, baseUrl: context.baseUrl });
  const { owner, repo } = parseRepo(options.repo, context.provider);
  await client.approveReview(owner, repo, options.number, options.body);
}

export async function prRequestChanges(options: { provider?: string; repo: string; number: number; body?: string }): Promise<void> {
  const context = await resolveProviderContext(options.provider);
  const client = createProvider({ type: context.provider, token: context.token, baseUrl: context.baseUrl });
  const { owner, repo } = parseRepo(options.repo, context.provider);
  await client.requestChanges(owner, repo, options.number, options.body);
}

export async function prComment(options: {
  provider?: string;
  repo: string;
  number: number;
  body: string;
  path?: string;
  line?: number;
  side?: 'LEFT' | 'RIGHT';
}): Promise<void> {
  const context = await resolveProviderContext(options.provider);
  const client = createProvider({ type: context.provider, token: context.token, baseUrl: context.baseUrl });
  const { owner, repo } = parseRepo(options.repo, context.provider);
  const comment: CommentInput = {
    body: options.body,
    path: options.path,
    line: options.line,
    side: options.side,
  };
  await client.createComment(owner, repo, options.number, comment);
}

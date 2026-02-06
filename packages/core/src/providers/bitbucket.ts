import { z } from 'zod';
import { PullRequestSchema, type CommentInput, type PullRequest } from '../models';
import type { ListPullRequestOptions } from './types';
import type { Provider } from './provider';

const BitbucketPullRequestSchema = z.object({
  id: z.number(),
  title: z.string(),
  state: z.enum(['OPEN', 'MERGED', 'DECLINED', 'SUPERSEDED']),
  updated_on: z.string(),
  author: z
    .object({
      display_name: z.string().optional(),
      nickname: z.string().optional(),
    })
    .nullable()
    .optional(),
});

const BitbucketListSchema = z.object({
  values: z.array(BitbucketPullRequestSchema),
});

type BitbucketPullRequest = z.infer<typeof BitbucketPullRequestSchema>;

type BitbucketConfig = {
  token: string;
  baseUrl?: string;
};

function buildHeaders(config: BitbucketConfig): Record<string, string> {
  const encoded = Buffer.from(config.token, 'utf8').toString('base64');
  return {
    Authorization: `Basic ${encoded}`,
  };
}

async function requestJson<T>(url: string, config: BitbucketConfig): Promise<T> {
  const response = await fetch(url, { headers: buildHeaders(config) });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Bitbucket API error ${response.status}: ${body}`);
  }
  return (await response.json()) as T;
}

async function requestText(url: string, config: BitbucketConfig): Promise<string> {
  const response = await fetch(url, { headers: buildHeaders(config) });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Bitbucket API error ${response.status}: ${body}`);
  }
  return await response.text();
}

async function requestJsonWithBody<T>(url: string, config: BitbucketConfig, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...buildHeaders(config),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bitbucket API error ${response.status}: ${text}`);
  }
  return (await response.json()) as T;
}

function mapPullRequest(owner: string, repo: string, pr: BitbucketPullRequest): PullRequest {
  const state = pr.state === 'OPEN' ? 'open' : pr.state === 'MERGED' ? 'merged' : 'closed';
  return PullRequestSchema.parse({
    id: String(pr.id),
    number: pr.id,
    title: pr.title,
    repo: `${owner}/${repo}`,
    author: pr.author?.display_name ?? pr.author?.nickname ?? 'unknown',
    updatedAt: pr.updated_on,
    state,
  });
}

export function createBitbucketProvider(config: BitbucketConfig): Provider {
  if (!config.token) {
    throw new Error('Bitbucket token is required');
  }

  const baseUrl = config.baseUrl ?? 'https://api.bitbucket.org/2.0';

  return {
    type: 'bitbucket',
    name: 'Bitbucket',
    async validateToken() {
      try {
        await requestJson(`${baseUrl}/user`, config);
        return true;
      } catch {
        return false;
      }
    },
    async listPullRequests(owner, repo, options) {
      const limit = Math.min(options?.limit ?? 20, 50);
      const state = options?.state === 'closed' ? 'MERGED' : options?.state === 'all' ? 'ALL' : 'OPEN';
      const url = new URL(`${baseUrl}/repositories/${owner}/${repo}/pullrequests`);
      url.searchParams.set('state', state);
      url.searchParams.set('pagelen', String(limit));

      const data = await requestJson<unknown>(url.toString(), config);
      const list = BitbucketListSchema.parse(data);
      return list.values.map((pr) => mapPullRequest(owner, repo, pr));
    },
    async getPullRequestDiff(owner, repo, number) {
      const url = `${baseUrl}/repositories/${owner}/${repo}/pullrequests/${number}/diff`;
      return await requestText(url, config);
    },
    async createComment(owner, repo, number, comment) {
      const payload: Record<string, unknown> = { content: { raw: comment.body } };
      if (comment.path && comment.line) {
        payload.inline = { path: comment.path, to: comment.line };
      }
      await requestJsonWithBody(`${baseUrl}/repositories/${owner}/${repo}/pullrequests/${number}/comments`, config, payload);
    },
    async approveReview(owner, repo, number) {
      await requestJsonWithBody(`${baseUrl}/repositories/${owner}/${repo}/pullrequests/${number}/approve`, config, {});
    },
    async requestChanges(owner, repo, number, body) {
      await requestJsonWithBody(`${baseUrl}/repositories/${owner}/${repo}/pullrequests/${number}/comments`, config, {
        content: { raw: body ? `REQUEST_CHANGES: ${body}` : 'REQUEST_CHANGES' },
      });
    },
    async createReview(owner, repo, number, review) {
      await requestJsonWithBody(`${baseUrl}/repositories/${owner}/${repo}/pullrequests/${number}/comments`, config, {
        content: { raw: review.body },
      });
    },
  };
}

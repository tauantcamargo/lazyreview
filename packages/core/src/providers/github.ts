import { z } from 'zod';
import { PullRequestSchema, type CommentInput, type PullRequest } from '../models';
import type { Provider } from './provider';

const GitHubPullRequestSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  state: z.enum(['open', 'closed']),
  merged_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  user: z
    .object({
      login: z.string(),
    })
    .nullable()
    .optional(),
  head: z.object({
    ref: z.string(),
  }),
  base: z.object({
    ref: z.string(),
  }),
});

type GitHubPullRequest = z.infer<typeof GitHubPullRequestSchema>;

type GitHubProviderConfig = {
  token: string;
  baseUrl?: string;
  userAgent?: string;
};

function buildHeaders(config: GitHubProviderConfig): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${config.token}`,
    'User-Agent': config.userAgent ?? 'lazyreview-ts',
  };
}

async function requestJson<T>(url: string, config: GitHubProviderConfig): Promise<T> {
  const response = await fetch(url, {
    headers: buildHeaders(config),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

async function requestJsonWithBody<T>(url: string, config: GitHubProviderConfig, body: unknown): Promise<T> {
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
    throw new Error(`GitHub API error ${response.status}: ${text}`);
  }
  return (await response.json()) as T;
}

async function requestText(url: string, config: GitHubProviderConfig, accept: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      ...buildHeaders(config),
      Accept: accept,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }
  return await response.text();
}

function mapPullRequest(owner: string, repo: string, pr: GitHubPullRequest): PullRequest {
  const state = pr.merged_at ? 'merged' : pr.state;
  return PullRequestSchema.parse({
    id: String(pr.id),
    number: pr.number,
    title: pr.title,
    author: { login: pr.user?.login ?? 'unknown', avatarUrl: '' },
    headRef: pr.head.ref,
    baseRef: pr.base.ref,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    state,
    repository: { owner, name: repo },
  });
}

export function createGitHubProvider(config: GitHubProviderConfig): Provider {
  if (!config.token) {
    throw new Error('GitHub token is required');
  }

  const baseUrl = config.baseUrl ?? 'https://api.github.com';

  return {
    type: 'github',
    name: 'GitHub',
    async validateToken() {
      try {
        await requestJson(`${baseUrl}/user`, config);
        return true;
      } catch {
        return false;
      }
    },
    async listPullRequests(owner, repo, options) {
      const state = options?.state ?? 'open';
      const limit = Math.min(options?.limit ?? 20, 100);
      const url = new URL(`${baseUrl}/repos/${owner}/${repo}/pulls`);
      url.searchParams.set('state', state);
      url.searchParams.set('per_page', String(limit));

      const data = await requestJson<unknown>(url.toString(), config);
      const list = z.array(GitHubPullRequestSchema).parse(data);
      return list.map((pr) => mapPullRequest(owner, repo, pr));
    },
    async getPullRequestDiff(owner, repo, number) {
      const url = `${baseUrl}/repos/${owner}/${repo}/pulls/${number}`;
      return await requestText(url, config, 'application/vnd.github.v3.diff');
    },
    async createComment(owner, repo, number, comment) {
      if (comment.path && comment.line) {
        const payload = {
          body: comment.body,
          path: comment.path,
          line: comment.line,
          side: comment.side ?? 'RIGHT',
          start_line: comment.startLine,
          commit_id: comment.commitId,
        };
        await requestJsonWithBody(`${baseUrl}/repos/${owner}/${repo}/pulls/${number}/comments`, config, payload);
        return;
      }
      await requestJsonWithBody(`${baseUrl}/repos/${owner}/${repo}/issues/${number}/comments`, config, {
        body: comment.body,
      });
    },
    async approveReview(owner, repo, number, body) {
      await requestJsonWithBody(`${baseUrl}/repos/${owner}/${repo}/pulls/${number}/reviews`, config, {
        event: 'APPROVE',
        body: body ?? '',
      });
    },
    async requestChanges(owner, repo, number, body) {
      await requestJsonWithBody(`${baseUrl}/repos/${owner}/${repo}/pulls/${number}/reviews`, config, {
        event: 'REQUEST_CHANGES',
        body: body ?? '',
      });
    },
    async createReview(owner, repo, number, review) {
      await requestJsonWithBody(`${baseUrl}/repos/${owner}/${repo}/pulls/${number}/reviews`, config, {
        event: review.event,
        body: review.body,
        comments: review.comments?.map((comment: CommentInput) => ({
          body: comment.body,
          path: comment.path,
          line: comment.line,
          side: comment.side ?? 'RIGHT',
          start_line: comment.startLine,
          commit_id: comment.commitId,
        })),
      });
    },
  };
}

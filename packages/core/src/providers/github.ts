import { z } from 'zod';
import { FileChangeSchema, PullRequestSchema, type CommentInput, type FileChange, type PullRequest } from '../models';
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

// GitHub Search API response for issues/PRs
const GitHubSearchIssueSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  state: z.enum(['open', 'closed']),
  created_at: z.string(),
  updated_at: z.string(),
  user: z
    .object({
      login: z.string(),
    })
    .nullable()
    .optional(),
  pull_request: z
    .object({
      url: z.string(),
      merged_at: z.string().nullable().optional(),
    })
    .optional(),
  repository_url: z.string(),
});

const GitHubSearchResponseSchema = z.object({
  total_count: z.number(),
  incomplete_results: z.boolean(),
  items: z.array(GitHubSearchIssueSchema),
});

// GitHub file schema from /repos/{owner}/{repo}/pulls/{number}/files
const GitHubFileSchema = z.object({
  sha: z.string(),
  filename: z.string(),
  status: z.enum(['added', 'removed', 'modified', 'renamed']),
  additions: z.number(),
  deletions: z.number(),
  changes: z.number(),
  blob_url: z.string().optional(),
  raw_url: z.string().optional(),
  contents_url: z.string().optional(),
  patch: z.string().optional(),
  previous_filename: z.string().optional(),
});

type GitHubPullRequest = z.infer<typeof GitHubPullRequestSchema>;
type GitHubSearchIssue = z.infer<typeof GitHubSearchIssueSchema>;
type GitHubSearchResponse = z.infer<typeof GitHubSearchResponseSchema>;
type GitHubFile = z.infer<typeof GitHubFileSchema>;

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

function extractRepoFromUrl(repoUrl: string): { owner: string; repo: string } {
  // GitHub API repository_url format: https://api.github.com/repos/owner/repo
  const match = repoUrl.match(/repos\/([^/]+)\/([^/]+)$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid repository URL format: ${repoUrl}`);
  }
  return { owner: match[1], repo: match[2] };
}

async function mapSearchIssueToPR(issue: GitHubSearchIssue, config: GitHubProviderConfig): Promise<PullRequest> {
  const { owner, repo } = extractRepoFromUrl(issue.repository_url);

  // For search results, we need to fetch the full PR details to get head/base refs
  const baseUrl = config.baseUrl ?? 'https://api.github.com';
  const prData = await requestJson<GitHubPullRequest>(
    `${baseUrl}/repos/${owner}/${repo}/pulls/${issue.number}`,
    config
  );

  return mapPullRequest(owner, repo, prData);
}

export function createGitHubProvider(config: GitHubProviderConfig): Provider {
  if (!config.token) {
    throw new Error('GitHub token is required');
  }

  const baseUrl = config.baseUrl ?? 'https://api.github.com';

  // Cache the current user to avoid repeated API calls
  let cachedUser: { login: string } | null = null;

  async function getCurrentUser(): Promise<{ login: string }> {
    if (cachedUser) {
      return cachedUser;
    }
    const user = await requestJson<{ login: string }>(`${baseUrl}/user`, config);
    cachedUser = user;
    return user;
  }

  return {
    type: 'github',
    name: 'GitHub',
    async validateToken() {
      try {
        await getCurrentUser();
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
    async getMyPRs(options) {
      const user = await getCurrentUser();
      const state = options?.state ?? 'open';
      const limit = Math.min(options?.limit ?? 20, 100);

      // Use GitHub Search API to find PRs by author
      const url = new URL(`${baseUrl}/search/issues`);
      url.searchParams.set('q', `is:pr author:${user.login} is:${state}`);
      url.searchParams.set('per_page', String(limit));
      url.searchParams.set('sort', 'updated');
      url.searchParams.set('order', 'desc');

      const data = await requestJson<unknown>(url.toString(), config);
      const searchResponse = GitHubSearchResponseSchema.parse(data);

      // Map search results to PullRequest objects
      const pullRequests = await Promise.all(
        searchResponse.items.map((issue) => mapSearchIssueToPR(issue, config))
      );

      return pullRequests;
    },
    async getReviewRequests(options) {
      const user = await getCurrentUser();
      const state = options?.state ?? 'open';
      const limit = Math.min(options?.limit ?? 20, 100);

      // Use GitHub Search API to find PRs where user is requested as reviewer
      // Note: This includes both direct user review requests and team review requests
      const url = new URL(`${baseUrl}/search/issues`);
      url.searchParams.set('q', `is:pr review-requested:${user.login} is:${state}`);
      url.searchParams.set('per_page', String(limit));
      url.searchParams.set('sort', 'created');
      url.searchParams.set('order', 'desc');

      const data = await requestJson<unknown>(url.toString(), config);
      const searchResponse = GitHubSearchResponseSchema.parse(data);

      // Map search results to PullRequest objects
      const pullRequests = await Promise.all(
        searchResponse.items.map((issue) => mapSearchIssueToPR(issue, config))
      );

      return pullRequests;
    },
    async getPullRequestDiff(owner, repo, number) {
      const url = `${baseUrl}/repos/${owner}/${repo}/pulls/${number}`;
      return await requestText(url, config, 'application/vnd.github.v3.diff');
    },
    async getPullRequestFiles(owner, repo, number) {
      const url = `${baseUrl}/repos/${owner}/${repo}/pulls/${number}/files`;
      const data = await requestJson<unknown>(url, config);
      const files = z.array(GitHubFileSchema).parse(data);

      // Map GitHub file format to our FileChange model
      return files.map((file): FileChange => ({
        path: file.filename,
        status: file.status === 'removed' ? 'deleted' : file.status,
        additions: file.additions,
        deletions: file.deletions,
      }));
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

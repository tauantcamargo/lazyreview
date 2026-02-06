import { z } from 'zod';
import { PullRequestSchema, type CommentInput, type PullRequest } from '../models';
import type { ListPullRequestOptions } from './types';
import type { Provider } from './provider';

const GitLabMergeRequestSchema = z.object({
  id: z.number(),
  iid: z.number(),
  title: z.string(),
  state: z.enum(['opened', 'closed', 'merged']),
  source_branch: z.string(),
  target_branch: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  author: z
    .object({
      username: z.string(),
    })
    .nullable()
    .optional(),
});

const GitLabListSchema = z.array(GitLabMergeRequestSchema);

const GitLabChangeSchema = z.object({
  old_path: z.string(),
  new_path: z.string(),
  diff: z.string(),
});

const GitLabChangesSchema = z.object({
  changes: z.array(GitLabChangeSchema),
});

type GitLabMergeRequest = z.infer<typeof GitLabMergeRequestSchema>;

type GitLabConfig = {
  token: string;
  baseUrl?: string;
};

function buildHeaders(config: GitLabConfig): Record<string, string> {
  return {
    'Private-Token': config.token,
  };
}

async function requestJson<T>(url: string, config: GitLabConfig): Promise<T> {
  const response = await fetch(url, { headers: buildHeaders(config) });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitLab API error ${response.status}: ${body}`);
  }
  return (await response.json()) as T;
}

async function requestJsonWithBody<T>(url: string, config: GitLabConfig, body: Record<string, unknown>): Promise<T> {
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
    throw new Error(`GitLab API error ${response.status}: ${text}`);
  }
  return (await response.json()) as T;
}

function mapMergeRequest(owner: string, repo: string, mr: GitLabMergeRequest): PullRequest {
  return PullRequestSchema.parse({
    id: String(mr.id),
    number: mr.iid,
    title: mr.title,
    repo: `${owner}/${repo}`,
    author: mr.author?.username ?? 'unknown',
    sourceBranch: mr.source_branch,
    targetBranch: mr.target_branch,
    createdAt: mr.created_at,
    updatedAt: mr.updated_at,
    state: mr.state === 'opened' ? 'open' : mr.state,
  });
}

function buildUnifiedDiff(changes: z.infer<typeof GitLabChangeSchema>[]): string {
  return changes
    .map((change) => {
      const header = `diff --git a/${change.old_path} b/${change.new_path}\n--- a/${change.old_path}\n+++ b/${change.new_path}`;
      return `${header}\n${change.diff}`;
    })
    .join('\n');
}

export function createGitLabProvider(config: GitLabConfig): Provider {
  if (!config.token) {
    throw new Error('GitLab token is required');
  }

  const baseUrl = config.baseUrl ?? 'https://gitlab.com/api/v4';

  return {
    type: 'gitlab',
    name: 'GitLab',
    async validateToken() {
      try {
        await requestJson(`${baseUrl}/user`, config);
        return true;
      } catch {
        return false;
      }
    },
    async listPullRequests(owner, repo, options) {
      const state = options?.state === 'closed' ? 'closed' : options?.state === 'all' ? 'all' : 'opened';
      const limit = Math.min(options?.limit ?? 20, 100);
      const project = encodeURIComponent(`${owner}/${repo}`);
      const url = new URL(`${baseUrl}/projects/${project}/merge_requests`);
      url.searchParams.set('state', state);
      url.searchParams.set('per_page', String(limit));

      const data = await requestJson<unknown>(url.toString(), config);
      const list = GitLabListSchema.parse(data);
      return list.map((mr) => mapMergeRequest(owner, repo, mr));
    },
    async getPullRequestDiff(owner, repo, number) {
      const project = encodeURIComponent(`${owner}/${repo}`);
      const url = `${baseUrl}/projects/${project}/merge_requests/${number}/changes`;
      const data = await requestJson<unknown>(url, config);
      const parsed = GitLabChangesSchema.parse(data);
      return buildUnifiedDiff(parsed.changes);
    },
    async createComment(owner, repo, number, comment) {
      if (comment.path && comment.line) {
        throw new Error('GitLab inline comments are not implemented yet');
      }
      const project = encodeURIComponent(`${owner}/${repo}`);
      await requestJsonWithBody(`${baseUrl}/projects/${project}/merge_requests/${number}/notes`, config, {
        body: comment.body,
      });
    },
    async approveReview(owner, repo, number) {
      const project = encodeURIComponent(`${owner}/${repo}`);
      await requestJsonWithBody(`${baseUrl}/projects/${project}/merge_requests/${number}/approve`, config, {});
    },
    async requestChanges(owner, repo, number, body) {
      const project = encodeURIComponent(`${owner}/${repo}`);
      await requestJsonWithBody(`${baseUrl}/projects/${project}/merge_requests/${number}/notes`, config, {
        body: body ? `REQUEST_CHANGES: ${body}` : 'REQUEST_CHANGES',
      });
    },
    async createReview(owner, repo, number, review) {
      const project = encodeURIComponent(`${owner}/${repo}`);
      await requestJsonWithBody(`${baseUrl}/projects/${project}/merge_requests/${number}/notes`, config, {
        body: review.body,
      });
    },
  };
}

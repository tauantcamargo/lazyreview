import { z } from 'zod';
import { PullRequestSchema, type CommentInput, type PullRequest, type ReviewInput } from '../models';
import type { ListPullRequestOptions } from './types';
import type { Provider } from './provider';

const AzurePullRequestSchema = z.object({
  pullRequestId: z.number(),
  title: z.string(),
  status: z.enum(['active', 'completed', 'abandoned']),
  createdBy: z
    .object({
      displayName: z.string().optional(),
    })
    .nullable()
    .optional(),
  creationDate: z.string(),
  sourceRefName: z.string(),
  targetRefName: z.string(),
  codeReviewId: z.number().optional(),
});

const AzureListSchema = z.object({
  value: z.array(AzurePullRequestSchema),
});

type AzurePullRequest = z.infer<typeof AzurePullRequestSchema>;

type AzureConfig = {
  token: string;
  baseUrl?: string;
};

const apiVersion = '7.1';

const AzureIterationSchema = z.object({ id: z.number() });

const AzureIterationsSchema = z.object({
  value: z.array(AzureIterationSchema),
});

const AzureChangeEntrySchema = z.object({
  changeId: z.number(),
  changeType: z.string(),
  item: z.object({
    path: z.string(),
  }),
  originalPath: z.string().optional().nullable(),
});

const AzureChangesSchema = z.object({
  changeEntries: z.array(AzureChangeEntrySchema),
});

const AzureProfileSchema = z.object({
  id: z.string(),
});

function buildHeaders(config: AzureConfig): Record<string, string> {
  const encoded = Buffer.from(`:${config.token}`, 'utf8').toString('base64');
  return {
    Authorization: `Basic ${encoded}`,
  };
}

function buildApiUrl(baseUrl: string, org: string, project: string, path: string, params?: Record<string, string>): string {
  const url = new URL(`${baseUrl}/${org}/${project}/_apis/${path}`);
  url.searchParams.set('api-version', apiVersion);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function buildProfileUrl(): string {
  const url = new URL('https://app.vssps.visualstudio.com/_apis/profile/profiles/me');
  url.searchParams.set('api-version', apiVersion);
  return url.toString();
}

async function requestJson<T>(url: string, config: AzureConfig): Promise<T> {
  const response = await fetch(url, { headers: buildHeaders(config) });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Azure DevOps API error ${response.status}: ${body}`);
  }
  return (await response.json()) as T;
}

async function requestJsonWithBody<T>(
  url: string,
  config: AzureConfig,
  body: Record<string, unknown>,
  method: 'POST' | 'PATCH' = 'POST'
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      ...buildHeaders(config),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Azure DevOps API error ${response.status}: ${text}`);
  }
  return (await response.json()) as T;
}

function stripRefPrefix(ref: string): string {
  return ref.replace(/^refs\/heads\//, '');
}

function mapPullRequest(owner: string, repo: string, pr: AzurePullRequest): PullRequest {
  const state = pr.status === 'active' ? 'open' : pr.status === 'completed' ? 'merged' : 'closed';
  return PullRequestSchema.parse({
    id: String(pr.pullRequestId),
    number: pr.pullRequestId,
    title: pr.title,
    repo: `${owner}/${repo}`,
    author: pr.createdBy?.displayName ?? 'unknown',
    sourceBranch: stripRefPrefix(pr.sourceRefName),
    targetBranch: stripRefPrefix(pr.targetRefName),
    createdAt: pr.creationDate,
    updatedAt: pr.creationDate,
    state,
  });
}

async function getCurrentUserId(config: AzureConfig): Promise<string> {
  const profileUrl = buildProfileUrl();
  const data = await requestJson<unknown>(profileUrl, config);
  const profile = AzureProfileSchema.parse(data);
  return profile.id;
}

function buildDiffFromChanges(changes: z.infer<typeof AzureChangeEntrySchema>[]): string {
  if (changes.length === 0) {
    return '';
  }

  return changes
    .map((change) => {
      const oldPath = change.originalPath ?? change.item.path;
      const newPath = change.item.path;
      return [
        `diff --git a/${oldPath} b/${newPath}`,
        `--- a/${oldPath}`,
        `+++ b/${newPath}`,
        `@@`,
        `+ Azure DevOps diff content not available via changes API`,
      ].join('\n');
    })
    .join('\n');
}

export function createAzureDevOpsProvider(config: AzureConfig): Provider {
  if (!config.token) {
    throw new Error('Azure DevOps token is required');
  }

  const baseUrl = config.baseUrl ?? 'https://dev.azure.com';

  async function createCommentInternal(owner: string, repo: string, number: number, comment: CommentInput): Promise<void> {
    const [org, project] = owner.split('/');
    if (!org || !project) {
      throw new Error('Azure DevOps requires owner to be org/project');
    }
    const url = buildApiUrl(baseUrl, org, project, `git/repositories/${repo}/pullRequests/${number}/threads`);
    const payload: Record<string, unknown> = {
      comments: [{ content: comment.body, commentType: 1 }],
      status: 1,
    };
    if (comment.path && comment.line) {
      payload.threadContext = {
        filePath: comment.path,
        rightFileStart: { line: comment.line, offset: 1 },
        rightFileEnd: { line: comment.line, offset: 1 },
      };
    }
    await requestJsonWithBody(url, config, payload);
  }

  async function approveReviewInternal(owner: string, repo: string, number: number, body?: string): Promise<void> {
    const [org, project] = owner.split('/');
    if (!org || !project) {
      throw new Error('Azure DevOps requires owner to be org/project');
    }
    const userId = await getCurrentUserId(config);
    const url = buildApiUrl(baseUrl, org, project, `git/repositories/${repo}/pullrequests/${number}/reviewers/${userId}`);
    await requestJsonWithBody(url, config, { vote: 10 }, 'PATCH');
    if (body) {
      await createCommentInternal(owner, repo, number, { body });
    }
  }

  async function requestChangesInternal(owner: string, repo: string, number: number, body?: string): Promise<void> {
    const [org, project] = owner.split('/');
    if (!org || !project) {
      throw new Error('Azure DevOps requires owner to be org/project');
    }
    const userId = await getCurrentUserId(config);
    const url = buildApiUrl(baseUrl, org, project, `git/repositories/${repo}/pullrequests/${number}/reviewers/${userId}`);
    await requestJsonWithBody(url, config, { vote: -10 }, 'PATCH');
    await createCommentInternal(owner, repo, number, { body: body ?? 'Changes requested' });
  }

  async function createReviewInternal(owner: string, repo: string, number: number, review: ReviewInput): Promise<void> {
    if (review.event === 'APPROVE') {
      await approveReviewInternal(owner, repo, number, review.body);
      return;
    }
    if (review.event === 'REQUEST_CHANGES') {
      await requestChangesInternal(owner, repo, number, review.body);
      return;
    }
    if (review.body) {
      await createCommentInternal(owner, repo, number, { body: review.body });
    }
    if (review.comments) {
      for (const comment of review.comments) {
        await createCommentInternal(owner, repo, number, comment);
      }
    }
  }

  return {
    type: 'azuredevops',
    name: 'Azure DevOps',
    async validateToken() {
      try {
        await requestJson(`${baseUrl}/_apis/projects?api-version=${apiVersion}`, config);
        return true;
      } catch {
        return false;
      }
    },
    async listPullRequests(owner, repo, options) {
      const [org, project] = owner.split('/');
      if (!org || !project) {
        throw new Error('Azure DevOps requires owner to be org/project');
      }
      const status = options?.state === 'closed' ? 'abandoned' : options?.state === 'all' ? 'all' : 'active';
      const url = new URL(buildApiUrl(baseUrl, org, project, `git/repositories/${repo}/pullrequests`));
      url.searchParams.set('searchCriteria.status', status);

      const data = await requestJson<unknown>(url.toString(), config);
      const list = AzureListSchema.parse(data);
      return list.value.map((pr) => mapPullRequest(owner, repo, pr));
    },
    async getPullRequestDiff(owner, repo, number) {
      const [org, project] = owner.split('/');
      if (!org || !project) {
        throw new Error('Azure DevOps requires owner to be org/project');
      }

      const iterationsUrl = buildApiUrl(
        baseUrl,
        org,
        project,
        `git/repositories/${repo}/pullrequests/${number}/iterations`
      );
      const iterations = AzureIterationsSchema.parse(await requestJson<unknown>(iterationsUrl, config));
      const latest = iterations.value[iterations.value.length - 1];
      if (!latest) {
        return '';
      }

      const changesUrl = buildApiUrl(
        baseUrl,
        org,
        project,
        `git/repositories/${repo}/pullrequests/${number}/iterations/${latest.id}/changes`
      );
      const changes = AzureChangesSchema.parse(await requestJson<unknown>(changesUrl, config));
      return buildDiffFromChanges(changes.changeEntries);
    },
    async createComment(owner, repo, number, comment) {
      await createCommentInternal(owner, repo, number, comment);
    },
    async approveReview(owner, repo, number, body) {
      await approveReviewInternal(owner, repo, number, body);
    },
    async requestChanges(owner, repo, number, body) {
      await requestChangesInternal(owner, repo, number, body);
    },
    async createReview(owner, repo, number, review) {
      await createReviewInternal(owner, repo, number, review);
    },
  };
}

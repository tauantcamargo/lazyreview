import type { CommentInput, FileChange, PullRequest, ReviewInput } from '../models';
import type { ListPullRequestOptions, ProviderType } from './types';

export type Provider = {
  type: ProviderType;
  name: string;
  listPullRequests: (owner: string, repo: string, options?: ListPullRequestOptions) => Promise<PullRequest[]>;
  getMyPRs: (options?: ListPullRequestOptions) => Promise<PullRequest[]>;
  getReviewRequests: (options?: ListPullRequestOptions) => Promise<PullRequest[]>;
  getPullRequestDiff: (owner: string, repo: string, number: number) => Promise<string>;
  getPullRequestFiles: (owner: string, repo: string, number: number) => Promise<FileChange[]>;
  createComment: (owner: string, repo: string, number: number, comment: CommentInput) => Promise<void>;
  approveReview: (owner: string, repo: string, number: number, body?: string) => Promise<void>;
  requestChanges: (owner: string, repo: string, number: number, body?: string) => Promise<void>;
  createReview: (owner: string, repo: string, number: number, review: ReviewInput) => Promise<void>;
  validateToken: () => Promise<boolean>;
};

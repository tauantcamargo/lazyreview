import { z } from 'zod';

export const PullRequestSchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  repo: z.string(),
  author: z.string(),
  updatedAt: z.string(),
  state: z.enum(['open', 'closed', 'merged']),
});

export type PullRequest = z.infer<typeof PullRequestSchema>;

export type DiffSide = 'LEFT' | 'RIGHT';

export type CommentInput = {
  body: string;
  path?: string;
  line?: number;
  side?: DiffSide;
  startLine?: number;
  commitId?: string;
  inReplyTo?: string;
};

export type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

export type ReviewInput = {
  event: ReviewEvent;
  body: string;
  comments?: CommentInput[];
};

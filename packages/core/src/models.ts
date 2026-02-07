import { z } from 'zod';

// ============================================================================
// User Models
// ============================================================================

export const UserSchema = z.object({
  id: z.string(),
  login: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  avatarUrl: z.string().optional(),
});

export type User = z.infer<typeof UserSchema>;

// ============================================================================
// Label Models
// ============================================================================

export const LabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  description: z.string().optional(),
});

export type Label = z.infer<typeof LabelSchema>;

// ============================================================================
// Pull Request Models
// ============================================================================

export const PullRequestStateSchema = z.enum(['open', 'closed', 'merged', 'draft']);
export type PullRequestState = z.infer<typeof PullRequestStateSchema>;

// Simplified author reference for PR listing
export const AuthorRefSchema = z.object({
  login: z.string(),
  avatarUrl: z.string().optional(),
});

export type AuthorRef = z.infer<typeof AuthorRefSchema>;

// File change in a PR
export const FileChangeSchema = z.object({
  path: z.string(),
  status: z.enum(['added', 'modified', 'deleted', 'renamed']),
  additions: z.number().default(0),
  deletions: z.number().default(0),
});

export type FileChange = z.infer<typeof FileChangeSchema>;

// Simple comment for PR listing
export const PRCommentSchema = z.object({
  id: z.number(),
  author: AuthorRefSchema,
  body: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  isResolved: z.boolean().optional(),
});

export type PRComment = z.infer<typeof PRCommentSchema>;

// Simple review for PR listing
export const PRReviewSchema = z.object({
  id: z.number(),
  author: AuthorRefSchema,
  state: z.string(),
  body: z.string().optional(),
  submittedAt: z.union([z.string(), z.date()]),
});

export type PRReview = z.infer<typeof PRReviewSchema>;

// Repository reference
export const RepositoryRefSchema = z.object({
  owner: z.string(),
  name: z.string(),
});

export type RepositoryRef = z.infer<typeof RepositoryRefSchema>;

// Review decision enum
export const ReviewDecisionSchema = z.enum([
  'APPROVED',
  'CHANGES_REQUESTED',
  'REVIEW_REQUIRED',
]).optional();

export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export const PullRequestSchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  body: z.string().optional(),
  state: z.enum(['open', 'closed', 'merged']),
  isDraft: z.boolean().default(false),
  author: AuthorRefSchema,
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  baseRef: z.string(),
  headRef: z.string(),
  url: z.string().optional(),
  labels: z.array(z.object({
    name: z.string(),
    color: z.string().optional(),
  })).default([]),
  reviewDecision: ReviewDecisionSchema,
  repository: RepositoryRefSchema.optional(),
  files: z.array(FileChangeSchema).optional(),
  comments: z.array(PRCommentSchema).optional(),
  reviews: z.array(PRReviewSchema).optional(),
  timeline: z.array(z.object({
    id: z.number(),
    type: z.string(),
    actor: AuthorRefSchema,
    createdAt: z.union([z.string(), z.date()]),
    message: z.string().optional(),
  })).optional(),
});

export type PullRequest = z.infer<typeof PullRequestSchema>;

// ============================================================================
// Review Models
// ============================================================================

export const ReviewStateSchema = z.enum([
  'APPROVED',
  'CHANGES_REQUESTED',
  'COMMENTED',
  'PENDING',
  'DISMISSED',
]);
export type ReviewState = z.infer<typeof ReviewStateSchema>;

export const ReviewEventSchema = z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']);
export type ReviewEvent = z.infer<typeof ReviewEventSchema>;

export const ReviewSchema = z.object({
  id: z.string(),
  author: UserSchema,
  state: ReviewStateSchema,
  body: z.string().optional(),
  submittedAt: z.string().optional(),
  commitId: z.string().optional(),
});

export type Review = z.infer<typeof ReviewSchema>;

export const ReviewInputSchema = z.object({
  event: ReviewEventSchema,
  body: z.string(),
  comments: z.array(z.lazy(() => CommentInputSchema)).optional(),
});

export type ReviewInput = z.infer<typeof ReviewInputSchema>;

// ============================================================================
// Comment Models
// ============================================================================

export const DiffSideSchema = z.enum(['LEFT', 'RIGHT']);
export type DiffSide = z.infer<typeof DiffSideSchema>;

export const CommentTypeSchema = z.enum(['general', 'inline', 'review']);
export type CommentType = z.infer<typeof CommentTypeSchema>;

export const CommentSchema = z.object({
  id: z.string(),
  type: CommentTypeSchema,
  author: UserSchema,
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  path: z.string().optional(),
  line: z.number().optional(),
  startLine: z.number().optional(),
  side: DiffSideSchema.optional(),
  commitId: z.string().optional(),
  inReplyTo: z.string().optional(),
  resolved: z.boolean().default(false),
  replies: z.array(z.lazy((): z.ZodType => CommentSchema)).default([]),
});

export type Comment = z.infer<typeof CommentSchema>;

export const CommentInputSchema = z.object({
  body: z.string(),
  path: z.string().optional(),
  line: z.number().optional(),
  side: DiffSideSchema.optional(),
  startLine: z.number().optional(),
  commitId: z.string().optional(),
  inReplyTo: z.string().optional(),
});

export type CommentInput = z.infer<typeof CommentInputSchema>;

// ============================================================================
// Diff Models
// ============================================================================

export const DiffLineTypeSchema = z.enum(['add', 'delete', 'context', 'hunk']);
export type DiffLineType = z.infer<typeof DiffLineTypeSchema>;

export const DiffLineSchema = z.object({
  type: DiffLineTypeSchema,
  content: z.string(),
  oldLineNumber: z.number().optional(),
  newLineNumber: z.number().optional(),
});

export type DiffLine = z.infer<typeof DiffLineSchema>;

export const DiffHunkSchema = z.object({
  header: z.string(),
  oldStart: z.number(),
  oldCount: z.number(),
  newStart: z.number(),
  newCount: z.number(),
  lines: z.array(DiffLineSchema),
});

export type DiffHunk = z.infer<typeof DiffHunkSchema>;

export const FileStatusSchema = z.enum(['added', 'modified', 'deleted', 'renamed', 'copied']);
export type FileStatus = z.infer<typeof FileStatusSchema>;

export const FileDiffSchema = z.object({
  path: z.string(),
  oldPath: z.string().optional(),
  status: FileStatusSchema,
  additions: z.number().default(0),
  deletions: z.number().default(0),
  binary: z.boolean().default(false),
  hunks: z.array(DiffHunkSchema).default([]),
});

export type FileDiff = z.infer<typeof FileDiffSchema>;

export const DiffSchema = z.object({
  files: z.array(FileDiffSchema),
  totalAdditions: z.number().default(0),
  totalDeletions: z.number().default(0),
  totalChangedFiles: z.number().default(0),
});

export type Diff = z.infer<typeof DiffSchema>;

// ============================================================================
// Workspace Models
// ============================================================================

export const RepositorySchema = z.object({
  id: z.string(),
  name: z.string(),
  fullName: z.string(),
  owner: z.string(),
  provider: z.enum(['github', 'gitlab', 'bitbucket', 'azuredevops']),
  host: z.string(),
  url: z.string().optional(),
  defaultBranch: z.string().default('main'),
  private: z.boolean().default(false),
});

export type Repository = z.infer<typeof RepositorySchema>;

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  repos: z.array(RepositorySchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

// ============================================================================
// Check/Status Models
// ============================================================================

export const CheckStatusSchema = z.enum(['pending', 'success', 'failure', 'neutral', 'skipped']);
export type CheckStatus = z.infer<typeof CheckStatusSchema>;

export const CheckRunSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: CheckStatusSchema,
  conclusion: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  url: z.string().optional(),
});

export type CheckRun = z.infer<typeof CheckRunSchema>;

// ============================================================================
// Timeline Models
// ============================================================================

export const TimelineEventTypeSchema = z.enum([
  'opened',
  'closed',
  'reopened',
  'merged',
  'reviewed',
  'commented',
  'committed',
  'labeled',
  'unlabeled',
  'assigned',
  'unassigned',
  'referenced',
  'head_ref_force_pushed',
]);
export type TimelineEventType = z.infer<typeof TimelineEventTypeSchema>;

export const TimelineEventSchema = z.object({
  id: z.string(),
  type: TimelineEventTypeSchema,
  actor: UserSchema.optional(),
  createdAt: z.string(),
  body: z.string().optional(),
  commitId: z.string().optional(),
  label: LabelSchema.optional(),
});

export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

// ============================================================================
// List Options
// ============================================================================

export const ListPullRequestsOptionsSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  page: z.number().min(1).default(1),
  state: z.enum(['open', 'closed', 'all']).default('open'),
  sort: z.enum(['created', 'updated', 'popularity']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  author: z.string().optional(),
  assignee: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

export type ListPullRequestsOptions = z.infer<typeof ListPullRequestsOptionsSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

export function validatePullRequest(data: unknown): PullRequest {
  return PullRequestSchema.parse(data);
}

export function validateReview(data: unknown): Review {
  return ReviewSchema.parse(data);
}

export function validateComment(data: unknown): Comment {
  return CommentSchema.parse(data);
}

export function validateDiff(data: unknown): Diff {
  return DiffSchema.parse(data);
}

export function validateUser(data: unknown): User {
  return UserSchema.parse(data);
}

export function validateWorkspace(data: unknown): Workspace {
  return WorkspaceSchema.parse(data);
}

// Safe validation (returns null on error)
export function safeParsePullRequest(data: unknown): PullRequest | null {
  const result = PullRequestSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function safeParseReview(data: unknown): Review | null {
  const result = ReviewSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function safeParseComment(data: unknown): Comment | null {
  const result = CommentSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function safeParseDiff(data: unknown): Diff | null {
  const result = DiffSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function safeParseUser(data: unknown): User | null {
  const result = UserSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function safeParseWorkspace(data: unknown): Workspace | null {
  const result = WorkspaceSchema.safeParse(data);
  return result.success ? result.data : null;
}

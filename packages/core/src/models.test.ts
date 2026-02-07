import { describe, it, expect } from 'vitest';
import {
  PullRequestSchema,
  ReviewSchema,
  CommentSchema,
  DiffSchema,
  UserSchema,
  WorkspaceSchema,
  validatePullRequest,
  validateReview,
  validateComment,
  validateDiff,
  validateUser,
  validateWorkspace,
  safeParsePullRequest,
  safeParseReview,
  safeParseComment,
  safeParseDiff,
  safeParseUser,
  safeParseWorkspace,
} from './models';

describe('UserSchema', () => {
  it('should validate a valid user', () => {
    const user = {
      id: '123',
      login: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      avatarUrl: 'https://example.com/avatar.png',
    };
    expect(UserSchema.parse(user)).toEqual(user);
  });

  it('should validate a minimal user', () => {
    const user = { id: '123', login: 'testuser' };
    expect(UserSchema.parse(user)).toEqual(user);
  });

  it('should reject user without required fields', () => {
    expect(() => UserSchema.parse({ id: '123' })).toThrow();
    expect(() => UserSchema.parse({ login: 'test' })).toThrow();
  });
});

describe('PullRequestSchema', () => {
  const validPR = {
    id: 'pr-1',
    number: 42,
    title: 'Fix bug',
    state: 'open' as const,
    author: { login: 'testuser', avatarUrl: '' },
    headRef: 'feature/fix',
    baseRef: 'main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    repository: { owner: 'owner', name: 'repo' },
  };

  it('should validate a valid pull request', () => {
    const result = PullRequestSchema.parse(validPR);
    expect(result.id).toBe('pr-1');
    expect(result.number).toBe(42);
    expect(result.state).toBe('open');
  });

  it('should apply default values', () => {
    const result = PullRequestSchema.parse(validPR);
    expect(result.isDraft).toBe(false);
    expect(result.labels).toEqual([]);
  });

  it('should validate all PR states', () => {
    const states = ['open', 'closed', 'merged'] as const;
    for (const state of states) {
      const result = PullRequestSchema.parse({ ...validPR, state });
      expect(result.state).toBe(state);
    }
  });

  it('should reject invalid state', () => {
    expect(() => PullRequestSchema.parse({ ...validPR, state: 'invalid' })).toThrow();
  });

  it('should accept optional fields', () => {
    const prWithOptional = {
      ...validPR,
      body: 'Description',
      url: 'https://github.com/pr/1',
    };
    const result = PullRequestSchema.parse(prWithOptional);
    expect(result.body).toBe('Description');
  });
});

describe('ReviewSchema', () => {
  const validReview = {
    id: 'review-1',
    author: { id: '1', login: 'reviewer' },
    state: 'APPROVED' as const,
    body: 'LGTM',
    submittedAt: '2026-01-01T00:00:00Z',
  };

  it('should validate a valid review', () => {
    const result = ReviewSchema.parse(validReview);
    expect(result.state).toBe('APPROVED');
    expect(result.author.login).toBe('reviewer');
  });

  it('should validate all review states', () => {
    const states = ['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'PENDING', 'DISMISSED'] as const;
    for (const state of states) {
      const result = ReviewSchema.parse({ ...validReview, state });
      expect(result.state).toBe(state);
    }
  });

  it('should reject invalid state', () => {
    expect(() => ReviewSchema.parse({ ...validReview, state: 'INVALID' })).toThrow();
  });
});

describe('CommentSchema', () => {
  const validComment = {
    id: 'comment-1',
    type: 'inline' as const,
    author: { id: '1', login: 'commenter' },
    body: 'Nice code!',
    createdAt: '2026-01-01T00:00:00Z',
    path: 'src/file.ts',
    line: 42,
  };

  it('should validate a valid inline comment', () => {
    const result = CommentSchema.parse(validComment);
    expect(result.type).toBe('inline');
    expect(result.path).toBe('src/file.ts');
    expect(result.line).toBe(42);
  });

  it('should validate all comment types', () => {
    const types = ['general', 'inline', 'review'] as const;
    for (const type of types) {
      const result = CommentSchema.parse({ ...validComment, type });
      expect(result.type).toBe(type);
    }
  });

  it('should apply default values', () => {
    const result = CommentSchema.parse(validComment);
    expect(result.resolved).toBe(false);
    expect(result.replies).toEqual([]);
  });

  it('should validate diff sides', () => {
    const sides = ['LEFT', 'RIGHT'] as const;
    for (const side of sides) {
      const result = CommentSchema.parse({ ...validComment, side });
      expect(result.side).toBe(side);
    }
  });
});

describe('DiffSchema', () => {
  const validDiff = {
    files: [
      {
        path: 'src/file.ts',
        status: 'modified' as const,
        additions: 10,
        deletions: 5,
        hunks: [
          {
            header: '@@ -1,5 +1,10 @@',
            oldStart: 1,
            oldCount: 5,
            newStart: 1,
            newCount: 10,
            lines: [
              { type: 'context' as const, content: 'unchanged line', oldLineNumber: 1, newLineNumber: 1 },
              { type: 'delete' as const, content: 'removed line', oldLineNumber: 2 },
              { type: 'add' as const, content: 'added line', newLineNumber: 2 },
            ],
          },
        ],
      },
    ],
  };

  it('should validate a valid diff', () => {
    const result = DiffSchema.parse(validDiff);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.hunks).toHaveLength(1);
    expect(result.files[0]?.hunks[0]?.lines).toHaveLength(3);
  });

  it('should validate all file statuses', () => {
    const statuses = ['added', 'modified', 'deleted', 'renamed', 'copied'] as const;
    for (const status of statuses) {
      const files = [{ ...validDiff.files[0], status }];
      const result = DiffSchema.parse({ files });
      expect(result.files[0]?.status).toBe(status);
    }
  });

  it('should validate all line types', () => {
    const types = ['add', 'delete', 'context', 'hunk'] as const;
    for (const type of types) {
      const line = { type, content: 'test' };
      const hunk = { ...validDiff.files[0]?.hunks[0], lines: [line] };
      const file = { ...validDiff.files[0], hunks: [hunk] };
      const result = DiffSchema.parse({ files: [file] });
      expect(result.files[0]?.hunks[0]?.lines[0]?.type).toBe(type);
    }
  });

  it('should apply default values', () => {
    const result = DiffSchema.parse({ files: [] });
    expect(result.totalAdditions).toBe(0);
    expect(result.totalDeletions).toBe(0);
    expect(result.totalChangedFiles).toBe(0);
  });
});

describe('WorkspaceSchema', () => {
  const validWorkspace = {
    id: 'ws-1',
    name: 'My Workspace',
    repos: [
      {
        id: 'repo-1',
        name: 'repo',
        fullName: 'owner/repo',
        owner: 'owner',
        provider: 'github' as const,
        host: 'github.com',
      },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  it('should validate a valid workspace', () => {
    const result = WorkspaceSchema.parse(validWorkspace);
    expect(result.name).toBe('My Workspace');
    expect(result.repos).toHaveLength(1);
  });

  it('should validate all providers', () => {
    const providers = ['github', 'gitlab', 'bitbucket', 'azuredevops'] as const;
    for (const provider of providers) {
      const repos = [{ ...validWorkspace.repos[0], provider }];
      const result = WorkspaceSchema.parse({ ...validWorkspace, repos });
      expect(result.repos[0]?.provider).toBe(provider);
    }
  });

  it('should apply default values for repository', () => {
    const result = WorkspaceSchema.parse(validWorkspace);
    expect(result.repos[0]?.defaultBranch).toBe('main');
    expect(result.repos[0]?.private).toBe(false);
  });
});

describe('Validation Helpers', () => {
  const validUser = { id: '1', login: 'test' };
  const validPR = {
    id: 'pr-1',
    number: 1,
    title: 'Test',
    state: 'open',
    author: { login: 'test', avatarUrl: '' },
    headRef: 'feature',
    baseRef: 'main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    repository: { owner: 'owner', name: 'repo' },
  };

  describe('validateUser', () => {
    it('should return valid user', () => {
      expect(validateUser(validUser)).toEqual(validUser);
    });

    it('should throw on invalid user', () => {
      expect(() => validateUser({})).toThrow();
    });
  });

  describe('validatePullRequest', () => {
    it('should return valid PR', () => {
      const result = validatePullRequest(validPR);
      expect(result.id).toBe('pr-1');
    });

    it('should throw on invalid PR', () => {
      expect(() => validatePullRequest({})).toThrow();
    });
  });

  describe('safeParseUser', () => {
    it('should return user on valid input', () => {
      expect(safeParseUser(validUser)).toEqual(validUser);
    });

    it('should return null on invalid input', () => {
      expect(safeParseUser({})).toBeNull();
    });
  });

  describe('safeParsePullRequest', () => {
    it('should return PR on valid input', () => {
      const result = safeParsePullRequest(validPR);
      expect(result?.id).toBe('pr-1');
    });

    it('should return null on invalid input', () => {
      expect(safeParsePullRequest({})).toBeNull();
    });
  });
});

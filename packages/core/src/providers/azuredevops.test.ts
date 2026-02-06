import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAzureDevOpsProvider } from './azuredevops';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('AzureDevOpsProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('creation', () => {
    it('should create provider with token', () => {
      const provider = createAzureDevOpsProvider({ token: 'test-pat' });
      expect(provider.type).toBe('azuredevops');
      expect(provider.name).toBe('Azure DevOps');
    });

    it('should throw if token is missing', () => {
      expect(() => createAzureDevOpsProvider({ token: '' })).toThrow('Azure DevOps token is required');
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      const provider = createAzureDevOpsProvider({ token: 'valid-pat' });
      const result = await provider.validateToken();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('_apis/projects'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic'),
          }),
        })
      );
    });

    it('should return false for invalid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const provider = createAzureDevOpsProvider({ token: 'invalid' });
      const result = await provider.validateToken();

      expect(result).toBe(false);
    });
  });

  describe('listPullRequests', () => {
    it('should fetch and map pull requests', async () => {
      const mockPRs = {
        value: [
          {
            pullRequestId: 1,
            title: 'Test PR',
            status: 'active',
            createdBy: { displayName: 'Test User' },
            creationDate: '2024-01-01T00:00:00Z',
            sourceRefName: 'refs/heads/feature-branch',
            targetRefName: 'refs/heads/main',
          },
          {
            pullRequestId: 2,
            title: 'Completed PR',
            status: 'completed',
            createdBy: { displayName: 'Other User' },
            creationDate: '2024-01-02T00:00:00Z',
            sourceRefName: 'refs/heads/hotfix',
            targetRefName: 'refs/heads/main',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPRs,
      });

      const provider = createAzureDevOpsProvider({ token: 'test-pat' });
      const prs = await provider.listPullRequests('org/project', 'repo');

      expect(prs).toHaveLength(2);
      expect(prs[0]).toMatchObject({
        id: '1',
        number: 1,
        title: 'Test PR',
        repo: 'org/project/repo',
        author: 'Test User',
        state: 'open',
      });
      expect(prs[1]?.state).toBe('merged');
    });

    it('should throw if owner format is invalid', async () => {
      const provider = createAzureDevOpsProvider({ token: 'test-pat' });
      await expect(provider.listPullRequests('invalid', 'repo')).rejects.toThrow(
        'Azure DevOps requires owner to be org/project'
      );
    });

    it('should map state correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      const provider = createAzureDevOpsProvider({ token: 'test-pat' });
      await provider.listPullRequests('org/project', 'repo', { state: 'closed' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('searchCriteria.status=abandoned'),
        expect.anything()
      );
    });
  });

  describe('getPullRequestDiff', () => {
    it('should fetch iterations and build diff', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [{ id: 1 }, { id: 2 }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            changeEntries: [
              {
                changeId: 1,
                changeType: 'edit',
                item: { path: '/src/file.ts' },
              },
            ],
          }),
        });

      const provider = createAzureDevOpsProvider({ token: 'test-pat' });
      const diff = await provider.getPullRequestDiff('org/project', 'repo', 1);

      expect(diff).toContain('diff --git');
      expect(diff).toContain('/src/file.ts');
    });

    it('should return empty string if no iterations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      const provider = createAzureDevOpsProvider({ token: 'test-pat' });
      const diff = await provider.getPullRequestDiff('org/project', 'repo', 1);

      expect(diff).toBe('');
    });
  });

  describe('createComment', () => {
    it('should create thread with comment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      const provider = createAzureDevOpsProvider({ token: 'test-pat' });
      await provider.createComment('org/project', 'repo', 1, { body: 'Test comment' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/threads'),
        expect.objectContaining({
          method: 'POST',
        })
      );

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call?.[1]?.body as string);
      expect(body.comments[0].content).toBe('Test comment');
    });

    it('should add file context for inline comments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      const provider = createAzureDevOpsProvider({ token: 'test-pat' });
      await provider.createComment('org/project', 'repo', 1, {
        body: 'Inline comment',
        path: 'file.ts',
        line: 10,
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call?.[1]?.body as string);
      expect(body.threadContext.filePath).toBe('file.ts');
      expect(body.threadContext.rightFileStart.line).toBe(10);
    });
  });

  describe('approveReview', () => {
    it('should set vote to approved', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'user-id' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ vote: 10 }),
        });

      const provider = createAzureDevOpsProvider({ token: 'test-pat' });
      await provider.approveReview('org/project', 'repo', 1);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/reviewers/'),
        expect.objectContaining({
          method: 'PATCH',
        })
      );

      const call = mockFetch.mock.calls[1];
      const body = JSON.parse(call?.[1]?.body as string);
      expect(body.vote).toBe(10);
    });

    it('should add comment if body provided', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'user-id' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ vote: 10 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1 }),
        });

      const provider = createAzureDevOpsProvider({ token: 'test-pat' });
      await provider.approveReview('org/project', 'repo', 1, 'LGTM!');

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('requestChanges', () => {
    it('should set vote to rejected and add comment', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'user-id' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ vote: -10 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1 }),
        });

      const provider = createAzureDevOpsProvider({ token: 'test-pat' });
      await provider.requestChanges('org/project', 'repo', 1, 'Please fix');

      const voteCall = mockFetch.mock.calls[1];
      const voteBody = JSON.parse(voteCall?.[1]?.body as string);
      expect(voteBody.vote).toBe(-10);
    });
  });

  describe('createReview', () => {
    it('should handle APPROVE event', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'user-id' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ vote: 10 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1 }),
        });

      const provider = createAzureDevOpsProvider({ token: 'test-pat' });
      await provider.createReview('org/project', 'repo', 1, {
        event: 'APPROVE',
        body: 'Approved!',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/reviewers/'),
        expect.anything()
      );
    });

    it('should handle REQUEST_CHANGES event', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'user-id' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ vote: -10 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1 }),
        });

      const provider = createAzureDevOpsProvider({ token: 'test-pat' });
      await provider.createReview('org/project', 'repo', 1, {
        event: 'REQUEST_CHANGES',
        body: 'Needs work',
      });

      const voteCall = mockFetch.mock.calls[1];
      const voteBody = JSON.parse(voteCall?.[1]?.body as string);
      expect(voteBody.vote).toBe(-10);
    });

    it('should create comments for COMMENT event', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      const provider = createAzureDevOpsProvider({ token: 'test-pat' });
      await provider.createReview('org/project', 'repo', 1, {
        event: 'COMMENT',
        body: 'Review feedback',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/threads'),
        expect.anything()
      );
    });
  });

  describe('custom baseUrl', () => {
    it('should use on-premises URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      const provider = createAzureDevOpsProvider({
        token: 'test-pat',
        baseUrl: 'https://tfs.company.com/tfs',
      });
      await provider.listPullRequests('org/project', 'repo');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('tfs.company.com'),
        expect.anything()
      );
    });
  });
});

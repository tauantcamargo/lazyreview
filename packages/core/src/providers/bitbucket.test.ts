import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBitbucketProvider } from './bitbucket';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('BitbucketProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('creation', () => {
    it('should create provider with token', () => {
      const provider = createBitbucketProvider({ token: 'user:app-password' });
      expect(provider.type).toBe('bitbucket');
      expect(provider.name).toBe('Bitbucket');
    });

    it('should throw if token is missing', () => {
      expect(() => createBitbucketProvider({ token: '' })).toThrow('Bitbucket token is required');
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ username: 'testuser' }),
      });

      const provider = createBitbucketProvider({ token: 'user:password' });
      const result = await provider.validateToken();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.bitbucket.org/2.0/user',
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

      const provider = createBitbucketProvider({ token: 'invalid' });
      const result = await provider.validateToken();

      expect(result).toBe(false);
    });
  });

  describe('listPullRequests', () => {
    it('should fetch and map pull requests', async () => {
      const mockPRs = {
        values: [
          {
            id: 1,
            title: 'Test PR',
            state: 'OPEN',
            source: { branch: { name: 'feature-branch' } },
            destination: { branch: { name: 'main' } },
            created_on: '2024-01-01T00:00:00Z',
            updated_on: '2024-01-01T00:00:00Z',
            author: { display_name: 'Test User', nickname: 'testuser' },
          },
          {
            id: 2,
            title: 'Merged PR',
            state: 'MERGED',
            source: { branch: { name: 'hotfix' } },
            destination: { branch: { name: 'main' } },
            created_on: '2024-01-02T00:00:00Z',
            updated_on: '2024-01-02T00:00:00Z',
            author: { display_name: 'Other User' },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPRs,
      });

      const provider = createBitbucketProvider({ token: 'test-token' });
      const prs = await provider.listPullRequests('workspace', 'repo');

      expect(prs).toHaveLength(2);
      expect(prs[0]).toMatchObject({
        id: '1',
        number: 1,
        title: 'Test PR',
        author: { login: 'Test User', avatarUrl: '' },
        state: 'open',
        repository: { owner: 'workspace', name: 'repo' },
      });
      expect(prs[1]?.state).toBe('merged');
    });

    it('should map state to Bitbucket format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ values: [] }),
      });

      const provider = createBitbucketProvider({ token: 'test-token' });
      await provider.listPullRequests('workspace', 'repo', { state: 'closed' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('state=MERGED'),
        expect.anything()
      );
    });

    it('should cap limit at 50', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ values: [] }),
      });

      const provider = createBitbucketProvider({ token: 'test-token' });
      await provider.listPullRequests('workspace', 'repo', { limit: 100 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('pagelen=50'),
        expect.anything()
      );
    });
  });

  describe('getPullRequestDiff', () => {
    it('should fetch diff', async () => {
      const mockDiff = 'diff --git a/file.ts b/file.ts\n-old\n+new';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockDiff,
      });

      const provider = createBitbucketProvider({ token: 'test-token' });
      const diff = await provider.getPullRequestDiff('workspace', 'repo', 1);

      expect(diff).toBe(mockDiff);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/diff'),
        expect.anything()
      );
    });
  });

  describe('createComment', () => {
    it('should create general comment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      const provider = createBitbucketProvider({ token: 'test-token' });
      await provider.createComment('workspace', 'repo', 1, { body: 'Test comment' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/comments'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ content: { raw: 'Test comment' } }),
        })
      );
    });

    it('should create inline comment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      const provider = createBitbucketProvider({ token: 'test-token' });
      await provider.createComment('workspace', 'repo', 1, {
        body: 'Inline comment',
        path: 'file.ts',
        line: 10,
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call?.[1]?.body as string);
      expect(body.inline).toEqual({ path: 'file.ts', to: 10 });
    });
  });

  describe('approveReview', () => {
    it('should approve pull request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ approved: true }),
      });

      const provider = createBitbucketProvider({ token: 'test-token' });
      await provider.approveReview('workspace', 'repo', 1);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/approve'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('requestChanges', () => {
    it('should create comment with REQUEST_CHANGES', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      const provider = createBitbucketProvider({ token: 'test-token' });
      await provider.requestChanges('workspace', 'repo', 1, 'Please fix');

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call?.[1]?.body as string);
      expect(body.content.raw).toContain('REQUEST_CHANGES');
    });
  });

  describe('createReview', () => {
    it('should create comment with review body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      const provider = createBitbucketProvider({ token: 'test-token' });
      await provider.createReview('workspace', 'repo', 1, {
        event: 'COMMENT',
        body: 'Review feedback',
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call?.[1]?.body as string);
      expect(body.content.raw).toBe('Review feedback');
    });
  });
});

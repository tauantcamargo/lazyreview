import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGitHubProvider } from './github';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GitHubProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('creation', () => {
    it('should create provider with token', () => {
      const provider = createGitHubProvider({ token: 'test-token' });
      expect(provider.type).toBe('github');
      expect(provider.name).toBe('GitHub');
    });

    it('should throw if token is missing', () => {
      expect(() => createGitHubProvider({ token: '' })).toThrow('GitHub token is required');
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'testuser' }),
      });

      const provider = createGitHubProvider({ token: 'valid-token' });
      const result = await provider.validateToken();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-token',
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

      const provider = createGitHubProvider({ token: 'invalid-token' });
      const result = await provider.validateToken();

      expect(result).toBe(false);
    });
  });

  describe('listPullRequests', () => {
    it('should fetch and map pull requests', async () => {
      const mockPRs = [
        {
          id: 123,
          number: 1,
          title: 'Test PR',
          state: 'open',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          user: { login: 'testuser' },
          head: { ref: 'feature-branch' },
          base: { ref: 'main' },
        },
        {
          id: 456,
          number: 2,
          title: 'Another PR',
          state: 'closed',
          merged_at: '2024-01-02T00:00:00Z',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          user: { login: 'otheruser' },
          head: { ref: 'hotfix' },
          base: { ref: 'main' },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPRs,
      });

      const provider = createGitHubProvider({ token: 'test-token' });
      const prs = await provider.listPullRequests('owner', 'repo');

      expect(prs).toHaveLength(2);
      expect(prs[0]).toMatchObject({
        id: '123',
        number: 1,
        title: 'Test PR',
        author: { login: 'testuser', avatarUrl: '' },
        state: 'open',
        repository: { owner: 'owner', name: 'repo' },
      });
      expect(prs[1]?.state).toBe('merged');
    });

    it('should pass state and limit parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const provider = createGitHubProvider({ token: 'test-token' });
      await provider.listPullRequests('owner', 'repo', { state: 'closed', limit: 50 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('state=closed'),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('per_page=50'),
        expect.anything()
      );
    });

    it('should cap limit at 100', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const provider = createGitHubProvider({ token: 'test-token' });
      await provider.listPullRequests('owner', 'repo', { limit: 200 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('per_page=100'),
        expect.anything()
      );
    });
  });

  describe('getPullRequestDiff', () => {
    it('should fetch diff with correct accept header', async () => {
      const mockDiff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-old
+new`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockDiff,
      });

      const provider = createGitHubProvider({ token: 'test-token' });
      const diff = await provider.getPullRequestDiff('owner', 'repo', 123);

      expect(diff).toBe(mockDiff);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/pulls/123',
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/vnd.github.v3.diff',
          }),
        })
      );
    });
  });

  describe('createComment', () => {
    it('should create issue comment for general comment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      const provider = createGitHubProvider({ token: 'test-token' });
      await provider.createComment('owner', 'repo', 123, { body: 'Test comment' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/issues/123/comments',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ body: 'Test comment' }),
        })
      );
    });

    it('should create review comment for inline comment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      const provider = createGitHubProvider({ token: 'test-token' });
      await provider.createComment('owner', 'repo', 123, {
        body: 'Inline comment',
        path: 'src/file.ts',
        line: 10,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/pulls/123/comments',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('approveReview', () => {
    it('should create approve review', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      const provider = createGitHubProvider({ token: 'test-token' });
      await provider.approveReview('owner', 'repo', 123, 'LGTM!');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/pulls/123/reviews',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ event: 'APPROVE', body: 'LGTM!' }),
        })
      );
    });
  });

  describe('requestChanges', () => {
    it('should create request changes review', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      const provider = createGitHubProvider({ token: 'test-token' });
      await provider.requestChanges('owner', 'repo', 123, 'Please fix this');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/pulls/123/reviews',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ event: 'REQUEST_CHANGES', body: 'Please fix this' }),
        })
      );
    });
  });

  describe('createReview', () => {
    it('should create review with event and body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      const provider = createGitHubProvider({ token: 'test-token' });
      await provider.createReview('owner', 'repo', 123, {
        event: 'COMMENT',
        body: 'General feedback',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/pulls/123/reviews',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('COMMENT'),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      });

      const provider = createGitHubProvider({ token: 'test-token' });
      await expect(provider.listPullRequests('owner', 'repo')).rejects.toThrow(
        'GitHub API error 404: Not Found'
      );
    });
  });

  describe('custom baseUrl', () => {
    it('should use enterprise URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const provider = createGitHubProvider({
        token: 'test-token',
        baseUrl: 'https://github.enterprise.com/api/v3',
      });
      await provider.listPullRequests('owner', 'repo');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('github.enterprise.com'),
        expect.anything()
      );
    });
  });
});

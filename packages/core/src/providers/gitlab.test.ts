import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGitLabProvider } from './gitlab';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GitLabProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('creation', () => {
    it('should create provider with token', () => {
      const provider = createGitLabProvider({ token: 'test-token' });
      expect(provider.type).toBe('gitlab');
      expect(provider.name).toBe('GitLab');
    });

    it('should throw if token is missing', () => {
      expect(() => createGitLabProvider({ token: '' })).toThrow('GitLab token is required');
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, username: 'testuser' }),
      });

      const provider = createGitLabProvider({ token: 'valid-token' });
      const result = await provider.validateToken();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.com/api/v4/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Private-Token': 'valid-token',
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

      const provider = createGitLabProvider({ token: 'invalid-token' });
      const result = await provider.validateToken();

      expect(result).toBe(false);
    });
  });

  describe('listPullRequests', () => {
    it('should fetch and map merge requests', async () => {
      const mockMRs = [
        {
          id: 123,
          iid: 1,
          title: 'Test MR',
          state: 'opened',
          source_branch: 'feature-branch',
          target_branch: 'main',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          author: { username: 'testuser' },
        },
        {
          id: 456,
          iid: 2,
          title: 'Merged MR',
          state: 'merged',
          source_branch: 'hotfix',
          target_branch: 'main',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          author: { username: 'otheruser' },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMRs,
      });

      const provider = createGitLabProvider({ token: 'test-token' });
      const prs = await provider.listPullRequests('owner', 'repo');

      expect(prs).toHaveLength(2);
      expect(prs[0]).toMatchObject({
        id: '123',
        number: 1,
        title: 'Test MR',
        repo: 'owner/repo',
        author: 'testuser',
        state: 'open',
      });
      expect(prs[1]?.state).toBe('merged');
    });

    it('should URL-encode project path', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const provider = createGitLabProvider({ token: 'test-token' });
      await provider.listPullRequests('my-group', 'my-project');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('my-group%2Fmy-project'),
        expect.anything()
      );
    });

    it('should map state correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const provider = createGitLabProvider({ token: 'test-token' });
      await provider.listPullRequests('owner', 'repo', { state: 'closed' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('state=closed'),
        expect.anything()
      );
    });
  });

  describe('getPullRequestDiff', () => {
    it('should fetch changes and build unified diff', async () => {
      const mockChanges = {
        changes: [
          {
            old_path: 'src/old.ts',
            new_path: 'src/new.ts',
            diff: '@@ -1 +1 @@\n-old\n+new',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockChanges,
      });

      const provider = createGitLabProvider({ token: 'test-token' });
      const diff = await provider.getPullRequestDiff('owner', 'repo', 1);

      expect(diff).toContain('diff --git a/src/old.ts b/src/new.ts');
      expect(diff).toContain('--- a/src/old.ts');
      expect(diff).toContain('+++ b/src/new.ts');
      expect(diff).toContain('-old');
      expect(diff).toContain('+new');
    });
  });

  describe('createComment', () => {
    it('should create note on merge request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      const provider = createGitLabProvider({ token: 'test-token' });
      await provider.createComment('owner', 'repo', 1, { body: 'Test comment' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/notes'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ body: 'Test comment' }),
        })
      );
    });

    it('should throw for inline comments (not implemented)', async () => {
      const provider = createGitLabProvider({ token: 'test-token' });
      await expect(
        provider.createComment('owner', 'repo', 1, {
          body: 'Inline',
          path: 'file.ts',
          line: 10,
        })
      ).rejects.toThrow('GitLab inline comments are not implemented yet');
    });
  });

  describe('approveReview', () => {
    it('should approve merge request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      const provider = createGitLabProvider({ token: 'test-token' });
      await provider.approveReview('owner', 'repo', 1);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/approve'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('requestChanges', () => {
    it('should create note with REQUEST_CHANGES prefix', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      const provider = createGitLabProvider({ token: 'test-token' });
      await provider.requestChanges('owner', 'repo', 1, 'Please fix');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/notes'),
        expect.objectContaining({
          body: expect.stringContaining('REQUEST_CHANGES'),
        })
      );
    });
  });

  describe('createReview', () => {
    it('should create note with review body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      const provider = createGitLabProvider({ token: 'test-token' });
      await provider.createReview('owner', 'repo', 1, {
        event: 'COMMENT',
        body: 'Review feedback',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/notes'),
        expect.objectContaining({
          body: JSON.stringify({ body: 'Review feedback' }),
        })
      );
    });
  });

  describe('custom baseUrl', () => {
    it('should use self-hosted GitLab URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const provider = createGitLabProvider({
        token: 'test-token',
        baseUrl: 'https://gitlab.company.com/api/v4',
      });
      await provider.listPullRequests('owner', 'repo');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('gitlab.company.com'),
        expect.anything()
      );
    });
  });
});

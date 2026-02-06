import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { storeToken, readToken, deleteToken } from './auth';

// Mock the platform module
vi.mock('@lazyreview/platform', () => ({
  deriveAccount: vi.fn((provider: string, host: string) => `lazyreview:${provider}:${host}`),
  storeSecret: vi.fn(async () => 'keychain' as const),
  getSecret: vi.fn(async () => null),
  deleteSecret: vi.fn(async () => 'keychain' as const),
}));

import { deriveAccount, storeSecret, getSecret, deleteSecret } from '@lazyreview/platform';

describe('auth module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('storeToken', () => {
    it('should derive account and store secret', async () => {
      const result = await storeToken('github', 'github.com', 'test-token');

      expect(deriveAccount).toHaveBeenCalledWith('github', 'github.com');
      expect(storeSecret).toHaveBeenCalledWith('lazyreview:github:github.com', 'test-token');
      expect(result.storage).toBe('keychain');
    });

    it('should handle different providers', async () => {
      await storeToken('gitlab', 'gitlab.example.com', 'gl-token');

      expect(deriveAccount).toHaveBeenCalledWith('gitlab', 'gitlab.example.com');
      expect(storeSecret).toHaveBeenCalledWith('lazyreview:gitlab:gitlab.example.com', 'gl-token');
    });

    it('should return file storage when keychain unavailable', async () => {
      vi.mocked(storeSecret).mockResolvedValueOnce('file');

      const result = await storeToken('github', 'github.com', 'token');
      expect(result.storage).toBe('file');
    });
  });

  describe('readToken', () => {
    it('should derive account and read secret', async () => {
      vi.mocked(getSecret).mockResolvedValueOnce('stored-token');

      const result = await readToken('github', 'github.com');

      expect(deriveAccount).toHaveBeenCalledWith('github', 'github.com');
      expect(getSecret).toHaveBeenCalledWith('lazyreview:github:github.com');
      expect(result).toBe('stored-token');
    });

    it('should return null when no token found', async () => {
      vi.mocked(getSecret).mockResolvedValueOnce(null);

      const result = await readToken('github', 'github.com');
      expect(result).toBeNull();
    });

    it('should handle different hosts', async () => {
      vi.mocked(getSecret).mockResolvedValueOnce('enterprise-token');

      const result = await readToken('github', 'github.enterprise.com');

      expect(deriveAccount).toHaveBeenCalledWith('github', 'github.enterprise.com');
      expect(result).toBe('enterprise-token');
    });
  });

  describe('deleteToken', () => {
    it('should derive account and delete secret', async () => {
      const result = await deleteToken('github', 'github.com');

      expect(deriveAccount).toHaveBeenCalledWith('github', 'github.com');
      expect(deleteSecret).toHaveBeenCalledWith('lazyreview:github:github.com');
      expect(result.storage).toBe('keychain');
    });

    it('should return file storage when file fallback used', async () => {
      vi.mocked(deleteSecret).mockResolvedValueOnce('file');

      const result = await deleteToken('gitlab', 'gitlab.com');
      expect(result.storage).toBe('file');
    });
  });

  describe('integration', () => {
    it('should use consistent account derivation', async () => {
      const provider = 'bitbucket';
      const host = 'bitbucket.org';

      await storeToken(provider, host, 'bb-token');
      await readToken(provider, host);
      await deleteToken(provider, host);

      // All operations should use the same derived account
      expect(deriveAccount).toHaveBeenCalledTimes(3);
      expect(deriveAccount).toHaveBeenNthCalledWith(1, provider, host);
      expect(deriveAccount).toHaveBeenNthCalledWith(2, provider, host);
      expect(deriveAccount).toHaveBeenNthCalledWith(3, provider, host);
    });
  });
});

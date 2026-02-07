import { useState, useCallback, useEffect } from 'react';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execCallback);

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: number;
  modified: number;
  untracked: number;
  isDirty: boolean;
}

export interface UseGitStatusResult {
  status: GitStatus | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to get the current git status
 */
export function useGitStatus(cwd?: string): UseGitStatusResult {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const options = cwd ? { cwd } : {};

      // Get branch name
      const { stdout: branchOutput } = await exec(
        'git rev-parse --abbrev-ref HEAD',
        options
      );
      const branch = branchOutput.trim();

      // Get ahead/behind counts
      let ahead = 0;
      let behind = 0;
      try {
        const { stdout: aheadBehindOutput } = await exec(
          'git rev-list --left-right --count HEAD...@{upstream}',
          options
        );
        const [aheadStr, behindStr] = aheadBehindOutput.trim().split(/\s+/);
        ahead = parseInt(aheadStr ?? '0', 10);
        behind = parseInt(behindStr ?? '0', 10);
      } catch {
        // No upstream set
      }

      // Get status counts
      const { stdout: statusOutput } = await exec(
        'git status --porcelain',
        options
      );
      const lines = statusOutput.trim().split('\n').filter(Boolean);

      let staged = 0;
      let modified = 0;
      let untracked = 0;

      for (const line of lines) {
        const indexStatus = line[0];
        const workTreeStatus = line[1];

        if (indexStatus === '?' && workTreeStatus === '?') {
          untracked++;
        } else {
          if (indexStatus !== ' ' && indexStatus !== '?') {
            staged++;
          }
          if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
            modified++;
          }
        }
      }

      setStatus({
        branch,
        ahead,
        behind,
        staged,
        modified,
        untracked,
        isDirty: staged > 0 || modified > 0 || untracked > 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    status,
    isLoading,
    error,
    refresh,
  };
}

export interface UseGitCheckoutResult {
  checkout: (ref: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for git checkout operations
 */
export function useGitCheckout(cwd?: string): UseGitCheckoutResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkout = useCallback(
    async (ref: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const options = cwd ? { cwd } : {};

        // Fetch first to ensure we have the latest refs
        await exec('git fetch', options);

        // Checkout the ref
        await exec(`git checkout ${ref}`, options);
      } catch (err) {
        const newError = err instanceof Error ? err : new Error(String(err));
        setError(newError);
        throw newError;
      } finally {
        setIsLoading(false);
      }
    },
    [cwd]
  );

  return {
    checkout,
    isLoading,
    error,
  };
}

export interface UseGitRemoteResult {
  remotes: string[];
  defaultRemote: string | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to get git remotes
 */
export function useGitRemote(cwd?: string): UseGitRemoteResult {
  const [remotes, setRemotes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const options = cwd ? { cwd } : {};
      const { stdout } = await exec('git remote', options);
      const remoteList = stdout.trim().split('\n').filter(Boolean);
      setRemotes(remoteList);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setRemotes([]);
    } finally {
      setIsLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const defaultRemote = remotes.includes('origin')
    ? 'origin'
    : remotes[0] ?? null;

  return {
    remotes,
    defaultRemote,
    isLoading,
    error,
    refresh,
  };
}

export interface BranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  lastCommit?: string;
}

export interface UseGitBranchesResult {
  branches: BranchInfo[];
  currentBranch: string | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to get git branches
 */
export function useGitBranches(cwd?: string): UseGitBranchesResult {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const options = cwd ? { cwd } : {};
      const { stdout } = await exec(
        'git branch -a --format="%(refname:short)|||%(objectname:short)|||%(HEAD)"',
        options
      );

      const branchList: BranchInfo[] = [];

      for (const line of stdout.trim().split('\n').filter(Boolean)) {
        const [name, lastCommit, head] = line.split('|||');
        if (!name) continue;

        branchList.push({
          name: name.replace(/^origin\//, ''),
          isCurrent: head === '*',
          isRemote: name.startsWith('origin/'),
          lastCommit,
        });
      }

      setBranches(branchList);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setBranches([]);
    } finally {
      setIsLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const currentBranch = branches.find((b) => b.isCurrent)?.name ?? null;

  return {
    branches,
    currentBranch,
    isLoading,
    error,
    refresh,
  };
}

export interface UseGitDiffResult {
  diff: string;
  stats: { additions: number; deletions: number; files: number };
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to get git diff
 */
export function useGitDiff(
  ref?: string,
  options?: { staged?: boolean; cwd?: string }
): UseGitDiffResult {
  const { staged = false, cwd } = options ?? {};
  const [diff, setDiff] = useState('');
  const [stats, setStats] = useState({ additions: 0, deletions: 0, files: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const execOptions = cwd ? { cwd } : {};
      const stagedFlag = staged ? '--staged' : '';
      const refArg = ref ?? '';

      const { stdout: diffOutput } = await exec(
        `git diff ${stagedFlag} ${refArg}`.trim(),
        execOptions
      );

      const { stdout: statOutput } = await exec(
        `git diff ${stagedFlag} ${refArg} --stat`.trim(),
        execOptions
      );

      setDiff(diffOutput);

      // Parse stats
      const lines = statOutput.trim().split('\n');
      const summaryLine = lines[lines.length - 1] ?? '';
      const filesMatch = summaryLine.match(/(\d+) files? changed/);
      const additionsMatch = summaryLine.match(/(\d+) insertions?/);
      const deletionsMatch = summaryLine.match(/(\d+) deletions?/);

      setStats({
        files: filesMatch ? parseInt(filesMatch[1] ?? '0', 10) : 0,
        additions: additionsMatch ? parseInt(additionsMatch[1] ?? '0', 10) : 0,
        deletions: deletionsMatch ? parseInt(deletionsMatch[1] ?? '0', 10) : 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setDiff('');
      setStats({ additions: 0, deletions: 0, files: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [ref, staged, cwd]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    diff,
    stats,
    isLoading,
    error,
    refresh,
  };
}

/**
 * Check if current directory is a git repository
 */
export async function isGitRepo(cwd?: string): Promise<boolean> {
  try {
    const options = cwd ? { cwd } : {};
    await exec('git rev-parse --is-inside-work-tree', options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the root directory of the git repository
 */
export async function getGitRoot(cwd?: string): Promise<string | null> {
  try {
    const options = cwd ? { cwd } : {};
    const { stdout } = await exec('git rev-parse --show-toplevel', options);
    return stdout.trim();
  } catch {
    return null;
  }
}

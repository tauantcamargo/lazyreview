import { useState, useCallback, useMemo } from 'react';

export type FileReviewState = 'unreviewed' | 'viewed' | 'reviewed' | 'commented';

export interface ReviewedFile {
  path: string;
  state: FileReviewState;
  viewedAt?: number;
  reviewedAt?: number;
  comments?: number;
}

export interface UseFileReviewOptions {
  initialFiles?: ReviewedFile[];
  autoMarkViewed?: boolean;
  persistKey?: string;
}

export interface UseFileReviewResult {
  files: Map<string, ReviewedFile>;
  markViewed: (path: string) => void;
  markReviewed: (path: string) => void;
  markCommented: (path: string, count?: number) => void;
  markUnreviewed: (path: string) => void;
  getState: (path: string) => FileReviewState;
  isViewed: (path: string) => boolean;
  isReviewed: (path: string) => boolean;
  viewedCount: number;
  reviewedCount: number;
  totalCount: number;
  progress: number;
  reset: () => void;
  setFiles: (paths: string[]) => void;
}

/**
 * Hook for tracking file review state
 */
export function useFileReview(options: UseFileReviewOptions = {}): UseFileReviewResult {
  const { initialFiles = [] } = options;

  const [files, setFilesMap] = useState<Map<string, ReviewedFile>>(() => {
    const map = new Map<string, ReviewedFile>();
    for (const file of initialFiles) {
      map.set(file.path, file);
    }
    return map;
  });

  const markViewed = useCallback((path: string) => {
    setFilesMap((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(path);

      newMap.set(path, {
        ...existing,
        path,
        state: existing?.state === 'reviewed' || existing?.state === 'commented'
          ? existing.state
          : 'viewed',
        viewedAt: Date.now(),
      });

      return newMap;
    });
  }, []);

  const markReviewed = useCallback((path: string) => {
    setFilesMap((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(path);

      newMap.set(path, {
        ...existing,
        path,
        state: existing?.state === 'commented' ? 'commented' : 'reviewed',
        reviewedAt: Date.now(),
        viewedAt: existing?.viewedAt ?? Date.now(),
      });

      return newMap;
    });
  }, []);

  const markCommented = useCallback((path: string, count = 1) => {
    setFilesMap((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(path);

      newMap.set(path, {
        ...existing,
        path,
        state: 'commented',
        comments: (existing?.comments ?? 0) + count,
        viewedAt: existing?.viewedAt ?? Date.now(),
      });

      return newMap;
    });
  }, []);

  const markUnreviewed = useCallback((path: string) => {
    setFilesMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(path, {
        path,
        state: 'unreviewed',
      });
      return newMap;
    });
  }, []);

  const getState = useCallback((path: string): FileReviewState => {
    return files.get(path)?.state ?? 'unreviewed';
  }, [files]);

  const isViewed = useCallback((path: string): boolean => {
    const state = files.get(path)?.state;
    return state === 'viewed' || state === 'reviewed' || state === 'commented';
  }, [files]);

  const isReviewed = useCallback((path: string): boolean => {
    const state = files.get(path)?.state;
    return state === 'reviewed' || state === 'commented';
  }, [files]);

  const viewedCount = useMemo(() => {
    let count = 0;
    for (const file of files.values()) {
      if (file.state !== 'unreviewed') {
        count++;
      }
    }
    return count;
  }, [files]);

  const reviewedCount = useMemo(() => {
    let count = 0;
    for (const file of files.values()) {
      if (file.state === 'reviewed' || file.state === 'commented') {
        count++;
      }
    }
    return count;
  }, [files]);

  const totalCount = files.size;

  const progress = useMemo(() => {
    if (totalCount === 0) return 0;
    return Math.round((reviewedCount / totalCount) * 100);
  }, [reviewedCount, totalCount]);

  const reset = useCallback(() => {
    setFilesMap((prev) => {
      const newMap = new Map<string, ReviewedFile>();
      for (const path of prev.keys()) {
        newMap.set(path, { path, state: 'unreviewed' });
      }
      return newMap;
    });
  }, []);

  const setFilePaths = useCallback((paths: string[]) => {
    setFilesMap((prev) => {
      const newMap = new Map<string, ReviewedFile>();
      for (const path of paths) {
        const existing = prev.get(path);
        if (existing) {
          newMap.set(path, existing);
        } else {
          newMap.set(path, { path, state: 'unreviewed' });
        }
      }
      return newMap;
    });
  }, []);

  return {
    files,
    markViewed,
    markReviewed,
    markCommented,
    markUnreviewed,
    getState,
    isViewed,
    isReviewed,
    viewedCount,
    reviewedCount,
    totalCount,
    progress,
    reset,
    setFiles: setFilePaths,
  };
}

export interface FileGroup {
  label: string;
  files: string[];
}

export interface UseFileGroupsResult {
  groups: FileGroup[];
  currentGroup: FileGroup | null;
  currentGroupIndex: number;
  nextGroup: () => void;
  prevGroup: () => void;
  goToGroup: (index: number) => void;
  findGroupForFile: (path: string) => number;
}

/**
 * Hook for grouping files by directory or type
 */
export function useFileGroups(files: string[]): UseFileGroupsResult {
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);

  const groups = useMemo(() => {
    const groupMap = new Map<string, string[]>();

    for (const file of files) {
      const parts = file.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';

      if (!groupMap.has(dir)) {
        groupMap.set(dir, []);
      }
      groupMap.get(dir)?.push(file);
    }

    return Array.from(groupMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, groupFiles]) => ({
        label,
        files: groupFiles.sort(),
      }));
  }, [files]);

  const currentGroup = groups[currentGroupIndex] ?? null;

  const nextGroup = useCallback(() => {
    setCurrentGroupIndex((prev) => Math.min(prev + 1, groups.length - 1));
  }, [groups.length]);

  const prevGroup = useCallback(() => {
    setCurrentGroupIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToGroup = useCallback((index: number) => {
    setCurrentGroupIndex(Math.max(0, Math.min(index, groups.length - 1)));
  }, [groups.length]);

  const findGroupForFile = useCallback((path: string): number => {
    for (let i = 0; i < groups.length; i++) {
      if (groups[i]?.files.includes(path)) {
        return i;
      }
    }
    return -1;
  }, [groups]);

  return {
    groups,
    currentGroup,
    currentGroupIndex,
    nextGroup,
    prevGroup,
    goToGroup,
    findGroupForFile,
  };
}

/**
 * Get file icon based on path/extension
 */
export function getFileIcon(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'ts':
    case 'tsx':
      return '🔷';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return '🟨';
    case 'json':
      return '📋';
    case 'md':
    case 'markdown':
      return '📝';
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return '🎨';
    case 'html':
    case 'htm':
      return '🌐';
    case 'go':
      return '🐹';
    case 'rs':
      return '🦀';
    case 'py':
      return '🐍';
    case 'rb':
      return '💎';
    case 'java':
      return '☕';
    case 'yml':
    case 'yaml':
      return '⚙️';
    case 'svg':
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
      return '🖼️';
    case 'lock':
      return '🔒';
    case 'env':
      return '🔐';
    default:
      return '📄';
  }
}

/**
 * Get status color for file review state
 */
export function getReviewStateColor(state: FileReviewState): string {
  switch (state) {
    case 'reviewed':
      return '#9ece6a'; // green
    case 'commented':
      return '#7aa2f7'; // blue
    case 'viewed':
      return '#e0af68'; // yellow
    default:
      return '#565f89'; // muted
  }
}

/**
 * Get status icon for file review state
 */
export function getReviewStateIcon(state: FileReviewState): string {
  switch (state) {
    case 'reviewed':
      return '✓';
    case 'commented':
      return '💬';
    case 'viewed':
      return '○';
    default:
      return '·';
  }
}

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useFileReview,
  useFileGroups,
  getFileIcon,
  getReviewStateColor,
  getReviewStateIcon,
} from './use-file-review';

describe('useFileReview', () => {
  it('initializes with empty state', () => {
    const { result } = renderHook(() => useFileReview());

    expect(result.current.totalCount).toBe(0);
    expect(result.current.viewedCount).toBe(0);
    expect(result.current.reviewedCount).toBe(0);
    expect(result.current.progress).toBe(0);
  });

  it('initializes with initial files', () => {
    const { result } = renderHook(() =>
      useFileReview({
        initialFiles: [
          { path: 'file1.ts', state: 'unreviewed' },
          { path: 'file2.ts', state: 'viewed' },
        ],
      })
    );

    expect(result.current.totalCount).toBe(2);
    expect(result.current.viewedCount).toBe(1);
  });

  it('sets files from paths', () => {
    const { result } = renderHook(() => useFileReview());

    act(() => {
      result.current.setFiles(['file1.ts', 'file2.ts', 'file3.ts']);
    });

    expect(result.current.totalCount).toBe(3);
    expect(result.current.getState('file1.ts')).toBe('unreviewed');
  });

  it('marks file as viewed', () => {
    const { result } = renderHook(() => useFileReview());

    act(() => {
      result.current.setFiles(['file1.ts']);
    });

    act(() => {
      result.current.markViewed('file1.ts');
    });

    expect(result.current.getState('file1.ts')).toBe('viewed');
    expect(result.current.isViewed('file1.ts')).toBe(true);
    expect(result.current.viewedCount).toBe(1);
  });

  it('marks file as reviewed', () => {
    const { result } = renderHook(() => useFileReview());

    act(() => {
      result.current.setFiles(['file1.ts']);
    });

    act(() => {
      result.current.markReviewed('file1.ts');
    });

    expect(result.current.getState('file1.ts')).toBe('reviewed');
    expect(result.current.isReviewed('file1.ts')).toBe(true);
    expect(result.current.reviewedCount).toBe(1);
  });

  it('marks file as commented', () => {
    const { result } = renderHook(() => useFileReview());

    act(() => {
      result.current.setFiles(['file1.ts']);
    });

    act(() => {
      result.current.markCommented('file1.ts');
    });

    expect(result.current.getState('file1.ts')).toBe('commented');
    expect(result.current.isReviewed('file1.ts')).toBe(true);
  });

  it('increments comment count', () => {
    const { result } = renderHook(() => useFileReview());

    act(() => {
      result.current.setFiles(['file1.ts']);
    });

    act(() => {
      result.current.markCommented('file1.ts', 2);
    });

    act(() => {
      result.current.markCommented('file1.ts', 1);
    });

    expect(result.current.files.get('file1.ts')?.comments).toBe(3);
  });

  it('marks file as unreviewed', () => {
    const { result } = renderHook(() => useFileReview());

    act(() => {
      result.current.setFiles(['file1.ts']);
    });

    act(() => {
      result.current.markReviewed('file1.ts');
    });

    act(() => {
      result.current.markUnreviewed('file1.ts');
    });

    expect(result.current.getState('file1.ts')).toBe('unreviewed');
    expect(result.current.isReviewed('file1.ts')).toBe(false);
  });

  it('does not downgrade reviewed to viewed', () => {
    const { result } = renderHook(() => useFileReview());

    act(() => {
      result.current.setFiles(['file1.ts']);
    });

    act(() => {
      result.current.markReviewed('file1.ts');
    });

    act(() => {
      result.current.markViewed('file1.ts');
    });

    expect(result.current.getState('file1.ts')).toBe('reviewed');
  });

  it('does not downgrade commented to reviewed', () => {
    const { result } = renderHook(() => useFileReview());

    act(() => {
      result.current.setFiles(['file1.ts']);
    });

    act(() => {
      result.current.markCommented('file1.ts');
    });

    act(() => {
      result.current.markReviewed('file1.ts');
    });

    expect(result.current.getState('file1.ts')).toBe('commented');
  });

  it('calculates progress correctly', () => {
    const { result } = renderHook(() => useFileReview());

    act(() => {
      result.current.setFiles(['file1.ts', 'file2.ts', 'file3.ts', 'file4.ts']);
    });

    act(() => {
      result.current.markReviewed('file1.ts');
    });

    act(() => {
      result.current.markReviewed('file2.ts');
    });

    expect(result.current.progress).toBe(50);
  });

  it('resets all files', () => {
    const { result } = renderHook(() => useFileReview());

    act(() => {
      result.current.setFiles(['file1.ts', 'file2.ts']);
    });

    act(() => {
      result.current.markReviewed('file1.ts');
    });

    act(() => {
      result.current.markReviewed('file2.ts');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.getState('file1.ts')).toBe('unreviewed');
    expect(result.current.getState('file2.ts')).toBe('unreviewed');
    expect(result.current.reviewedCount).toBe(0);
  });

  it('preserves existing state when setting files', () => {
    const { result } = renderHook(() => useFileReview());

    act(() => {
      result.current.setFiles(['file1.ts', 'file2.ts']);
    });

    act(() => {
      result.current.markReviewed('file1.ts');
    });

    act(() => {
      result.current.setFiles(['file1.ts', 'file2.ts', 'file3.ts']);
    });

    expect(result.current.getState('file1.ts')).toBe('reviewed');
    expect(result.current.getState('file3.ts')).toBe('unreviewed');
  });
});

describe('useFileGroups', () => {
  const files = [
    'src/components/Button.tsx',
    'src/components/Input.tsx',
    'src/hooks/useForm.ts',
    'src/utils/helpers.ts',
    'package.json',
    'README.md',
  ];

  it('groups files by directory', () => {
    const { result } = renderHook(() => useFileGroups(files));

    expect(result.current.groups.length).toBe(4);
    expect(result.current.groups[0]?.label).toBe('.');
    expect(result.current.groups[1]?.label).toBe('src/components');
  });

  it('initializes at first group', () => {
    const { result } = renderHook(() => useFileGroups(files));

    expect(result.current.currentGroupIndex).toBe(0);
    expect(result.current.currentGroup?.label).toBe('.');
  });

  it('navigates to next group', () => {
    const { result } = renderHook(() => useFileGroups(files));

    act(() => {
      result.current.nextGroup();
    });

    expect(result.current.currentGroupIndex).toBe(1);
  });

  it('navigates to previous group', () => {
    const { result } = renderHook(() => useFileGroups(files));

    act(() => {
      result.current.nextGroup();
    });

    act(() => {
      result.current.nextGroup();
    });

    act(() => {
      result.current.prevGroup();
    });

    expect(result.current.currentGroupIndex).toBe(1);
  });

  it('goes to specific group', () => {
    const { result } = renderHook(() => useFileGroups(files));

    act(() => {
      result.current.goToGroup(2);
    });

    expect(result.current.currentGroupIndex).toBe(2);
  });

  it('finds group for file', () => {
    const { result } = renderHook(() => useFileGroups(files));

    const groupIndex = result.current.findGroupForFile('src/components/Button.tsx');
    expect(groupIndex).toBe(1);
  });

  it('returns -1 for unknown file', () => {
    const { result } = renderHook(() => useFileGroups(files));

    const groupIndex = result.current.findGroupForFile('unknown.ts');
    expect(groupIndex).toBe(-1);
  });

  it('does not go past last group', () => {
    const { result } = renderHook(() => useFileGroups(files));

    for (let i = 0; i < 10; i++) {
      act(() => {
        result.current.nextGroup();
      });
    }

    expect(result.current.currentGroupIndex).toBe(3);
  });

  it('does not go before first group', () => {
    const { result } = renderHook(() => useFileGroups(files));

    act(() => {
      result.current.prevGroup();
    });

    expect(result.current.currentGroupIndex).toBe(0);
  });
});

describe('getFileIcon', () => {
  it('returns TypeScript icon', () => {
    expect(getFileIcon('file.ts')).toBe('🔷');
    expect(getFileIcon('file.tsx')).toBe('🔷');
  });

  it('returns JavaScript icon', () => {
    expect(getFileIcon('file.js')).toBe('🟨');
    expect(getFileIcon('file.jsx')).toBe('🟨');
    expect(getFileIcon('file.mjs')).toBe('🟨');
  });

  it('returns JSON icon', () => {
    expect(getFileIcon('package.json')).toBe('📋');
  });

  it('returns Markdown icon', () => {
    expect(getFileIcon('README.md')).toBe('📝');
  });

  it('returns Go icon', () => {
    expect(getFileIcon('main.go')).toBe('🐹');
  });

  it('returns Rust icon', () => {
    expect(getFileIcon('main.rs')).toBe('🦀');
  });

  it('returns Python icon', () => {
    expect(getFileIcon('script.py')).toBe('🐍');
  });

  it('returns default icon for unknown', () => {
    expect(getFileIcon('file.xyz')).toBe('📄');
  });

  it('returns lock icon', () => {
    expect(getFileIcon('package-lock.json.lock')).toBe('🔒');
  });

  it('returns CSS icon', () => {
    expect(getFileIcon('styles.css')).toBe('🎨');
    expect(getFileIcon('styles.scss')).toBe('🎨');
  });
});

describe('getReviewStateColor', () => {
  it('returns green for reviewed', () => {
    expect(getReviewStateColor('reviewed')).toBe('#9ece6a');
  });

  it('returns blue for commented', () => {
    expect(getReviewStateColor('commented')).toBe('#7aa2f7');
  });

  it('returns yellow for viewed', () => {
    expect(getReviewStateColor('viewed')).toBe('#e0af68');
  });

  it('returns muted for unreviewed', () => {
    expect(getReviewStateColor('unreviewed')).toBe('#565f89');
  });
});

describe('getReviewStateIcon', () => {
  it('returns checkmark for reviewed', () => {
    expect(getReviewStateIcon('reviewed')).toBe('✓');
  });

  it('returns comment icon for commented', () => {
    expect(getReviewStateIcon('commented')).toBe('💬');
  });

  it('returns circle for viewed', () => {
    expect(getReviewStateIcon('viewed')).toBe('○');
  });

  it('returns dot for unreviewed', () => {
    expect(getReviewStateIcon('unreviewed')).toBe('·');
  });
});

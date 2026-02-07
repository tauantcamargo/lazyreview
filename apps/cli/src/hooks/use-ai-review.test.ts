import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useAIReview,
  getSeverityColor,
  getSuggestionIcon,
  getRiskLevelColor,
  formatScoreGrade,
} from './use-ai-review';

describe('useAIReview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with idle status', () => {
    const { result } = renderHook(() => useAIReview());

    expect(result.current.status).toBe('idle');
    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.progress).toBe(0);
  });

  it('sets loading status when review starts', async () => {
    const { result } = renderHook(() => useAIReview());

    let reviewPromise: Promise<unknown>;
    act(() => {
      reviewPromise = result.current.review('diff --git a/test.ts');
    });

    expect(result.current.status).toBe('loading');

    // Complete the review
    await act(async () => {
      await vi.runAllTimersAsync();
      await reviewPromise;
    });
  });

  it('returns summary on success', async () => {
    const { result } = renderHook(() => useAIReview());

    await act(async () => {
      const promise = result.current.review('diff --git a/test.ts\n+new line');
      await vi.runAllTimersAsync();
      await promise;
    });

    expect(result.current.status).toBe('success');
    expect(result.current.summary).not.toBeNull();
    expect(result.current.summary?.reviewedFiles).toBe(1);
    expect(result.current.progress).toBe(100);
  });

  it('resets state', async () => {
    const { result } = renderHook(() => useAIReview());

    await act(async () => {
      const promise = result.current.review('diff --git a/test.ts');
      await vi.runAllTimersAsync();
      await promise;
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.progress).toBe(0);
  });

  it('detects console.log in diff', async () => {
    const { result } = renderHook(() => useAIReview());

    await act(async () => {
      const promise = result.current.review('diff --git a/test.ts\n+console.log("test")');
      await vi.runAllTimersAsync();
      await promise;
    });

    const suggestion = result.current.summary?.suggestions.find(
      s => s.id === 'console-log'
    );
    expect(suggestion).toBeDefined();
    expect(suggestion?.type).toBe('style');
  });

  it('detects TODO comments in diff', async () => {
    const { result } = renderHook(() => useAIReview());

    await act(async () => {
      const promise = result.current.review('diff --git a/test.ts\n+// TODO: fix this');
      await vi.runAllTimersAsync();
      await promise;
    });

    const suggestion = result.current.summary?.suggestions.find(
      s => s.id === 'todo-comment'
    );
    expect(suggestion).toBeDefined();
    expect(suggestion?.type).toBe('question');
  });

  it('detects TypeScript any type', async () => {
    const { result } = renderHook(() => useAIReview());

    await act(async () => {
      const promise = result.current.review('diff --git a/test.ts\n+const x: any = 1');
      await vi.runAllTimersAsync();
      await promise;
    });

    const suggestion = result.current.summary?.suggestions.find(
      s => s.id === 'typescript-any'
    );
    expect(suggestion).toBeDefined();
    expect(suggestion?.type).toBe('improvement');
  });

  it('calculates score based on suggestions', async () => {
    const { result } = renderHook(() => useAIReview());

    await act(async () => {
      // Clean diff with no issues
      const promise = result.current.review('diff --git a/test.ts\n+const x = 1;');
      await vi.runAllTimersAsync();
      await promise;
    });

    expect(result.current.summary?.overallScore).toBe(100);
    expect(result.current.summary?.riskLevel).toBe('low');
  });

  it('counts reviewed files', async () => {
    const { result } = renderHook(() => useAIReview());

    const diff = `diff --git a/file1.ts
+line1
diff --git a/file2.ts
+line2
diff --git a/file3.ts
+line3`;

    await act(async () => {
      const promise = result.current.review(diff);
      await vi.runAllTimersAsync();
      await promise;
    });

    expect(result.current.summary?.reviewedFiles).toBe(3);
  });

  it('counts line changes', async () => {
    const { result } = renderHook(() => useAIReview());

    const diff = `diff --git a/test.ts
+added line 1
+added line 2
-removed line 1`;

    await act(async () => {
      const promise = result.current.review(diff);
      await vi.runAllTimersAsync();
      await promise;
    });

    expect(result.current.summary?.totalLines).toBe(3);
  });
});

describe('getSeverityColor', () => {
  it('returns red for critical', () => {
    expect(getSeverityColor('critical')).toBe('#f7768e');
  });

  it('returns orange for major', () => {
    expect(getSeverityColor('major')).toBe('#ff9e64');
  });

  it('returns yellow for minor', () => {
    expect(getSeverityColor('minor')).toBe('#e0af68');
  });

  it('returns blue for suggestion', () => {
    expect(getSeverityColor('suggestion')).toBe('#7aa2f7');
  });
});

describe('getSuggestionIcon', () => {
  it('returns bug emoji for bug', () => {
    expect(getSuggestionIcon('bug')).toBe('🐛');
  });

  it('returns lock emoji for security', () => {
    expect(getSuggestionIcon('security')).toBe('🔒');
  });

  it('returns lightning emoji for performance', () => {
    expect(getSuggestionIcon('performance')).toBe('⚡');
  });

  it('returns palette emoji for style', () => {
    expect(getSuggestionIcon('style')).toBe('🎨');
  });

  it('returns question emoji for question', () => {
    expect(getSuggestionIcon('question')).toBe('❓');
  });

  it('returns lightbulb for improvement', () => {
    expect(getSuggestionIcon('improvement')).toBe('💡');
  });
});

describe('getRiskLevelColor', () => {
  it('returns red for high risk', () => {
    expect(getRiskLevelColor('high')).toBe('#f7768e');
  });

  it('returns yellow for medium risk', () => {
    expect(getRiskLevelColor('medium')).toBe('#e0af68');
  });

  it('returns green for low risk', () => {
    expect(getRiskLevelColor('low')).toBe('#9ece6a');
  });
});

describe('formatScoreGrade', () => {
  it('returns A for 90+', () => {
    expect(formatScoreGrade(100)).toBe('A');
    expect(formatScoreGrade(95)).toBe('A');
    expect(formatScoreGrade(90)).toBe('A');
  });

  it('returns B for 80-89', () => {
    expect(formatScoreGrade(89)).toBe('B');
    expect(formatScoreGrade(85)).toBe('B');
    expect(formatScoreGrade(80)).toBe('B');
  });

  it('returns C for 70-79', () => {
    expect(formatScoreGrade(79)).toBe('C');
    expect(formatScoreGrade(75)).toBe('C');
    expect(formatScoreGrade(70)).toBe('C');
  });

  it('returns D for 60-69', () => {
    expect(formatScoreGrade(69)).toBe('D');
    expect(formatScoreGrade(65)).toBe('D');
    expect(formatScoreGrade(60)).toBe('D');
  });

  it('returns F for below 60', () => {
    expect(formatScoreGrade(59)).toBe('F');
    expect(formatScoreGrade(50)).toBe('F');
    expect(formatScoreGrade(0)).toBe('F');
  });
});

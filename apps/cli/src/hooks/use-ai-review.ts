import { useState, useCallback } from 'react';

export type AIReviewStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AIReviewSuggestion {
  id: string;
  type: 'improvement' | 'bug' | 'security' | 'performance' | 'style' | 'question';
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  file: string;
  line?: number;
  endLine?: number;
  title: string;
  description: string;
  suggestedFix?: string;
}

export interface AIReviewSummary {
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  summary: string;
  strengths: string[];
  concerns: string[];
  suggestions: AIReviewSuggestion[];
  reviewedFiles: number;
  totalLines: number;
}

export interface AIReviewOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  focusAreas?: ('security' | 'performance' | 'style' | 'bugs')[];
}

export interface UseAIReviewResult {
  status: AIReviewStatus;
  summary: AIReviewSummary | null;
  error: string | null;
  progress: number;
  review: (diff: string, options?: AIReviewOptions) => Promise<AIReviewSummary>;
  reset: () => void;
  abort: () => void;
}

/**
 * Hook for AI-powered code review
 */
export function useAIReview(): UseAIReviewResult {
  const [status, setStatus] = useState<AIReviewStatus>('idle');
  const [summary, setSummary] = useState<AIReviewSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const review = useCallback(async (diff: string, options: AIReviewOptions = {}): Promise<AIReviewSummary> => {
    const controller = new AbortController();
    setAbortController(controller);
    setStatus('loading');
    setError(null);
    setProgress(0);

    try {
      // Simulate progress for demo (real implementation would use streaming)
      setProgress(10);

      // This is a placeholder - real implementation would call AI API
      const result = await simulateAIReview(diff, options, controller.signal, setProgress);

      setSummary(result);
      setStatus('success');
      setProgress(100);

      return result;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setError('Review cancelled');
      } else {
        setError(err instanceof Error ? err.message : 'AI review failed');
      }
      setStatus('error');
      throw err;
    } finally {
      setAbortController(null);
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setSummary(null);
    setError(null);
    setProgress(0);
  }, []);

  const abort = useCallback(() => {
    abortController?.abort();
    setStatus('idle');
    setProgress(0);
  }, [abortController]);

  return {
    status,
    summary,
    error,
    progress,
    review,
    reset,
    abort,
  };
}

/**
 * Simulate AI review (placeholder for real implementation)
 */
async function simulateAIReview(
  diff: string,
  options: AIReviewOptions,
  signal: AbortSignal,
  onProgress: (progress: number) => void
): Promise<AIReviewSummary> {
  // Parse diff to count files and lines
  const files = (diff.match(/^diff --git/gm) || []).length;
  const addedLines = (diff.match(/^\+[^+]/gm) || []).length;
  const removedLines = (diff.match(/^-[^-]/gm) || []).length;
  const totalLines = addedLines + removedLines;

  // Simulate processing delay
  for (let i = 20; i <= 90; i += 10) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    await delay(100);
    onProgress(i);
  }

  // Generate mock suggestions based on diff content
  const suggestions: AIReviewSuggestion[] = [];

  if (diff.includes('console.log')) {
    suggestions.push({
      id: 'console-log',
      type: 'style',
      severity: 'minor',
      file: 'unknown',
      title: 'Debug statement found',
      description: 'Remove console.log statements before merging to production.',
    });
  }

  if (diff.includes('TODO') || diff.includes('FIXME')) {
    suggestions.push({
      id: 'todo-comment',
      type: 'question',
      severity: 'suggestion',
      file: 'unknown',
      title: 'TODO/FIXME comment found',
      description: 'Consider addressing TODO comments before merging.',
    });
  }

  if (diff.includes('any')) {
    suggestions.push({
      id: 'typescript-any',
      type: 'improvement',
      severity: 'minor',
      file: 'unknown',
      title: 'TypeScript any type used',
      description: 'Consider using a more specific type instead of any.',
    });
  }

  // Calculate score based on suggestions
  const criticalCount = suggestions.filter(s => s.severity === 'critical').length;
  const majorCount = suggestions.filter(s => s.severity === 'major').length;
  const minorCount = suggestions.filter(s => s.severity === 'minor').length;

  const score = Math.max(0, 100 - criticalCount * 30 - majorCount * 15 - minorCount * 5);
  const riskLevel: AIReviewSummary['riskLevel'] =
    criticalCount > 0 ? 'high' : majorCount > 0 ? 'medium' : 'low';

  return {
    overallScore: score,
    riskLevel,
    summary: `Reviewed ${files} file(s) with ${totalLines} line changes. Found ${suggestions.length} suggestion(s).`,
    strengths: [
      'Code follows consistent formatting',
      'Good use of TypeScript types',
    ],
    concerns: suggestions.length > 0
      ? suggestions.map(s => s.title)
      : ['No major concerns found'],
    suggestions,
    reviewedFiles: files,
    totalLines,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get color for severity level
 */
export function getSeverityColor(severity: AIReviewSuggestion['severity']): string {
  switch (severity) {
    case 'critical':
      return '#f7768e'; // red
    case 'major':
      return '#ff9e64'; // orange
    case 'minor':
      return '#e0af68'; // yellow
    default:
      return '#7aa2f7'; // blue
  }
}

/**
 * Get icon for suggestion type
 */
export function getSuggestionIcon(type: AIReviewSuggestion['type']): string {
  switch (type) {
    case 'bug':
      return '🐛';
    case 'security':
      return '🔒';
    case 'performance':
      return '⚡';
    case 'style':
      return '🎨';
    case 'question':
      return '❓';
    default:
      return '💡';
  }
}

/**
 * Get color for risk level
 */
export function getRiskLevelColor(level: AIReviewSummary['riskLevel']): string {
  switch (level) {
    case 'high':
      return '#f7768e'; // red
    case 'medium':
      return '#e0af68'; // yellow
    default:
      return '#9ece6a'; // green
  }
}

/**
 * Format score as letter grade
 */
export function formatScoreGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

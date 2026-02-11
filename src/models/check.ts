import { Schema as S } from 'effect'

export class CheckRun extends S.Class<CheckRun>('CheckRun')({
  id: S.Number,
  name: S.String,
  status: S.Literal('queued', 'in_progress', 'completed'),
  conclusion: S.optionalWith(
    S.NullOr(
      S.Literal(
        'success',
        'failure',
        'neutral',
        'cancelled',
        'skipped',
        'timed_out',
        'action_required',
        'stale',
      ),
    ),
    { default: () => null },
  ),
  html_url: S.optionalWith(S.NullOr(S.String), { default: () => null }),
}) {}

export class CheckRunsResponse extends S.Class<CheckRunsResponse>('CheckRunsResponse')({
  total_count: S.Number,
  check_runs: S.Array(CheckRun),
}) {}

export class StatusContext extends S.Class<StatusContext>('StatusContext')({
  id: S.Number,
  state: S.Literal('error', 'failure', 'pending', 'success'),
  context: S.String,
  description: S.optionalWith(S.NullOr(S.String), { default: () => null }),
  target_url: S.optionalWith(S.NullOr(S.String), { default: () => null }),
}) {}

export class CombinedStatus extends S.Class<CombinedStatus>('CombinedStatus')({
  state: S.Literal('failure', 'pending', 'success'),
  total_count: S.Number,
  statuses: S.Array(StatusContext),
}) {}

export type CheckConclusion = 'success' | 'failure' | 'pending' | 'neutral'

export function summarizeChecks(
  checkRuns: readonly CheckRun[],
): {
  readonly conclusion: CheckConclusion
  readonly passed: number
  readonly failed: number
  readonly pending: number
  readonly total: number
} {
  let passed = 0
  let failed = 0
  let pending = 0

  for (const run of checkRuns) {
    if (run.status !== 'completed') {
      pending += 1
    } else if (run.conclusion === 'success' || run.conclusion === 'neutral' || run.conclusion === 'skipped') {
      passed += 1
    } else {
      failed += 1
    }
  }

  const total = checkRuns.length
  const conclusion: CheckConclusion =
    failed > 0
      ? 'failure'
      : pending > 0
        ? 'pending'
        : total === 0
          ? 'neutral'
          : 'success'

  return { conclusion, passed, failed, pending, total }
}

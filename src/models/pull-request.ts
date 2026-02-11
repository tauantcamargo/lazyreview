import { Schema as S } from 'effect'
import { User } from './user'

export class Label extends S.Class<Label>('Label')({
  id: S.Number,
  name: S.String,
  color: S.String,
  description: S.optionalWith(S.NullOr(S.String), { default: () => null }),
}) {}

export class BranchRef extends S.Class<BranchRef>('BranchRef')({
  ref: S.optionalWith(S.String, { default: () => '' }),
  sha: S.optionalWith(S.String, { default: () => '' }),
  label: S.optional(S.String),
}) {}

export class PullRequest extends S.Class<PullRequest>('PullRequest')({
  id: S.Number,
  number: S.Number,
  title: S.String,
  body: S.optionalWith(S.NullOr(S.String), { default: () => null }),
  state: S.Literal('open', 'closed'),
  draft: S.optionalWith(S.Boolean, { default: () => false }),
  merged: S.optionalWith(S.Boolean, { default: () => false }),
  user: User,
  labels: S.optionalWith(S.Array(Label), { default: () => [] }),
  created_at: S.String,
  updated_at: S.String,
  merged_at: S.optionalWith(S.NullOr(S.String), { default: () => null }),
  closed_at: S.optionalWith(S.NullOr(S.String), { default: () => null }),
  html_url: S.String,
  head: S.optionalWith(BranchRef, { default: () => new BranchRef({ ref: '', sha: '' }) }),
  base: S.optionalWith(BranchRef, { default: () => new BranchRef({ ref: '', sha: '' }) }),
  additions: S.optionalWith(S.Number, { default: () => 0 }),
  deletions: S.optionalWith(S.Number, { default: () => 0 }),
  changed_files: S.optionalWith(S.Number, { default: () => 0 }),
  comments: S.optionalWith(S.Number, { default: () => 0 }),
  review_comments: S.optionalWith(S.Number, { default: () => 0 }),
  requested_reviewers: S.optionalWith(S.Array(User), { default: () => [] }),
  assignees: S.optionalWith(S.Array(User), { default: () => [] }),
  mergeable: S.optionalWith(S.NullOr(S.Boolean), { default: () => null }),
  mergeable_state: S.optionalWith(S.NullOr(S.String), { default: () => null }),
  merge_commit_sha: S.optionalWith(S.NullOr(S.String), { default: () => null }),
}) {}

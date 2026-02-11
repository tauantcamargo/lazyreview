import { Schema as S } from 'effect'

export class FileChange extends S.Class<FileChange>('FileChange')({
  sha: S.String,
  filename: S.String,
  status: S.Literal(
    'added',
    'removed',
    'modified',
    'renamed',
    'copied',
    'changed',
    'unchanged',
  ),
  additions: S.Number,
  deletions: S.Number,
  changes: S.Number,
  patch: S.optional(S.String),
  previous_filename: S.optional(S.String),
  blob_url: S.optional(S.String),
  raw_url: S.optional(S.String),
}) {}

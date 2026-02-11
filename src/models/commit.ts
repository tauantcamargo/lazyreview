import { Schema as S } from 'effect'
import { User } from './user'

export class CommitAuthor extends S.Class<CommitAuthor>('CommitAuthor')({
  name: S.String,
  email: S.String,
  date: S.String,
}) {}

export class CommitDetails extends S.Class<CommitDetails>('CommitDetails')({
  message: S.String,
  author: CommitAuthor,
}) {}

export class Commit extends S.Class<Commit>('Commit')({
  sha: S.String,
  commit: CommitDetails,
  author: S.optionalWith(S.NullOr(User), { default: () => null }),
  html_url: S.String,
}) {}

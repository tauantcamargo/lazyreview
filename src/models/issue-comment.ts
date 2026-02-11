import { Schema as S } from 'effect'
import { User } from './user'

export class IssueComment extends S.Class<IssueComment>('IssueComment')({
  id: S.Number,
  node_id: S.optional(S.String),
  body: S.String,
  user: User,
  created_at: S.String,
  updated_at: S.String,
  html_url: S.String,
}) {}

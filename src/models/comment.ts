import { Schema as S } from 'effect'
import { User } from './user'

export class Comment extends S.Class<Comment>('Comment')({
  id: S.Number,
  node_id: S.optional(S.String),
  body: S.String,
  user: User,
  created_at: S.String,
  updated_at: S.String,
  html_url: S.String,
  path: S.optional(S.String),
  line: S.optional(S.NullOr(S.Number)),
  side: S.optional(S.Literal('LEFT', 'RIGHT')),
  in_reply_to_id: S.optional(S.Number),
}) {}

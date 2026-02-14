import { Schema as S } from 'effect'
import { User } from './user'

export const ReactionCountsSchema = S.Struct({
  '+1': S.optionalWith(S.Number, { default: () => 0 }),
  '-1': S.optionalWith(S.Number, { default: () => 0 }),
  laugh: S.optionalWith(S.Number, { default: () => 0 }),
  hooray: S.optionalWith(S.Number, { default: () => 0 }),
  confused: S.optionalWith(S.Number, { default: () => 0 }),
  heart: S.optionalWith(S.Number, { default: () => 0 }),
  rocket: S.optionalWith(S.Number, { default: () => 0 }),
  eyes: S.optionalWith(S.Number, { default: () => 0 }),
  total_count: S.optionalWith(S.Number, { default: () => 0 }),
})

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
  reactions: S.optional(ReactionCountsSchema),
}) {}

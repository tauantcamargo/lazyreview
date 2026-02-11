import { Schema as S } from 'effect'
import { User } from './user'

export class Review extends S.Class<Review>('Review')({
  id: S.Number,
  user: User,
  body: S.optionalWith(S.NullOr(S.String), { default: () => null }),
  state: S.Literal(
    'APPROVED',
    'CHANGES_REQUESTED',
    'COMMENTED',
    'DISMISSED',
    'PENDING',
  ),
  submitted_at: S.optionalWith(S.NullOr(S.String), { default: () => null }),
  html_url: S.String,
}) {}

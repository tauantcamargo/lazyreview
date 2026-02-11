import { Schema as S } from 'effect'

export class User extends S.Class<User>('User')({
  login: S.String,
  id: S.Number,
  avatar_url: S.String,
  html_url: S.String,
  type: S.optionalWith(S.String, { default: () => 'User' }),
}) {}

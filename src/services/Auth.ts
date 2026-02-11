import { Context, Effect, Layer, Schema as S } from 'effect'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { AuthError } from '../models/errors'
import { User } from '../models/user'

const execFileAsync = promisify(execFile)

export interface AuthService {
  readonly getToken: () => Effect.Effect<string, AuthError>
  readonly getUser: () => Effect.Effect<User, AuthError>
  readonly isAuthenticated: () => Effect.Effect<boolean, AuthError>
}

export class Auth extends Context.Tag('Auth')<Auth, AuthService>() {}

function resolveToken(): Effect.Effect<string, AuthError> {
  return Effect.gen(function* () {
    const envToken = process.env['GITHUB_TOKEN']
    if (envToken) return envToken

    const ghResult = yield* Effect.tryPromise({
      try: async () => {
        const { stdout } = await execFileAsync('gh', ['auth', 'token'])
        return stdout.trim()
      },
      catch: () =>
        new AuthError({
          message: 'No GitHub token found. Set GITHUB_TOKEN or install gh CLI.',
          reason: 'no_token',
        }),
    })

    if (!ghResult) {
      return yield* Effect.fail(
        new AuthError({
          message: 'No GitHub token found. Set GITHUB_TOKEN or install gh CLI.',
          reason: 'no_token',
        }),
      )
    }

    return ghResult
  })
}

export const AuthLive = Layer.succeed(
  Auth,
  Auth.of({
    getToken: resolveToken,

    getUser: () =>
      Effect.gen(function* () {
        const token = yield* resolveToken()

        const user = yield* Effect.tryPromise({
          try: async () => {
            const response = await fetch('https://api.github.com/user', {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
              },
            })

            if (!response.ok) {
              throw new Error(`GitHub API returned ${response.status}`)
            }

            const data = await response.json()
            return S.decodeUnknownSync(User)(data)
          },
          catch: (error) =>
            new AuthError({
              message: `Failed to get user: ${String(error)}`,
              reason: 'invalid_token',
            }),
        })

        return user
      }),

    isAuthenticated: () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(resolveToken())
        return result._tag === 'Right'
      }),
  }),
)

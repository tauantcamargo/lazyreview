import { Context, Effect, Layer, Schema as S } from 'effect'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, readFile, access } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { AuthError } from '../models/errors'
import { User } from '../models/user'

const execFileAsync = promisify(execFile)

// In-memory token storage for current session
let sessionToken: string | null = null

export interface AuthService {
  readonly getToken: () => Effect.Effect<string, AuthError>
  readonly getUser: () => Effect.Effect<User, AuthError>
  readonly isAuthenticated: () => Effect.Effect<boolean, AuthError>
  readonly setToken: (token: string) => Effect.Effect<void, AuthError>
  readonly saveTokenToShell: (token: string) => Effect.Effect<void, AuthError>
}

export class Auth extends Context.Tag('Auth')<Auth, AuthService>() {}

function resolveToken(): Effect.Effect<string, AuthError> {
  return Effect.gen(function* () {
    // Check session token first (set via setToken)
    if (sessionToken) return sessionToken

    // Check environment variable (prefer LAZYREVIEW_GITHUB_TOKEN, fallback to GITHUB_TOKEN)
    const envToken =
      process.env['LAZYREVIEW_GITHUB_TOKEN'] ?? process.env['GITHUB_TOKEN']
    if (envToken) return envToken

    // Try gh CLI
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

async function detectShellProfile(): Promise<string> {
  const home = homedir()
  const shell = process.env['SHELL'] ?? ''

  // Check for common shell profile files
  const profiles = shell.includes('zsh')
    ? ['.zshrc', '.zprofile', '.zshenv']
    : ['.bashrc', '.bash_profile', '.profile']

  for (const profile of profiles) {
    const profilePath = join(home, profile)
    try {
      await access(profilePath)
      return profilePath
    } catch {
      // File doesn't exist, try next
    }
  }

  // Default to .bashrc or .zshrc based on shell
  return join(home, shell.includes('zsh') ? '.zshrc' : '.bashrc')
}

async function appendToShellProfile(token: string): Promise<void> {
  const profilePath = await detectShellProfile()

  // Read existing content
  let content = ''
  try {
    content = await readFile(profilePath, 'utf-8')
  } catch {
    // File doesn't exist, will create new
  }

  // Check if LAZYREVIEW_GITHUB_TOKEN is already set
  if (content.includes('export LAZYREVIEW_GITHUB_TOKEN=')) {
    // Replace existing token
    content = content.replace(
      /export LAZYREVIEW_GITHUB_TOKEN=["']?[^"'\n]*["']?/g,
      `export LAZYREVIEW_GITHUB_TOKEN="${token}"`,
    )
  } else {
    // Append new token
    const newLine = content.endsWith('\n') ? '' : '\n'
    content += `${newLine}\n# GitHub token for LazyReview\nexport LAZYREVIEW_GITHUB_TOKEN="${token}"\n`
  }

  await writeFile(profilePath, content, 'utf-8')
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

    setToken: (token: string) =>
      Effect.sync(() => {
        sessionToken = token
        // Also set in process.env for child processes
        process.env['LAZYREVIEW_GITHUB_TOKEN'] = token
      }),

    saveTokenToShell: (token: string) =>
      Effect.tryPromise({
        try: () => appendToShellProfile(token),
        catch: (error) =>
          new AuthError({
            message: `Failed to save token to shell profile: ${String(error)}`,
            reason: 'save_failed',
          }),
      }),
  }),
)

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g

const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  400: 'Bad request',
  401: 'Authentication failed',
  403: 'Permission denied',
  404: 'Resource not found',
  409: 'Conflict',
  422: 'Validation failed',
  429: 'Rate limit exceeded',
  500: 'Internal server error',
  502: 'Bad gateway',
  503: 'Service unavailable',
}

export function sanitizeApiError(status: number, statusText: string): string {
  return STATUS_MESSAGES[status] ?? `HTTP ${status} ${statusText}`
}

export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '')
}

const OWNER_REPO_REGEX = /^[a-zA-Z0-9._-]+$/

export function validateOwner(value: string): string {
  if (!OWNER_REPO_REGEX.test(value)) {
    throw new Error(`Invalid owner: ${value}`)
  }
  return value
}

export function validateRepo(value: string): string {
  if (!OWNER_REPO_REGEX.test(value)) {
    throw new Error(`Invalid repo: ${value}`)
  }
  return value
}

export function validateNumber(value: number): number {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(`Invalid number: ${value}`)
  }
  return value
}

export function validateRef(value: string): string {
  if (!/^[a-fA-F0-9]+$/.test(value)) {
    throw new Error(`Invalid ref: ${value}`)
  }
  return value
}

const VALID_TOKEN_PREFIXES = ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_']

export function isValidGitHubToken(token: string): boolean {
  if (token.length < 10 || token.length > 255) return false
  return VALID_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix))
}

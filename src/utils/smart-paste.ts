/**
 * Smart paste detection and formatting for MultiLineInput.
 *
 * Detects pasted content type (code block, inline code, URL, plain text)
 * and auto-formats it as appropriate markdown.
 */

export type PasteType = 'code-block' | 'inline-code' | 'url' | 'plain'

// ---------------------------------------------------------------------------
// Code-like pattern matchers
// ---------------------------------------------------------------------------

/** Patterns that indicate code content. */
const CODE_KEYWORDS: readonly RegExp[] = [
  /\bfunction\b/,
  /\bconst\b/,
  /\blet\b/,
  /\bvar\b/,
  /\bimport\b/,
  /\bexport\b/,
  /\breturn\b/,
  /\bclass\b/,
  /\binterface\b/,
  /=>/,
]

/** Characters that strongly suggest code. */
const CODE_CHARS: readonly RegExp[] = [
  /[{}]/,
  /;\s*$/m,
]

/**
 * Check if text has code-like characteristics.
 * Returns true if the text matches enough code indicators.
 */
function hasCodeSignals(text: string): boolean {
  const keywordHits = CODE_KEYWORDS.filter((re) => re.test(text)).length
  const charHits = CODE_CHARS.filter((re) => re.test(text)).length

  return keywordHits >= 1 || charHits >= 1
}

/**
 * Check if multi-line text has significant indentation
 * (at least 30% of non-empty lines start with whitespace).
 */
function hasSignificantIndentation(text: string): boolean {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length < 2) return false

  const indentedCount = lines.filter((l) => /^\s{2,}/.test(l)).length
  return indentedCount / lines.length >= 0.3
}

// ---------------------------------------------------------------------------
// URL detection
// ---------------------------------------------------------------------------

const URL_PATTERN = /^https?:\/\/\S+$/

function isUrl(text: string): boolean {
  return URL_PATTERN.test(text.trim())
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect what type of content was pasted.
 *
 * - `'code-block'`  -- multi-line code (contains code keywords, braces, indentation)
 * - `'inline-code'` -- single-line code-like content
 * - `'url'`         -- a URL starting with http:// or https://
 * - `'plain'`       -- regular text
 */
export function detectPasteType(text: string): PasteType {
  const trimmed = text.trim()

  if (trimmed.length === 0) return 'plain'

  // URL detection (single line only)
  if (isUrl(trimmed)) return 'url'

  const isMultiLine = trimmed.includes('\n')

  if (isMultiLine) {
    if (hasCodeSignals(trimmed) || hasSignificantIndentation(trimmed)) {
      return 'code-block'
    }
    return 'plain'
  }

  // Single line -- check for inline code signals
  if (hasCodeSignals(trimmed)) {
    return 'inline-code'
  }

  return 'plain'
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

interface LanguageRule {
  readonly language: string
  readonly patterns: readonly RegExp[]
  readonly minMatches: number
}

const LANGUAGE_RULES: readonly LanguageRule[] = [
  // Highly specific -- shebang is unambiguous
  {
    language: 'bash',
    patterns: [/^#!\/bin\/(bash|sh|zsh)/m],
    minMatches: 1,
  },
  // TypeScript before JS/HTML/SQL -- import...from, type annotations are strong signals
  {
    language: 'typescript',
    patterns: [
      /\binterface\s+\w+/,
      /:\s*(string|number|boolean|void|any|unknown|never)\b/,
      /\bimport\b.*\bfrom\b/,
      /\btype\s+\w+\s*=/,
    ],
    minMatches: 1,
  },
  // Rust before Go (fn vs func)
  {
    language: 'rust',
    patterns: [
      /\bfn\s+\w+\s*\(/,
      /\blet\s+mut\b/,
      /\bimpl\s+\w+/,
      /\bpub\s+fn\b/,
    ],
    minMatches: 1,
  },
  {
    language: 'go',
    patterns: [
      /\bfunc\s+\w+\s*\(/,
      /\bpackage\s+\w+/,
      /\bfmt\.\w+/,
    ],
    minMatches: 1,
  },
  // Python before generic languages
  {
    language: 'python',
    patterns: [
      /\bdef\s+\w+\s*\(/,
      /\bclass\s+\w+.*:/,
      /\bprint\s*\(/,
      /\bself\b/,
    ],
    minMatches: 1,
  },
  // CSS requires 2 matches to avoid false positives
  {
    language: 'css',
    patterns: [/[.#][a-zA-Z][\w-]*\s*\{/, /:\s*[a-zA-Z-]+;/],
    minMatches: 2,
  },
  // SQL requires both a DML keyword AND a clause keyword
  {
    language: 'sql',
    patterns: [
      /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i,
      /\b(FROM|WHERE|JOIN|GROUP\s+BY|ORDER\s+BY|INTO|VALUES)\b/i,
    ],
    minMatches: 2,
  },
  // JSON needs both structure and key pattern
  {
    language: 'json',
    patterns: [/^\s*[\[{]/, /"\w+"\s*:/],
    minMatches: 2,
  },
  // HTML -- requires opening AND closing tags or multiple tags to avoid JSX false positives
  {
    language: 'html',
    patterns: [/<\/[a-zA-Z][a-zA-Z0-9]*\s*>/, /<[a-zA-Z][a-zA-Z0-9]*[\s>]/],
    minMatches: 2,
  },
  {
    language: 'javascript',
    patterns: [
      /\bfunction\s+\w+/,
      /\bconst\s+\w+\s*=/,
      /\blet\s+\w+\s*=/,
      /\bvar\s+\w+\s*=/,
      /=>/,
      /\brequire\s*\(/,
    ],
    minMatches: 1,
  },
]

/**
 * Detect the programming language of a code snippet.
 * Returns the language identifier or null if unrecognizable.
 *
 * Rules are ordered by specificity -- more specific languages
 * (TypeScript, Rust, Go) are checked before generic ones (JavaScript).
 */
export function detectLanguage(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed.length === 0) return null

  for (const rule of LANGUAGE_RULES) {
    const matchCount = rule.patterns.filter((re) => re.test(trimmed)).length
    if (matchCount >= rule.minMatches) {
      return rule.language
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Format paste
// ---------------------------------------------------------------------------

/**
 * Format pasted text as appropriate markdown based on detected content type.
 *
 * - Code blocks: wrapped in triple-backtick fence with detected language
 * - URLs: wrapped in markdown link `[url](url)`
 * - Inline code: wrapped in single backticks
 * - Plain text: returned unchanged
 */
export function formatPaste(text: string): string {
  const pasteType = detectPasteType(text)

  switch (pasteType) {
    case 'code-block': {
      const lang = detectLanguage(text) ?? ''
      const trimmed = text.endsWith('\n') ? text : `${text}\n`
      return `\`\`\`${lang}\n${trimmed}\`\`\`\n`
    }
    case 'url': {
      const url = text.trim()
      return `[${url}](${url})`
    }
    case 'inline-code': {
      return `\`${text}\``
    }
    case 'plain':
    default:
      return text
  }
}

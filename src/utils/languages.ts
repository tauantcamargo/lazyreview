/**
 * Maps file extensions and special filenames to syntax highlighting language identifiers.
 * Used by DiffView and SideBySideDiffView for code highlighting.
 */

/** Extension-to-language mapping (lowercase keys). */
const EXTENSION_MAP: Readonly<Record<string, string>> = {
  // JavaScript / TypeScript
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',

  // Web
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  graphql: 'graphql',
  gql: 'graphql',

  // Data / Config
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  svg: 'xml',
  xsl: 'xml',
  ini: 'ini',
  cfg: 'ini',
  env: 'ini',
  properties: 'ini',
  proto: 'protobuf',

  // Markup / Documentation
  md: 'markdown',
  mdx: 'markdown',
  tex: 'latex',

  // Systems languages
  py: 'python',
  pyi: 'python',
  go: 'go',
  rs: 'rust',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  java: 'java',
  cs: 'csharp',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  scala: 'scala',
  dart: 'dart',

  // Scripting languages
  rb: 'ruby',
  gemspec: 'ruby',
  php: 'php',
  pl: 'perl',
  pm: 'perl',
  lua: 'lua',
  r: 'r',

  // Functional languages
  ex: 'elixir',
  exs: 'elixir',
  clj: 'clojure',
  cljs: 'clojure',
  cljc: 'clojure',
  hs: 'haskell',
  erl: 'erlang',

  // Shell / DevOps
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  ps1: 'powershell',
  sql: 'sql',
  dockerfile: 'dockerfile',
  tf: 'hcl',
  hcl: 'hcl',
  tfvars: 'hcl',
  groovy: 'groovy',
  gradle: 'groovy',
}

/** Filename suffixes for ignore-style dotfiles (treated as yaml for highlighting). */
const IGNORE_SUFFIXES: readonly string[] = [
  '.gitignore',
  '.dockerignore',
  '.eslintignore',
  '.prettierignore',
]

/**
 * Determine the syntax highlighting language for a given filename.
 * Handles extension-based lookup, special filenames (Dockerfile, Makefile),
 * and common dotfile patterns. Extension matching is case-insensitive.
 *
 * @param filename - The file path or filename (e.g. "src/App.tsx" or "Dockerfile.dev")
 * @returns The language identifier string, or undefined if unrecognized
 */
export function getLanguageFromFilename(
  filename: string,
): string | undefined {
  if (filename === '') return undefined

  const basename = filename.split('/').pop() ?? ''

  // Special filenames: Dockerfile (including Dockerfile.dev, Dockerfile.prod, etc.)
  if (basename === 'Dockerfile' || basename.startsWith('Dockerfile.')) {
    return 'dockerfile'
  }

  // Special filenames: Makefile / GNUmakefile
  if (basename === 'Makefile' || basename === 'GNUmakefile') {
    return 'makefile'
  }

  // Ignore-style dotfiles
  for (const suffix of IGNORE_SUFFIXES) {
    if (basename.endsWith(suffix)) {
      return 'yaml'
    }
  }

  // Extension-based lookup
  const ext = basename.split('.').pop()?.toLowerCase()
  return ext ? EXTENSION_MAP[ext] : undefined
}

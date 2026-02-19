/**
 * Short provider badge label for the status area.
 * Returns a badge like [GH], [GL], [BB], [AZ], [GT].
 * Returns empty string when provider is unknown or undefined.
 */
export function providerBadge(provider: string | undefined): string {
  const badges: Readonly<Record<string, string>> = {
    github: '[GH]',
    gitlab: '[GL]',
    bitbucket: '[BB]',
    azure: '[AZ]',
    gitea: '[GT]',
  }
  return provider ? (badges[provider] ?? '') : ''
}

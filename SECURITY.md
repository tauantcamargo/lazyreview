# Security Policy

## Reporting a Vulnerability

LazyReview handles authentication tokens for multiple git hosting providers. We take security seriously.

If you discover a security vulnerability, please report it responsibly:

1. Do NOT open a public issue
2. Email the maintainer via GitHub (open a private security advisory)
3. Include steps to reproduce if possible

## Response Timeline

- 48 hours: Acknowledgment of your report
- 7 days: Initial assessment and severity classification
- 30 days: Fix deployed for critical/high severity issues

## Scope

Security issues we care about:
- Token storage and handling vulnerabilities
- Authentication bypass or token leakage
- API communication security
- Config file injection or manipulation
- Command injection via git operations
- Sensitive data in error messages or logs

## Token Storage

LazyReview stores tokens in ~/.config/lazyreview/tokens/ with file permissions 0o600 (owner read/write only). Tokens are never logged, displayed in the UI (beyond masked hints), or transmitted to any service other than the configured provider API.

## Supported Versions

Only the latest version receives security updates. Please keep your installation current.

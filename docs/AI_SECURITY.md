# AI Provider Security Documentation

This document describes the security measures implemented in LazyReview's AI integration and provides guidelines for safe usage.

## Table of Contents

1. [Overview](#overview)
2. [API Key Security](#api-key-security)
3. [Prompt Security](#prompt-security)
4. [Cost Controls](#cost-controls)
5. [Rate Limiting](#rate-limiting)
6. [Audit Logging](#audit-logging)
7. [Security Checklist](#security-checklist)
8. [Best Practices](#best-practices)

---

## Overview

LazyReview integrates with three AI providers for code review assistance:

| Provider   | Authentication | API Key Environment Variable |
|------------|----------------|------------------------------|
| OpenAI     | API Key        | `LAZYREVIEW_AI_API_KEY`      |
| Anthropic  | API Key        | `ANTHROPIC_API_KEY`          |
| Ollama     | None (local)   | N/A                          |

---

## API Key Security

### Storage Mechanisms

API keys are stored securely using the following priority order:

1. **OS Keyring (Primary)** - Uses native credential storage:
   - **macOS**: Keychain
   - **Windows**: Credential Manager
   - **Linux**: Secret Service (GNOME Keyring, KWallet)

2. **Environment Variables (Secondary)** - For CI/CD or containerized environments

3. **Encrypted File Fallback** - When keyring is unavailable, uses encrypted file storage in `~/.config/lazyreview/credentials/`

### Key Storage Implementation

```go
// Keys are stored with provider-specific prefixes
func (m *Model) aiProviderKeyStorageKey() string {
    return fmt.Sprintf("ai:%s:token", providerName)
}

// Generic fallback key
func (m *Model) aiKeyStorageKey() string {
    return "ai:api_key"
}
```

### Key Loading Priority

1. Environment variable (`LAZYREVIEW_AI_API_KEY` or `ANTHROPIC_API_KEY`)
2. OS keyring with provider-specific key
3. OS keyring with generic key
4. Fallback storage (SQLite settings table)

### Security Guarantees

- API keys are NEVER logged to console or files
- API keys are NEVER included in error messages
- API keys are NEVER transmitted except to the intended AI provider
- Keyring access times out after 3 seconds to prevent hangs

---

## Prompt Security

### Data Sent to AI Providers

LazyReview sends the following data to AI providers:

| Data Type | Description | Sanitization |
|-----------|-------------|--------------|
| File Path | Name of file being reviewed | None (public info) |
| Diff Content | Git diff of changes | Truncated to 45,000 chars max |
| Strictness Level | Review intensity setting | None (enum value) |

### Truncation Protection

Large diffs are automatically truncated to prevent:
- Excessive API costs
- Timeout errors
- Accidental transmission of large codebases

```go
const maxAIDiffChars = 45000    // Primary limit
const retryAIDiffChars = 22000  // Fallback for timeouts
```

Truncation uses a 70/30 head/tail split to preserve context:
```go
head := (maxChars * 7) / 10  // Keep beginning
tail := maxChars - head       // Keep end
```

### What is NOT Sent

- Full file contents (only diffs)
- Git credentials
- Environment variables
- API keys or secrets
- User authentication tokens
- Repository private metadata

### Prompt Injection Protection

While AI providers have their own protections, LazyReview:
- Does not embed user input directly in system prompts
- Uses structured JSON response parsing
- Falls back to safe defaults on parse failures
- Validates AI decisions against known enum values

---

## Cost Controls

### Monthly Limits

Cost controls are enforced before each AI request:

| Setting | Default | Config Key |
|---------|---------|------------|
| Warning Threshold | $10.00 | `ai.cost_warning_threshold` |
| Monthly Limit | $50.00 | `ai.cost_monthly_limit` |

### Cost Tracking Database

All AI API costs are tracked in SQLite:
- Location: `~/.config/lazyreview/ai_costs.db`
- Records: provider, model, input/output tokens, cost, timestamp

### Cost Checking Flow

```go
// Before each AI request:
exceeded, warning, msg := estimator.CheckThresholds(ctx)
if exceeded {
    return error("Monthly cost limit exceeded")
}
```

### Model Pricing (as of 2025)

| Model | Input/1K | Output/1K |
|-------|----------|-----------|
| gpt-4o-mini | $0.00015 | $0.0006 |
| gpt-4o | $0.005 | $0.015 |
| claude-sonnet-4-5 | $0.003 | $0.015 |
| claude-haiku-4-5 | $0.0008 | $0.004 |
| ollama (local) | $0.00 | $0.00 |

---

## Rate Limiting

### Provider-Side Rate Limits

Each AI provider has its own rate limiting, handled by LazyReview:

| Provider | Rate Limit Handling |
|----------|---------------------|
| OpenAI | Automatic retry with error message |
| Anthropic | Exponential backoff (1s initial, 32s max, 3 retries) |
| Ollama | N/A (local, no rate limiting) |

### Backoff Implementation (Anthropic)

```go
const maxAnthropicRetries = 3
const initialBackoffDelay = 1 * time.Second
const maxBackoffDelay = 32 * time.Second

backoff := time.Duration(float64(initialBackoffDelay) * math.Pow(2, float64(attempt)))
```

### Timeout Settings

| Provider | HTTP Timeout |
|----------|--------------|
| OpenAI | 90 seconds |
| Anthropic | 90 seconds |
| Ollama | 180 seconds |

---

## Audit Logging

### Current Implementation

LazyReview logs AI costs to SQLite with the following fields:

```sql
CREATE TABLE ai_costs (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Viewing Cost History

Query the database directly:
```bash
sqlite3 ~/.config/lazyreview/ai_costs.db "SELECT * FROM ai_costs ORDER BY timestamp DESC LIMIT 10;"
```

### Future Enhancements (Planned)

- Request/response logging (opt-in, with PII redaction)
- Security event logging
- Anomaly detection for unusual API usage
- Integration with SIEM systems

---

## Security Checklist

Before enabling AI features, verify:

- [ ] API keys stored in OS keyring or environment variables (not config files)
- [ ] Monthly cost limits configured appropriately
- [ ] Understanding of what data is sent to AI providers
- [ ] Compliance with organizational data policies
- [ ] Review of AI provider data retention policies

### Configuration Example (Secure)

```yaml
# ~/.config/lazyreview/config.yaml
ai:
  provider: openai
  model: gpt-4o-mini
  enabled: true
  # API key stored via: lazyreview or OS keyring
  # NEVER put api_key in this file!
  cost_warning_threshold: 5.0
  cost_monthly_limit: 20.0
  show_cost_estimate: true
  strictness: standard
```

### Environment Variable Setup

```bash
# For OpenAI
export LAZYREVIEW_AI_PROVIDER=openai
export LAZYREVIEW_AI_API_KEY=sk-proj-...

# For Anthropic
export LAZYREVIEW_AI_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-...

# For Ollama (local, no key needed)
export LAZYREVIEW_AI_PROVIDER=ollama
export LAZYREVIEW_AI_OLLAMA_HOST=http://localhost:11434
```

---

## Best Practices

### 1. Use Ollama for Sensitive Code

For maximum privacy with sensitive or proprietary code:
```bash
export LAZYREVIEW_AI_PROVIDER=ollama
ollama pull codellama
```

Ollama runs entirely locally - no data leaves your machine.

### 2. Set Conservative Cost Limits

Start with low limits and increase as needed:
```yaml
ai:
  cost_warning_threshold: 2.0
  cost_monthly_limit: 10.0
```

### 3. Use Relaxed Strictness for Sensitive Code

Relaxed mode sends minimal context and focuses only on critical issues:
```yaml
ai:
  strictness: relaxed
```

### 4. Review AI Provider Policies

- OpenAI: https://openai.com/policies/api-data-usage-policies
- Anthropic: https://www.anthropic.com/privacy

### 5. Rotate API Keys Regularly

Create new API keys periodically and delete old ones:
1. Generate new key in provider console
2. Update environment variable or keyring
3. Delete old key from provider console

### 6. Monitor Usage

Regularly check:
```bash
# View recent AI usage
sqlite3 ~/.config/lazyreview/ai_costs.db \
  "SELECT strftime('%Y-%m', timestamp) as month, SUM(cost) as total FROM ai_costs GROUP BY month;"
```

---

## Reporting Security Issues

If you discover a security vulnerability in LazyReview's AI integration:

1. **Do not** open a public GitHub issue
2. Email security concerns to the maintainers
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-06 | Initial security documentation |

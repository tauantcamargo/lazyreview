# AI Review Strictness Levels

## Overview

LazyReview supports configurable AI review strictness levels to adjust the depth and scope of code reviews based on repository requirements and team preferences.

## Strictness Levels

### Relaxed

**Focus:** Critical bugs and security only
**Use case:** Large codebases, legacy code, rapid iteration
**Reviews:**
- Critical bugs that could cause crashes or data loss
- Security vulnerabilities (SQL injection, XSS, auth issues)
- Memory leaks or resource exhaustion
- Race conditions or deadlocks

**Ignores:** Style, naming, minor optimizations, documentation (unless security-critical)

### Standard (Default)

**Focus:** Bugs, security, performance, error handling
**Use case:** Most production codebases, balanced review
**Reviews:**
- All critical bugs and security issues
- Performance problems (O(n²) algorithms, inefficient queries)
- Error handling gaps (uncaught exceptions, missing validation)
- Edge cases (null checks, boundary conditions)
- Resource management (unclosed connections)

**Also considers:** Style and naming when significantly impacting readability

### Strict

**Focus:** Comprehensive review including best practices
**Use case:** High-quality codebases, public APIs, critical systems
**Reviews:**
- All critical, security, and performance issues
- Code style and naming conventions
- Documentation quality and completeness
- Best practices and design patterns
- Test coverage and testability
- Maintainability and code clarity
- DRY violations and code duplication
- SOLID principles adherence

**Provides:** Thorough, actionable feedback on all aspects

## Configuration

### Global Default

Set the default strictness level for all repositories:

```yaml
# ~/.config/lazyreview/config.yaml
ai:
  strictness: standard  # relaxed, standard, or strict
```

### Per-Repository Override

Configure different strictness levels for specific repositories:

```yaml
# ~/.config/lazyreview/config.yaml
ai:
  strictness: standard
  repository_strictness:
    golang/go: strict           # High standards for Go stdlib
    torvalds/linux: relaxed     # Focus on critical issues for kernel
    myorg/legacy-app: relaxed   # Less strict for legacy code
    myorg/new-api: strict       # Strict for new API development
```

### Format

Repository keys use the format `owner/repo` and are:
- Case-insensitive (`golang/go` == `GOLANG/GO`)
- Whitespace-trimmed
- Normalized to lowercase internally

## Usage in Code

### Creating a Strictness Resolver

```go
import "lazyreview/internal/ai"

// From config
resolver := ai.NewStrictnessResolver(
    ai.StrictnessStandard,
    []ai.RepositoryStrictnessConfig{
        {Owner: "golang", Repo: "go", Strictness: ai.StrictnessStrict},
        {Owner: "torvalds", Repo: "linux", Strictness: ai.StrictnessRelaxed},
    },
)

// Resolve strictness for a repository
strictness := resolver.Resolve("golang", "go")  // Returns StrictnessStrict
```

### Making a Review Request

```go
import "lazyreview/internal/ai"

req := ai.ReviewRequest{
    FilePath:   "main.go",
    Diff:       diffContent,
    Strictness: ai.StrictnessStrict,
}

response, err := provider.Review(ctx, req)
```

### Runtime Management

```go
// Set override
resolver.SetOverride("myorg", "myrepo", ai.StrictnessRelaxed)

// Remove override
resolver.RemoveOverride("myorg", "myrepo")

// Get all overrides
overrides := resolver.GetOverrides()
```

## Implementation Details

### Prompt Templates

Each strictness level generates different system prompts for the AI:

- **Relaxed:** Instructs AI to focus only on critical and security issues
- **Standard:** Adds performance, error handling, and edge cases
- **Strict:** Adds comprehensive coverage including style and best practices

### Decision Thresholds

The `ShouldRequestChanges` method adjusts when to request changes vs. comment:

| Severity | Relaxed | Standard | Strict |
|----------|---------|----------|--------|
| Critical | ✓       | ✓        | ✓      |
| Security | ✓       | ✓        | ✓      |
| High     | ✗       | ✓        | ✓      |
| Medium   | ✗       | ✗        | ✓      |
| Low      | ✗       | ✗        | ✗      |

### Provider Support

All AI providers respect strictness levels:
- OpenAI (GPT-4, GPT-4o, GPT-4o-mini)
- Anthropic (Claude Opus 4.6, Sonnet 4.5, Haiku 4.5)
- Ollama (CodeLlama, Llama, Mistral)

## Examples

### Example 1: Open Source Project

For a popular open-source library with many contributors:

```yaml
ai:
  strictness: standard  # Default for most repos
  repository_strictness:
    myorg/core-library: strict  # High standards for core code
    myorg/examples: relaxed     # Less strict for example code
```

### Example 2: Enterprise Codebase

For a company with varied codebases:

```yaml
ai:
  strictness: standard
  repository_strictness:
    company/payment-service: strict    # Critical financial code
    company/admin-dashboard: standard  # Standard business logic
    company/legacy-monolith: relaxed   # Large legacy app
```

### Example 3: Individual Developer

For a developer working on personal projects:

```yaml
ai:
  strictness: relaxed  # Quick feedback by default
  repository_strictness:
    me/portfolio-site: strict  # Show off best practices
    me/experiments: relaxed    # Fast iteration
```

## Testing

Run the comprehensive test suite:

```bash
# All strictness tests
go test ./internal/ai -v -run TestStrictness

# Specific test categories
go test ./internal/ai -v -run TestStrictnessLevel_GetSystemPrompt
go test ./internal/ai -v -run TestStrictnessResolver
go test ./internal/ai -v -run TestParseStrictnessLevel
```

## Migration Guide

### Upgrading from Previous Versions

If you're upgrading from a version without strictness levels:

1. **No action required** - Defaults to `standard` which matches previous behavior
2. **Optional:** Add `strictness: standard` to config for explicitness
3. **Optional:** Configure per-repository overrides for specific needs

### Backwards Compatibility

The implementation is fully backwards compatible:
- Missing `strictness` field defaults to `standard`
- Invalid values default to `standard`
- Empty `repository_strictness` map is valid

## Best Practices

1. **Start with standard** - It balances thoroughness and practicality
2. **Use relaxed for legacy** - Focus on critical issues in old code
3. **Use strict for new APIs** - Enforce best practices for public interfaces
4. **Repository-specific tuning** - Different repos have different needs
5. **Review and adjust** - Monitor AI review quality and adjust levels accordingly

## Related Documentation

- [AI Provider Configuration](./ai-providers.md)
- [Cost Management](./cost-management.md)
- [Configuration Reference](../CLAUDE.md)

# Errors Package

Enhanced error handling system with error codes, context-aware suggestions, and beautiful TUI formatting.

## Features

- **Error Codes**: Unique LR-xxx format codes for all error types
- **Error Registry**: Lookup detailed information, help URLs, and context actions
- **Context-Aware Suggestions**: Dynamic suggestions based on runtime context
- **TUI Formatting**: Beautiful box rendering with lipgloss
- **Multiple Formats**: TUI, compact (status bar), and markdown
- **Backward Compatible**: Legacy constructors still work

## Error Code Categories

| Range | Category | Examples |
|-------|----------|----------|
| LR-1xx | Authentication | Token expired, SAML required, insufficient permissions |
| LR-2xx | API Errors | Rate limit, network error, invalid response |
| LR-3xx | Configuration | Invalid config, missing file, provider not found |
| LR-4xx | AI Provider | Provider error, token missing, rate limit |
| LR-5xx | Internal | Unexpected error, storage error |

## Usage Examples

### Creating Errors with Codes

```go
// Create a new error with code
err := errors.NewWithCode(
    errors.ErrCodeAuthRequired,
    "Not authenticated with GitHub",
    "Run: lazyreview auth login --provider github",
    "Check if your token has expired",
)

// Wrap existing error with code
originalErr := fmt.Errorf("connection refused")
err := errors.WrapWithCode(
    originalErr,
    errors.ErrCodeAPINetwork,
    "Failed to connect to API",
    "Check your internet connection",
)
```

### Adding Context

```go
err := errors.NewWithCode(
    errors.ErrCodeAPIRateLimit,
    "Rate limit exceeded",
)

// Add context for dynamic suggestions
err = err.WithContext(map[string]string{
    "provider": "github",
    "reset_time": "2026-02-05 15:30:00",
})

// Context-aware suggestions will include the reset time
suggestions := err.GetContextualSuggestions()
// Returns: ["Rate limit resets at: 2026-02-05 15:30:00", "Wait for reset", "Use caching"]
```

### Formatting for Display

```go
// Format for TUI with beautiful box rendering
formatted := err.FormatTUI()

// Format with custom theme colors (ANSI 256)
formatted := err.FormatTUIWithTheme("196", "81", "240") // red, cyan, gray

// Compact format for status bars
compact := err.FormatCompact()
// Output: [LR-101] Not authenticated

// Markdown format for documentation
markdown := err.FormatMarkdown()
```

### Legacy Constructors (Backward Compatible)

```go
// All legacy constructors now return errors with codes
err := errors.AuthenticationRequired("github")
// err.Code == ErrCodeAuthRequired

err = errors.TokenExpired("gitlab")
// err.Code == ErrCodeAuthTokenExpired

err = errors.RateLimitExceeded("github", "15:30")
// err.Code == ErrCodeAPIRateLimit

err = errors.NetworkError(originalErr)
// err.Code == ErrCodeAPINetwork

err = errors.ConfigurationError("Invalid YAML")
// err.Code == ErrCodeConfigInvalid
```

### Registry Lookup

```go
// Get detailed information about an error code
entry := errors.GetRegistryEntry(errors.ErrCodeAuthRequired)

fmt.Println(entry.Title)       // "Authentication Required"
fmt.Println(entry.Description) // Full description
fmt.Println(entry.HelpURL)     // Documentation URL

// Registry provides context actions for dynamic suggestions
if action, ok := entry.ContextActions["provider"]; ok {
    suggestion := action("github")
    // Returns: "Run: lazyreview auth login --provider github"
}
```

## Error Registry

All error codes are registered with:
- **Title**: Human-readable error name
- **Description**: Detailed explanation of the error
- **HelpURL**: Link to documentation
- **ContextActions**: Functions that generate suggestions based on context

## TUI Formatting

The `FormatTUI()` method renders errors with:
- **Box border**: Rounded border with error-colored accent
- **Error code and title**: Bold, colored header
- **Message**: Clear error description
- **Details**: Underlying error information (if wrapped)
- **Description**: Additional context from registry
- **Suggestions**: Numbered list of actionable fixes (context-aware)
- **Help URL**: Link to documentation

Example output:
```
╭─────────────────────────────────────────────────────────────────╮
│                                                                 │
│  LR-101 - Authentication Required                              │
│                                                                 │
│  Not authenticated with GitHub                                 │
│                                                                 │
│  You need to authenticate with the provider before accessing   │
│  this resource.                                                 │
│                                                                 │
│  How to fix:                                                    │
│    1. Run: lazyreview auth login --provider github             │
│    2. Check if your token has expired                          │
│    3. Verify you have the required scopes/permissions          │
│                                                                 │
│  For more help: https://github.com/tauantcamargo/lazyreview#... │
│                                                                 │
╰─────────────────────────────────────────────────────────────────╯
```

## Testing

Run the test suite:
```bash
go test ./internal/errors/... -v
```

Run examples:
```bash
go test ./internal/errors/... -run Example -v
```

Check coverage (currently 97.6%):
```bash
go test ./internal/errors/... -cover
```

## Files

- `codes.go` - Error code constants
- `errors.go` - ActionableError type and constructors
- `registry.go` - Error registry with detailed information
- `format.go` - Formatting functions (TUI, compact, markdown)
- `errors_test.go` - Core functionality tests
- `format_test.go` - Formatting tests
- `example_test.go` - Example usage

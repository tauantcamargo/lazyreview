package ai

import (
	"fmt"
	"strings"
)

// StrictnessLevel represents the AI review strictness level.
type StrictnessLevel string

const (
	// StrictnessRelaxed focuses only on critical bugs and security issues.
	StrictnessRelaxed StrictnessLevel = "relaxed"

	// StrictnessStandard adds performance and error handling checks.
	StrictnessStandard StrictnessLevel = "standard"

	// StrictnessStrict adds style, naming, and best practices checks.
	StrictnessStrict StrictnessLevel = "strict"
)

// ValidStrictnessLevels returns all valid strictness levels.
func ValidStrictnessLevels() []StrictnessLevel {
	return []StrictnessLevel{
		StrictnessRelaxed,
		StrictnessStandard,
		StrictnessStrict,
	}
}

// ParseStrictnessLevel parses a string into a StrictnessLevel.
// Returns StrictnessStandard as the default if the input is invalid.
func ParseStrictnessLevel(s string) StrictnessLevel {
	normalized := StrictnessLevel(strings.ToLower(strings.TrimSpace(s)))
	switch normalized {
	case StrictnessRelaxed, StrictnessStandard, StrictnessStrict:
		return normalized
	default:
		return StrictnessStandard
	}
}

// IsValid checks if the strictness level is valid.
func (s StrictnessLevel) IsValid() bool {
	switch s {
	case StrictnessRelaxed, StrictnessStandard, StrictnessStrict:
		return true
	default:
		return false
	}
}

// String returns the string representation of the strictness level.
func (s StrictnessLevel) String() string {
	return string(s)
}

// GetSystemPrompt returns the system prompt for the given strictness level.
func (s StrictnessLevel) GetSystemPrompt() string {
	basePrompt := "You are a senior code reviewer. Return only JSON with fields: decision (approve|request_changes|comment) and comment."

	var focusAreas string
	switch s {
	case StrictnessRelaxed:
		focusAreas = `
Focus ONLY on:
- Critical bugs that could cause crashes or data loss
- Security vulnerabilities (injection attacks, XSS, authentication/authorization issues)
- Memory leaks or resource exhaustion
- Race conditions or deadlocks

Ignore style, naming conventions, minor optimizations, and documentation unless they directly impact security or critical functionality.`

	case StrictnessStandard:
		focusAreas = `
Focus on:
- Critical bugs and security vulnerabilities
- Performance issues (O(n²) algorithms, unnecessary database queries, memory inefficiency)
- Error handling gaps (uncaught exceptions, missing validation)
- Edge cases (null/undefined checks, boundary conditions)
- Resource management (unclosed connections, file handles)

Also consider style and naming when they significantly impact readability, but be pragmatic.`

	case StrictnessStrict:
		focusAreas = `
Comprehensive review including:
- Critical bugs and security vulnerabilities
- Performance and scalability issues
- Error handling and edge cases
- Code style and naming conventions
- Documentation quality and completeness
- Best practices and design patterns
- Test coverage and testability
- Maintainability and code clarity
- DRY violations and code duplication
- SOLID principles adherence

Be thorough but constructive. Provide specific, actionable feedback.`

	default:
		// Default to standard if invalid level
		return StrictnessStandard.GetSystemPrompt()
	}

	return basePrompt + "\n" + focusAreas
}

// GetUserPromptPrefix returns any additional context for the user prompt based on strictness.
func (s StrictnessLevel) GetUserPromptPrefix() string {
	switch s {
	case StrictnessRelaxed:
		return "This is a relaxed review - focus only on critical issues.\n\n"
	case StrictnessStrict:
		return "This is a strict review - be comprehensive and thorough.\n\n"
	case StrictnessStandard:
		return ""
	default:
		return ""
	}
}

// GetDescription returns a human-readable description of the strictness level.
func (s StrictnessLevel) GetDescription() string {
	switch s {
	case StrictnessRelaxed:
		return "Relaxed: Critical bugs and security only"
	case StrictnessStandard:
		return "Standard: Bugs, security, performance, error handling"
	case StrictnessStrict:
		return "Strict: Comprehensive including style and best practices"
	default:
		return "Unknown strictness level"
	}
}

// ShouldRequestChanges returns true if the issue severity warrants requesting changes
// for the given strictness level.
func (s StrictnessLevel) ShouldRequestChanges(issueSeverity string) bool {
	severity := strings.ToLower(strings.TrimSpace(issueSeverity))

	switch s {
	case StrictnessRelaxed:
		// Only request changes for critical/security issues
		return severity == "critical" || severity == "security"

	case StrictnessStandard:
		// Request changes for critical, security, and high-severity issues
		return severity == "critical" || severity == "security" || severity == "high"

	case StrictnessStrict:
		// Request changes for critical, security, high, and medium issues
		return severity == "critical" || severity == "security" ||
			severity == "high" || severity == "medium"

	default:
		// Default to standard behavior
		return StrictnessStandard.ShouldRequestChanges(issueSeverity)
	}
}

// RepositoryStrictnessConfig represents per-repository strictness configuration.
type RepositoryStrictnessConfig struct {
	// Owner is the repository owner (e.g., "golang")
	Owner string
	// Repo is the repository name (e.g., "go")
	Repo string
	// Strictness is the strictness level for this repository
	Strictness StrictnessLevel
}

// StrictnessResolver resolves the strictness level for a given repository.
type StrictnessResolver struct {
	defaultStrictness   StrictnessLevel
	repositoryOverrides map[string]StrictnessLevel
}

// NewStrictnessResolver creates a new strictness resolver.
func NewStrictnessResolver(defaultStrictness StrictnessLevel, overrides []RepositoryStrictnessConfig) *StrictnessResolver {
	resolver := &StrictnessResolver{
		defaultStrictness:   defaultStrictness,
		repositoryOverrides: make(map[string]StrictnessLevel),
	}

	// Parse repository overrides
	for _, override := range overrides {
		key := buildRepoKey(override.Owner, override.Repo)
		resolver.repositoryOverrides[key] = override.Strictness
	}

	return resolver
}

// Resolve returns the strictness level for the given repository.
func (r *StrictnessResolver) Resolve(owner, repo string) StrictnessLevel {
	key := buildRepoKey(owner, repo)
	if strictness, exists := r.repositoryOverrides[key]; exists {
		return strictness
	}
	return r.defaultStrictness
}

// SetOverride sets a repository-specific strictness override.
func (r *StrictnessResolver) SetOverride(owner, repo string, strictness StrictnessLevel) {
	key := buildRepoKey(owner, repo)
	r.repositoryOverrides[key] = strictness
}

// RemoveOverride removes a repository-specific strictness override.
func (r *StrictnessResolver) RemoveOverride(owner, repo string) {
	key := buildRepoKey(owner, repo)
	delete(r.repositoryOverrides, key)
}

// GetOverrides returns all repository overrides.
func (r *StrictnessResolver) GetOverrides() []RepositoryStrictnessConfig {
	overrides := make([]RepositoryStrictnessConfig, 0, len(r.repositoryOverrides))
	for key, strictness := range r.repositoryOverrides {
		owner, repo := parseRepoKey(key)
		overrides = append(overrides, RepositoryStrictnessConfig{
			Owner:      owner,
			Repo:       repo,
			Strictness: strictness,
		})
	}
	return overrides
}

// buildRepoKey creates a unique key for a repository.
func buildRepoKey(owner, repo string) string {
	return fmt.Sprintf("%s/%s",
		strings.ToLower(strings.TrimSpace(owner)),
		strings.ToLower(strings.TrimSpace(repo)))
}

// parseRepoKey parses a repository key back into owner and repo.
func parseRepoKey(key string) (owner, repo string) {
	parts := strings.SplitN(key, "/", 2)
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	return "", ""
}

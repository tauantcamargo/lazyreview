package ai

import (
	"strings"
	"testing"
)

func TestParseStrictnessLevel(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected StrictnessLevel
	}{
		{
			name:     "relaxed lowercase",
			input:    "relaxed",
			expected: StrictnessRelaxed,
		},
		{
			name:     "standard lowercase",
			input:    "standard",
			expected: StrictnessStandard,
		},
		{
			name:     "strict lowercase",
			input:    "strict",
			expected: StrictnessStrict,
		},
		{
			name:     "relaxed uppercase",
			input:    "RELAXED",
			expected: StrictnessRelaxed,
		},
		{
			name:     "standard with whitespace",
			input:    "  standard  ",
			expected: StrictnessStandard,
		},
		{
			name:     "invalid defaults to standard",
			input:    "invalid",
			expected: StrictnessStandard,
		},
		{
			name:     "empty defaults to standard",
			input:    "",
			expected: StrictnessStandard,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ParseStrictnessLevel(tt.input)
			if result != tt.expected {
				t.Errorf("ParseStrictnessLevel(%q) = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestStrictnessLevel_IsValid(t *testing.T) {
	tests := []struct {
		name     string
		level    StrictnessLevel
		expected bool
	}{
		{
			name:     "relaxed is valid",
			level:    StrictnessRelaxed,
			expected: true,
		},
		{
			name:     "standard is valid",
			level:    StrictnessStandard,
			expected: true,
		},
		{
			name:     "strict is valid",
			level:    StrictnessStrict,
			expected: true,
		},
		{
			name:     "empty is invalid",
			level:    StrictnessLevel(""),
			expected: false,
		},
		{
			name:     "invalid is invalid",
			level:    StrictnessLevel("invalid"),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.level.IsValid()
			if result != tt.expected {
				t.Errorf("IsValid() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestStrictnessLevel_GetSystemPrompt(t *testing.T) {
	tests := []struct {
		name             string
		level            StrictnessLevel
		expectedContains []string
	}{
		{
			name:  "relaxed prompt focuses on critical issues",
			level: StrictnessRelaxed,
			expectedContains: []string{
				"senior code reviewer",
				"JSON",
				"Critical bugs",
				"Security vulnerabilities",
			},
		},
		{
			name:  "standard prompt includes performance",
			level: StrictnessStandard,
			expectedContains: []string{
				"senior code reviewer",
				"JSON",
				"Performance issues",
				"Error handling",
			},
		},
		{
			name:  "strict prompt includes style",
			level: StrictnessStrict,
			expectedContains: []string{
				"senior code reviewer",
				"JSON",
				"Code style",
				"naming conventions",
				"Best practices",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			prompt := tt.level.GetSystemPrompt()
			if prompt == "" {
				t.Error("GetSystemPrompt() returned empty string")
			}
			for _, expected := range tt.expectedContains {
				if !strings.Contains(prompt, expected) {
					t.Errorf("GetSystemPrompt() missing expected text %q\nGot: %s", expected, prompt)
				}
			}
		})
	}
}

func TestStrictnessLevel_GetUserPromptPrefix(t *testing.T) {
	tests := []struct {
		name     string
		level    StrictnessLevel
		expected string
	}{
		{
			name:     "relaxed has prefix",
			level:    StrictnessRelaxed,
			expected: "relaxed review",
		},
		{
			name:     "standard has no prefix",
			level:    StrictnessStandard,
			expected: "",
		},
		{
			name:     "strict has prefix",
			level:    StrictnessStrict,
			expected: "strict review",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			prefix := tt.level.GetUserPromptPrefix()
			if tt.expected == "" && prefix != "" {
				t.Errorf("GetUserPromptPrefix() = %q, want empty string", prefix)
			}
			if tt.expected != "" && !strings.Contains(strings.ToLower(prefix), tt.expected) {
				t.Errorf("GetUserPromptPrefix() = %q, want to contain %q", prefix, tt.expected)
			}
		})
	}
}

func TestStrictnessLevel_GetDescription(t *testing.T) {
	tests := []struct {
		name     string
		level    StrictnessLevel
		expected string
	}{
		{
			name:     "relaxed description",
			level:    StrictnessRelaxed,
			expected: "Critical bugs and security only",
		},
		{
			name:     "standard description",
			level:    StrictnessStandard,
			expected: "performance, error handling",
		},
		{
			name:     "strict description",
			level:    StrictnessStrict,
			expected: "style and best practices",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			desc := tt.level.GetDescription()
			if !strings.Contains(desc, tt.expected) {
				t.Errorf("GetDescription() = %q, want to contain %q", desc, tt.expected)
			}
		})
	}
}

func TestStrictnessLevel_ShouldRequestChanges(t *testing.T) {
	tests := []struct {
		name          string
		level         StrictnessLevel
		issueSeverity string
		shouldRequest bool
	}{
		// Relaxed level
		{
			name:          "relaxed - critical should request changes",
			level:         StrictnessRelaxed,
			issueSeverity: "critical",
			shouldRequest: true,
		},
		{
			name:          "relaxed - security should request changes",
			level:         StrictnessRelaxed,
			issueSeverity: "security",
			shouldRequest: true,
		},
		{
			name:          "relaxed - high should not request changes",
			level:         StrictnessRelaxed,
			issueSeverity: "high",
			shouldRequest: false,
		},
		{
			name:          "relaxed - medium should not request changes",
			level:         StrictnessRelaxed,
			issueSeverity: "medium",
			shouldRequest: false,
		},
		{
			name:          "relaxed - low should not request changes",
			level:         StrictnessRelaxed,
			issueSeverity: "low",
			shouldRequest: false,
		},
		// Standard level
		{
			name:          "standard - critical should request changes",
			level:         StrictnessStandard,
			issueSeverity: "critical",
			shouldRequest: true,
		},
		{
			name:          "standard - security should request changes",
			level:         StrictnessStandard,
			issueSeverity: "security",
			shouldRequest: true,
		},
		{
			name:          "standard - high should request changes",
			level:         StrictnessStandard,
			issueSeverity: "high",
			shouldRequest: true,
		},
		{
			name:          "standard - medium should not request changes",
			level:         StrictnessStandard,
			issueSeverity: "medium",
			shouldRequest: false,
		},
		{
			name:          "standard - low should not request changes",
			level:         StrictnessStandard,
			issueSeverity: "low",
			shouldRequest: false,
		},
		// Strict level
		{
			name:          "strict - critical should request changes",
			level:         StrictnessStrict,
			issueSeverity: "critical",
			shouldRequest: true,
		},
		{
			name:          "strict - security should request changes",
			level:         StrictnessStrict,
			issueSeverity: "security",
			shouldRequest: true,
		},
		{
			name:          "strict - high should request changes",
			level:         StrictnessStrict,
			issueSeverity: "high",
			shouldRequest: true,
		},
		{
			name:          "strict - medium should request changes",
			level:         StrictnessStrict,
			issueSeverity: "medium",
			shouldRequest: true,
		},
		{
			name:          "strict - low should not request changes",
			level:         StrictnessStrict,
			issueSeverity: "low",
			shouldRequest: false,
		},
		// Case insensitivity
		{
			name:          "case insensitive - CRITICAL",
			level:         StrictnessRelaxed,
			issueSeverity: "CRITICAL",
			shouldRequest: true,
		},
		{
			name:          "case insensitive - Security",
			level:         StrictnessRelaxed,
			issueSeverity: "Security",
			shouldRequest: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.level.ShouldRequestChanges(tt.issueSeverity)
			if result != tt.shouldRequest {
				t.Errorf("ShouldRequestChanges(%q) = %v, want %v", tt.issueSeverity, result, tt.shouldRequest)
			}
		})
	}
}

func TestValidStrictnessLevels(t *testing.T) {
	levels := ValidStrictnessLevels()

	if len(levels) != 3 {
		t.Errorf("ValidStrictnessLevels() returned %d levels, want 3", len(levels))
	}

	expectedLevels := map[StrictnessLevel]bool{
		StrictnessRelaxed:  false,
		StrictnessStandard: false,
		StrictnessStrict:   false,
	}

	for _, level := range levels {
		if _, ok := expectedLevels[level]; !ok {
			t.Errorf("ValidStrictnessLevels() contains unexpected level: %v", level)
		}
		expectedLevels[level] = true
	}

	for level, found := range expectedLevels {
		if !found {
			t.Errorf("ValidStrictnessLevels() missing expected level: %v", level)
		}
	}
}

func TestNewStrictnessResolver(t *testing.T) {
	overrides := []RepositoryStrictnessConfig{
		{Owner: "golang", Repo: "go", Strictness: StrictnessStrict},
		{Owner: "torvalds", Repo: "linux", Strictness: StrictnessRelaxed},
	}

	resolver := NewStrictnessResolver(StrictnessStandard, overrides)

	if resolver.defaultStrictness != StrictnessStandard {
		t.Errorf("defaultStrictness = %v, want %v", resolver.defaultStrictness, StrictnessStandard)
	}

	if len(resolver.repositoryOverrides) != 2 {
		t.Errorf("repositoryOverrides length = %d, want 2", len(resolver.repositoryOverrides))
	}
}

func TestStrictnessResolver_Resolve(t *testing.T) {
	overrides := []RepositoryStrictnessConfig{
		{Owner: "golang", Repo: "go", Strictness: StrictnessStrict},
		{Owner: "TORVALDS", Repo: "LINUX", Strictness: StrictnessRelaxed}, // Test case insensitivity
	}

	resolver := NewStrictnessResolver(StrictnessStandard, overrides)

	tests := []struct {
		name     string
		owner    string
		repo     string
		expected StrictnessLevel
	}{
		{
			name:     "golang/go has strict override",
			owner:    "golang",
			repo:     "go",
			expected: StrictnessStrict,
		},
		{
			name:     "torvalds/linux has relaxed override (case insensitive)",
			owner:    "torvalds",
			repo:     "linux",
			expected: StrictnessRelaxed,
		},
		{
			name:     "TORVALDS/LINUX has relaxed override (uppercase)",
			owner:    "TORVALDS",
			repo:     "LINUX",
			expected: StrictnessRelaxed,
		},
		{
			name:     "unknown repo uses default",
			owner:    "facebook",
			repo:     "react",
			expected: StrictnessStandard,
		},
		{
			name:     "whitespace is trimmed",
			owner:    " golang ",
			repo:     " go ",
			expected: StrictnessStrict,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := resolver.Resolve(tt.owner, tt.repo)
			if result != tt.expected {
				t.Errorf("Resolve(%q, %q) = %v, want %v", tt.owner, tt.repo, result, tt.expected)
			}
		})
	}
}

func TestStrictnessResolver_SetOverride(t *testing.T) {
	resolver := NewStrictnessResolver(StrictnessStandard, nil)

	resolver.SetOverride("golang", "go", StrictnessStrict)

	result := resolver.Resolve("golang", "go")
	if result != StrictnessStrict {
		t.Errorf("After SetOverride, Resolve() = %v, want %v", result, StrictnessStrict)
	}

	// Verify default still works for other repos
	result = resolver.Resolve("other", "repo")
	if result != StrictnessStandard {
		t.Errorf("After SetOverride, Resolve() for other repo = %v, want %v", result, StrictnessStandard)
	}
}

func TestStrictnessResolver_RemoveOverride(t *testing.T) {
	overrides := []RepositoryStrictnessConfig{
		{Owner: "golang", Repo: "go", Strictness: StrictnessStrict},
	}

	resolver := NewStrictnessResolver(StrictnessStandard, overrides)

	// Verify override exists
	result := resolver.Resolve("golang", "go")
	if result != StrictnessStrict {
		t.Errorf("Before RemoveOverride, Resolve() = %v, want %v", result, StrictnessStrict)
	}

	// Remove override
	resolver.RemoveOverride("golang", "go")

	// Verify it now uses default
	result = resolver.Resolve("golang", "go")
	if result != StrictnessStandard {
		t.Errorf("After RemoveOverride, Resolve() = %v, want %v", result, StrictnessStandard)
	}
}

func TestStrictnessResolver_GetOverrides(t *testing.T) {
	originalOverrides := []RepositoryStrictnessConfig{
		{Owner: "golang", Repo: "go", Strictness: StrictnessStrict},
		{Owner: "torvalds", Repo: "linux", Strictness: StrictnessRelaxed},
	}

	resolver := NewStrictnessResolver(StrictnessStandard, originalOverrides)

	overrides := resolver.GetOverrides()

	if len(overrides) != 2 {
		t.Fatalf("GetOverrides() returned %d items, want 2", len(overrides))
	}

	// Check that all original overrides are present (order may vary)
	found := make(map[string]bool)
	for _, override := range overrides {
		key := buildRepoKey(override.Owner, override.Repo)
		found[key] = true

		// Verify strictness is correct
		expectedStrictness := resolver.Resolve(override.Owner, override.Repo)
		if override.Strictness != expectedStrictness {
			t.Errorf("Override for %s/%s has strictness %v, want %v",
				override.Owner, override.Repo, override.Strictness, expectedStrictness)
		}
	}

	if !found["golang/go"] {
		t.Error("GetOverrides() missing golang/go")
	}
	if !found["torvalds/linux"] {
		t.Error("GetOverrides() missing torvalds/linux")
	}
}

func TestBuildRepoKey(t *testing.T) {
	tests := []struct {
		name     string
		owner    string
		repo     string
		expected string
	}{
		{
			name:     "normal case",
			owner:    "golang",
			repo:     "go",
			expected: "golang/go",
		},
		{
			name:     "uppercase is normalized",
			owner:    "GOLANG",
			repo:     "GO",
			expected: "golang/go",
		},
		{
			name:     "whitespace is trimmed",
			owner:    " golang ",
			repo:     " go ",
			expected: "golang/go",
		},
		{
			name:     "mixed case and whitespace",
			owner:    " GoLang ",
			repo:     " Go ",
			expected: "golang/go",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := buildRepoKey(tt.owner, tt.repo)
			if result != tt.expected {
				t.Errorf("buildRepoKey(%q, %q) = %q, want %q", tt.owner, tt.repo, result, tt.expected)
			}
		})
	}
}

func TestParseRepoKey(t *testing.T) {
	tests := []struct {
		name          string
		key           string
		expectedOwner string
		expectedRepo  string
	}{
		{
			name:          "normal case",
			key:           "golang/go",
			expectedOwner: "golang",
			expectedRepo:  "go",
		},
		{
			name:          "multiple slashes takes first two parts",
			key:           "golang/go/extra",
			expectedOwner: "golang",
			expectedRepo:  "go/extra",
		},
		{
			name:          "no slash returns empty strings",
			key:           "golang",
			expectedOwner: "",
			expectedRepo:  "",
		},
		{
			name:          "empty key returns empty strings",
			key:           "",
			expectedOwner: "",
			expectedRepo:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			owner, repo := parseRepoKey(tt.key)
			if owner != tt.expectedOwner {
				t.Errorf("parseRepoKey(%q) owner = %q, want %q", tt.key, owner, tt.expectedOwner)
			}
			if repo != tt.expectedRepo {
				t.Errorf("parseRepoKey(%q) repo = %q, want %q", tt.key, repo, tt.expectedRepo)
			}
		})
	}
}

func TestStrictnessLevel_String(t *testing.T) {
	tests := []struct {
		name     string
		level    StrictnessLevel
		expected string
	}{
		{
			name:     "relaxed",
			level:    StrictnessRelaxed,
			expected: "relaxed",
		},
		{
			name:     "standard",
			level:    StrictnessStandard,
			expected: "standard",
		},
		{
			name:     "strict",
			level:    StrictnessStrict,
			expected: "strict",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.level.String()
			if result != tt.expected {
				t.Errorf("String() = %q, want %q", result, tt.expected)
			}
		})
	}
}

package components

import (
	"os"
	"testing"

	"lazyreview/internal/models"
)

func TestUnicodeIndicators(t *testing.T) {
	indicators := UnicodeIndicators()

	tests := []struct {
		name     string
		field    string
		expected string
	}{
		{"CIPassing", indicators.CIPassing, "✓"},
		{"CIFailing", indicators.CIFailing, "✗"},
		{"CIPending", indicators.CIPending, "⟳"},
		{"ReviewApproved", indicators.ReviewApproved, "✓"},
		{"ReviewChangesRequired", indicators.ReviewChangesRequired, "⚠"},
		{"ReviewPending", indicators.ReviewPending, "○"},
		{"ReviewRequired", indicators.ReviewRequired, "👀"},
		{"Draft", indicators.Draft, "📝"},
		{"Conflict", indicators.Conflict, "⚡"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.field != tt.expected {
				t.Errorf("Expected %s to be %q, got %q", tt.name, tt.expected, tt.field)
			}
		})
	}
}

func TestASCIIIndicators(t *testing.T) {
	indicators := ASCIIIndicators()

	tests := []struct {
		name     string
		field    string
		expected string
	}{
		{"CIPassing", indicators.CIPassing, "[pass]"},
		{"CIFailing", indicators.CIFailing, "[fail]"},
		{"CIPending", indicators.CIPending, "[run]"},
		{"ReviewApproved", indicators.ReviewApproved, "[ok]"},
		{"ReviewChangesRequired", indicators.ReviewChangesRequired, "[chg]"},
		{"ReviewPending", indicators.ReviewPending, "[pen]"},
		{"ReviewRequired", indicators.ReviewRequired, "[rvw]"},
		{"Draft", indicators.Draft, "[draft]"},
		{"Conflict", indicators.Conflict, "[conflict]"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.field != tt.expected {
				t.Errorf("Expected %s to be %q, got %q", tt.name, tt.expected, tt.field)
			}
		})
	}
}

func TestSupportsUnicode(t *testing.T) {
	tests := []struct {
		name     string
		term     string
		locale   string
		expected bool
	}{
		{
			name:     "UTF-8 locale",
			term:     "xterm-256color",
			locale:   "en_US.UTF-8",
			expected: true,
		},
		{
			name:     "UTF8 locale without dash",
			term:     "xterm",
			locale:   "en_US.UTF8",
			expected: true,
		},
		{
			name:     "C locale with dumb terminal",
			term:     "dumb",
			locale:   "C",
			expected: false,
		},
		{
			name:     "POSIX locale with dumb terminal",
			term:     "dumb",
			locale:   "POSIX",
			expected: false,
		},
		{
			name:     "C locale with friendly terminal",
			term:     "xterm",
			locale:   "C",
			expected: true, // xterm is Unicode-friendly despite C locale
		},
		{
			name:     "dumb terminal",
			term:     "dumb",
			locale:   "en_US.UTF-8",
			expected: false,
		},
		{
			name:     "friendly terminal without locale",
			term:     "alacritty",
			locale:   "",
			expected: true,
		},
		{
			name:     "xterm without explicit locale",
			term:     "xterm",
			locale:   "",
			expected: true, // xterm is Unicode-friendly
		},
		{
			name:     "empty term",
			term:     "",
			locale:   "en_US.UTF-8",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Save and restore original env
			origTerm := os.Getenv("TERM")
			origLang := os.Getenv("LANG")
			origLCAll := os.Getenv("LC_ALL")
			defer func() {
				os.Setenv("TERM", origTerm)
				os.Setenv("LANG", origLang)
				os.Setenv("LC_ALL", origLCAll)
			}()

			// Set test env
			os.Setenv("TERM", tt.term)
			os.Setenv("LANG", tt.locale)
			os.Setenv("LC_ALL", "")

			result := SupportsUnicode()
			if result != tt.expected {
				t.Errorf("Expected SupportsUnicode() to be %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestGetIndicators(t *testing.T) {
	// Save and restore env
	origTerm := os.Getenv("TERM")
	origLang := os.Getenv("LANG")
	defer func() {
		os.Setenv("TERM", origTerm)
		os.Setenv("LANG", origLang)
	}()

	tests := []struct {
		name           string
		mode           UnicodeMode
		term           string
		locale         string
		expectUnicode  bool
	}{
		{
			name:          "Force Unicode on",
			mode:          UnicodeModeOn,
			term:          "dumb",
			locale:        "C",
			expectUnicode: true,
		},
		{
			name:          "Force ASCII off",
			mode:          UnicodeModeOff,
			term:          "xterm-256color",
			locale:        "en_US.UTF-8",
			expectUnicode: false,
		},
		{
			name:          "Auto with Unicode support",
			mode:          UnicodeModeAuto,
			term:          "xterm-256color",
			locale:        "en_US.UTF-8",
			expectUnicode: true,
		},
		{
			name:          "Auto without Unicode support",
			mode:          UnicodeModeAuto,
			term:          "dumb",
			locale:        "C",
			expectUnicode: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Setenv("TERM", tt.term)
			os.Setenv("LANG", tt.locale)
			os.Setenv("LC_ALL", "")

			indicators := GetIndicators(tt.mode)

			if tt.expectUnicode {
				// Should be Unicode indicators
				if indicators.CIPassing != "✓" {
					t.Errorf("Expected Unicode indicators, got ASCII")
				}
			} else {
				// Should be ASCII indicators
				if indicators.CIPassing != "[pass]" {
					t.Errorf("Expected ASCII indicators, got Unicode")
				}
			}
		})
	}
}

func TestChecksStatusIndicator(t *testing.T) {
	indicators := UnicodeIndicators()

	tests := []struct {
		name     string
		status   models.ChecksStatus
		expected string
	}{
		{"Passing", models.ChecksStatusPassing, "✓"},
		{"Failing", models.ChecksStatusFailing, "✗"},
		{"Pending", models.ChecksStatusPending, "⟳"},
		{"None", models.ChecksStatusNone, ""},
		{"Unknown", models.ChecksStatus("unknown"), ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := indicators.ChecksStatusIndicator(tt.status)
			if result != tt.expected {
				t.Errorf("Expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestReviewDecisionIndicator(t *testing.T) {
	indicators := UnicodeIndicators()

	tests := []struct {
		name     string
		decision models.ReviewDecision
		expected string
	}{
		{"Approved", models.ReviewDecisionApproved, "✓"},
		{"ChangesRequested", models.ReviewDecisionChangesRequsted, "⚠"},
		{"Pending", models.ReviewDecisionPending, "○"},
		{"ReviewRequired", models.ReviewDecisionReviewRequired, "👀"},
		{"Unknown", models.ReviewDecision("unknown"), ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := indicators.ReviewDecisionIndicator(tt.decision)
			if result != tt.expected {
				t.Errorf("Expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestDraftIndicator(t *testing.T) {
	indicators := UnicodeIndicators()

	tests := []struct {
		name     string
		isDraft  bool
		expected string
	}{
		{"Draft", true, "📝"},
		{"NotDraft", false, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := indicators.DraftIndicator(tt.isDraft)
			if result != tt.expected {
				t.Errorf("Expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestConflictIndicator(t *testing.T) {
	indicators := UnicodeIndicators()

	tests := []struct {
		name     string
		state    models.MergeableState
		expected string
	}{
		{"Conflicting", models.MergeableStateConflicting, "⚡"},
		{"Mergeable", models.MergeableStateMergeable, ""},
		{"Unknown", models.MergeableStateUnknown, ""},
		{"Blocked", models.MergeableStateBlocked, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := indicators.ConflictIndicator(tt.state)
			if result != tt.expected {
				t.Errorf("Expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestAllStatusIndicators(t *testing.T) {
	unicodeIndicators := UnicodeIndicators()
	asciiIndicators := ASCIIIndicators()

	pr := &models.PullRequest{
		ChecksStatus:   models.ChecksStatusPassing,
		ReviewDecision: models.ReviewDecisionApproved,
		IsDraft:        true,
		MergeableState: models.MergeableStateConflicting,
	}

	t.Run("Unicode", func(t *testing.T) {
		result := unicodeIndicators.AllStatusIndicators(pr)
		expected := "✓ ✓ 📝 ⚡"
		if result != expected {
			t.Errorf("Expected %q, got %q", expected, result)
		}
	})

	t.Run("ASCII", func(t *testing.T) {
		result := asciiIndicators.AllStatusIndicators(pr)
		expected := "[pass] [ok] [draft] [conflict]"
		if result != expected {
			t.Errorf("Expected %q, got %q", expected, result)
		}
	})

	t.Run("Empty", func(t *testing.T) {
		emptyPR := &models.PullRequest{
			ChecksStatus:   models.ChecksStatusNone,
			ReviewDecision: models.ReviewDecision(""),
			IsDraft:        false,
			MergeableState: models.MergeableStateMergeable,
		}
		result := unicodeIndicators.AllStatusIndicators(emptyPR)
		if result != "" {
			t.Errorf("Expected empty string, got %q", result)
		}
	})
}

func TestASCIIIndicatorsChecksStatus(t *testing.T) {
	indicators := ASCIIIndicators()

	tests := []struct {
		name     string
		status   models.ChecksStatus
		expected string
	}{
		{"Passing", models.ChecksStatusPassing, "[pass]"},
		{"Failing", models.ChecksStatusFailing, "[fail]"},
		{"Pending", models.ChecksStatusPending, "[run]"},
		{"None", models.ChecksStatusNone, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := indicators.ChecksStatusIndicator(tt.status)
			if result != tt.expected {
				t.Errorf("Expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestASCIIIndicatorsReviewDecision(t *testing.T) {
	indicators := ASCIIIndicators()

	tests := []struct {
		name     string
		decision models.ReviewDecision
		expected string
	}{
		{"Approved", models.ReviewDecisionApproved, "[ok]"},
		{"ChangesRequested", models.ReviewDecisionChangesRequsted, "[chg]"},
		{"Pending", models.ReviewDecisionPending, "[pen]"},
		{"ReviewRequired", models.ReviewDecisionReviewRequired, "[rvw]"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := indicators.ReviewDecisionIndicator(tt.decision)
			if result != tt.expected {
				t.Errorf("Expected %q, got %q", tt.expected, result)
			}
		})
	}
}

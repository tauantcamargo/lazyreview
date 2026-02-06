package components

import (
	"os"
	"strings"

	"lazyreview/internal/models"
)

// UnicodeMode represents the Unicode support mode
type UnicodeMode string

const (
	UnicodeModeAuto UnicodeMode = "auto" // Auto-detect terminal support
	UnicodeModeOn   UnicodeMode = "on"   // Force Unicode
	UnicodeModeOff  UnicodeMode = "off"  // Force ASCII
)

// IndicatorSet holds all indicator symbols for a specific mode
type IndicatorSet struct {
	// CI status indicators
	CIPassing string
	CIFailing string
	CIPending string

	// Review status indicators
	ReviewApproved        string
	ReviewChangesRequired string
	ReviewPending         string
	ReviewRequired        string

	// Draft indicator
	Draft string

	// Merge conflict indicator
	Conflict string
}

// UnicodeIndicators returns the Unicode indicator set
func UnicodeIndicators() IndicatorSet {
	return IndicatorSet{
		// CI status
		CIPassing: "✓",
		CIFailing: "✗",
		CIPending: "⟳",

		// Review status
		ReviewApproved:        "✓",
		ReviewChangesRequired: "⚠",
		ReviewPending:         "○",
		ReviewRequired:        "👀",

		// Draft
		Draft: "📝",

		// Conflict
		Conflict: "⚡",
	}
}

// ASCIIIndicators returns the ASCII-only indicator set
func ASCIIIndicators() IndicatorSet {
	return IndicatorSet{
		// CI status
		CIPassing: "[pass]",
		CIFailing: "[fail]",
		CIPending: "[run]",

		// Review status
		ReviewApproved:        "[ok]",
		ReviewChangesRequired: "[chg]",
		ReviewPending:         "[pen]",
		ReviewRequired:        "[rvw]",

		// Draft
		Draft: "[draft]",

		// Conflict
		Conflict: "[conflict]",
	}
}

// SupportsUnicode detects if the terminal supports Unicode characters
func SupportsUnicode() bool {
	// Check TERM environment variable
	term := os.Getenv("TERM")
	if term == "" || strings.Contains(term, "dumb") {
		return false
	}

	// Check LC_ALL, LC_CTYPE, and LANG for UTF-8 support
	// Priority: LC_ALL > LC_CTYPE > LANG
	for _, env := range []string{"LC_ALL", "LC_CTYPE", "LANG"} {
		val := os.Getenv(env)
		if val != "" {
			upper := strings.ToUpper(val)
			// If any locale variable contains UTF-8, we support Unicode
			if strings.Contains(upper, "UTF-8") || strings.Contains(upper, "UTF8") {
				return true
			}
			// If explicitly set to C or POSIX, no Unicode support
			if val == "C" || val == "POSIX" {
				return false
			}
			// If set to any other value, don't check further env vars
			// but continue to terminal type check
			break
		}
	}

	// Check for known Unicode-friendly terminals
	unicodeFriendlyTerms := []string{
		"xterm", "screen", "tmux", "rxvt", "alacritty", "kitty", "wezterm",
		"iTerm", "vt100", "vt220", "konsole", "gnome", "terminator",
	}
	for _, friendly := range unicodeFriendlyTerms {
		if strings.Contains(term, friendly) {
			return true
		}
	}

	// Default to false if we can't determine
	return false
}

// GetIndicators returns the appropriate indicator set based on mode
func GetIndicators(mode UnicodeMode) IndicatorSet {
	switch mode {
	case UnicodeModeOn:
		return UnicodeIndicators()
	case UnicodeModeOff:
		return ASCIIIndicators()
	case UnicodeModeAuto:
		if SupportsUnicode() {
			return UnicodeIndicators()
		}
		return ASCIIIndicators()
	default:
		// Default to auto-detect
		return GetIndicators(UnicodeModeAuto)
	}
}

// ChecksStatusIndicator returns the indicator for CI/check status
func (is IndicatorSet) ChecksStatusIndicator(status models.ChecksStatus) string {
	switch status {
	case models.ChecksStatusPassing:
		return is.CIPassing
	case models.ChecksStatusFailing:
		return is.CIFailing
	case models.ChecksStatusPending:
		return is.CIPending
	default:
		return ""
	}
}

// ReviewDecisionIndicator returns the indicator for review decision
func (is IndicatorSet) ReviewDecisionIndicator(decision models.ReviewDecision) string {
	switch decision {
	case models.ReviewDecisionApproved:
		return is.ReviewApproved
	case models.ReviewDecisionChangesRequsted:
		return is.ReviewChangesRequired
	case models.ReviewDecisionPending:
		return is.ReviewPending
	case models.ReviewDecisionReviewRequired:
		return is.ReviewRequired
	default:
		return ""
	}
}

// DraftIndicator returns the draft indicator if the PR is a draft
func (is IndicatorSet) DraftIndicator(isDraft bool) string {
	if isDraft {
		return is.Draft
	}
	return ""
}

// ConflictIndicator returns the conflict indicator if there's a merge conflict
func (is IndicatorSet) ConflictIndicator(state models.MergeableState) string {
	if state == models.MergeableStateConflicting {
		return is.Conflict
	}
	return ""
}

// AllStatusIndicators returns a space-separated string of all relevant status indicators
func (is IndicatorSet) AllStatusIndicators(pr *models.PullRequest) string {
	var indicators []string

	if ci := is.ChecksStatusIndicator(pr.ChecksStatus); ci != "" {
		indicators = append(indicators, ci)
	}
	if rv := is.ReviewDecisionIndicator(pr.ReviewDecision); rv != "" {
		indicators = append(indicators, rv)
	}
	if draft := is.DraftIndicator(pr.IsDraft); draft != "" {
		indicators = append(indicators, draft)
	}
	if conflict := is.ConflictIndicator(pr.MergeableState); conflict != "" {
		indicators = append(indicators, conflict)
	}

	return strings.Join(indicators, " ")
}

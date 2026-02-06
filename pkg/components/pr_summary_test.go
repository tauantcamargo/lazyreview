package components

import (
	"strings"
	"testing"
)

func TestRiskLevel_String(t *testing.T) {
	tests := []struct {
		name     string
		level    RiskLevel
		expected string
	}{
		{"Low risk", RiskLow, "🟢 Low"},
		{"Medium risk", RiskMedium, "🟡 Medium"},
		{"High risk", RiskHigh, "🔴 High"},
		{"Invalid risk", RiskLevel(99), "⚪ Unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.level.String()
			if got != tt.expected {
				t.Errorf("RiskLevel.String() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestRiskLevel_RiskColor(t *testing.T) {
	tests := []struct {
		name  string
		level RiskLevel
	}{
		{"Low risk color", RiskLow},
		{"Medium risk color", RiskMedium},
		{"High risk color", RiskHigh},
		{"Unknown risk color", RiskLevel(99)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			color := tt.level.RiskColor()
			// Just verify it returns a color and doesn't panic
			if color.Dark == "" && color.Light == "" {
				t.Errorf("RiskLevel.RiskColor() returned empty color")
			}
		})
	}
}

func TestNewPRSummary(t *testing.T) {
	summary := NewPRSummary()

	if !summary.IsEmpty {
		t.Errorf("NewPRSummary() IsEmpty = false, want true")
	}
	if summary.IsLoading {
		t.Errorf("NewPRSummary() IsLoading = true, want false")
	}
	if summary.Error != "" {
		t.Errorf("NewPRSummary() Error = %q, want empty", summary.Error)
	}
	if summary.KeyChanges == nil {
		t.Errorf("NewPRSummary() KeyChanges is nil, want initialized slice")
	}
}

func TestNewLoadingPRSummary(t *testing.T) {
	summary := NewLoadingPRSummary()

	if !summary.IsLoading {
		t.Errorf("NewLoadingPRSummary() IsLoading = false, want true")
	}
	if summary.IsEmpty {
		t.Errorf("NewLoadingPRSummary() IsEmpty = true, want false")
	}
}

func TestNewErrorPRSummary(t *testing.T) {
	errMsg := "test error message"
	summary := NewErrorPRSummary(errMsg)

	if summary.Error != errMsg {
		t.Errorf("NewErrorPRSummary() Error = %q, want %q", summary.Error, errMsg)
	}
	if summary.IsLoading {
		t.Errorf("NewErrorPRSummary() IsLoading = true, want false")
	}
}

func TestParseSummaryResponse(t *testing.T) {
	tests := []struct {
		name           string
		response       string
		wantPurpose    string
		wantChanges    []string
		wantRisk       RiskLevel
		wantRiskDetail string
	}{
		{
			name: "Complete summary with markdown headers",
			response: `## Purpose
Add authentication middleware to API routes

## Key Changes
- Implement JWT validation
- Add rate limiting
- Update error handling

## Risk Assessment
🟢 Low
No breaking changes to existing APIs`,
			wantPurpose: "Add authentication middleware to API routes",
			wantChanges: []string{
				"Implement JWT validation",
				"Add rate limiting",
				"Update error handling",
			},
			wantRisk:       RiskLow,
			wantRiskDetail: "No breaking changes to existing APIs",
		},
		{
			name: "Summary with bold headers",
			response: `**Purpose**
Refactor database connection pool

**Key Changes**
* Increase max connections
* Add connection timeout
* Implement health checks

**Risk Assessment**
🟡 Medium
Requires database restart`,
			wantPurpose: "Refactor database connection pool",
			wantChanges: []string{
				"Increase max connections",
				"Add connection timeout",
				"Implement health checks",
			},
			wantRisk:       RiskMedium,
			wantRiskDetail: "Requires database restart",
		},
		{
			name: "High risk summary",
			response: `## Purpose
Migrate to new database schema

## Key Changes
- Drop legacy tables
- Rename columns
- Update foreign keys

## Risk Assessment
🔴 High
Data migration required, potential downtime`,
			wantPurpose: "Migrate to new database schema",
			wantChanges: []string{
				"Drop legacy tables",
				"Rename columns",
				"Update foreign keys",
			},
			wantRisk:       RiskHigh,
			wantRiskDetail: "Data migration required, potential downtime",
		},
		{
			name: "Summary with text-based risk",
			response: `## Purpose
Update dependencies

## Key Changes
- Upgrade React to v18
- Update TypeScript

## Risk Assessment
Low
All tests passing`,
			wantPurpose: "Update dependencies",
			wantChanges: []string{
				"Upgrade React to v18",
				"Update TypeScript",
			},
			wantRisk:       RiskLow,
			wantRiskDetail: "All tests passing",
		},
		{
			name: "Empty sections",
			response: `## Purpose

## Key Changes

## Risk Assessment
🟢 Low`,
			wantPurpose:    "",
			wantChanges:    []string{},
			wantRisk:       RiskLow,
			wantRiskDetail: "",
		},
		{
			name: "Multiline purpose",
			response: `## Purpose
This PR introduces a new feature that allows users
to export data in multiple formats including CSV and JSON

## Key Changes
- Add export controller
- Implement format converters

## Risk Assessment
🟢 Low`,
			wantPurpose: "This PR introduces a new feature that allows users to export data in multiple formats including CSV and JSON",
			wantChanges: []string{
				"Add export controller",
				"Implement format converters",
			},
			wantRisk: RiskLow,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ParseSummaryResponse(tt.response)

			if got.Purpose != tt.wantPurpose {
				t.Errorf("ParseSummaryResponse() Purpose = %q, want %q", got.Purpose, tt.wantPurpose)
			}

			if len(got.KeyChanges) != len(tt.wantChanges) {
				t.Errorf("ParseSummaryResponse() KeyChanges count = %d, want %d", len(got.KeyChanges), len(tt.wantChanges))
			} else {
				for i, change := range got.KeyChanges {
					if change != tt.wantChanges[i] {
						t.Errorf("ParseSummaryResponse() KeyChanges[%d] = %q, want %q", i, change, tt.wantChanges[i])
					}
				}
			}

			if got.RiskAssessment != tt.wantRisk {
				t.Errorf("ParseSummaryResponse() RiskAssessment = %v, want %v", got.RiskAssessment, tt.wantRisk)
			}

			if tt.wantRiskDetail != "" && got.RiskDetails != tt.wantRiskDetail {
				t.Errorf("ParseSummaryResponse() RiskDetails = %q, want %q", got.RiskDetails, tt.wantRiskDetail)
			}

			if got.IsEmpty {
				t.Errorf("ParseSummaryResponse() IsEmpty = true, want false")
			}
		})
	}
}

func TestPRSummary_Render_Loading(t *testing.T) {
	summary := NewLoadingPRSummary()
	styles := DefaultPRSummaryStyles()

	output := summary.Render(80, styles)

	if !strings.Contains(output, "Generating AI summary") {
		t.Errorf("Render() loading state should contain 'Generating AI summary', got %q", output)
	}
}

func TestPRSummary_Render_Error(t *testing.T) {
	summary := NewErrorPRSummary("API error")
	styles := DefaultPRSummaryStyles()

	output := summary.Render(80, styles)

	if !strings.Contains(output, "Error: API error") {
		t.Errorf("Render() error state should contain error message, got %q", output)
	}
}

func TestPRSummary_Render_Empty(t *testing.T) {
	summary := NewPRSummary()
	styles := DefaultPRSummaryStyles()

	output := summary.Render(80, styles)

	if !strings.Contains(output, "No summary available") {
		t.Errorf("Render() empty state should contain 'No summary available', got %q", output)
	}
}

func TestPRSummary_Render_Complete(t *testing.T) {
	summary := &PRSummary{
		Purpose: "Add new feature",
		KeyChanges: []string{
			"Change 1",
			"Change 2",
		},
		RiskAssessment: RiskLow,
		RiskDetails:    "Minimal risk",
	}
	styles := DefaultPRSummaryStyles()

	output := summary.Render(80, styles)

	requiredStrings := []string{
		"PR Summary",
		"Purpose",
		"Add new feature",
		"Key Changes",
		"Change 1",
		"Change 2",
		"Risk Assessment",
		"Low",
		"Minimal risk",
	}

	for _, required := range requiredStrings {
		if !strings.Contains(output, required) {
			t.Errorf("Render() should contain %q, got %q", required, output)
		}
	}
}

func TestDefaultPRSummaryStyles(t *testing.T) {
	styles := DefaultPRSummaryStyles()

	if styles.Container.GetPaddingTop() == 0 {
		t.Error("DefaultPRSummaryStyles() Container should have padding")
	}
	if !styles.Title.GetBold() {
		t.Error("DefaultPRSummaryStyles() Title should be bold")
	}
	if !styles.SectionHeader.GetBold() {
		t.Error("DefaultPRSummaryStyles() SectionHeader should be bold")
	}
}

func TestParseSummaryResponse_EdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		response string
	}{
		{"Empty response", ""},
		{"Only whitespace", "   \n\n   \n"},
		{"No sections", "This is just plain text without any structure"},
		{"Malformed markdown", "## Purpose\n###Key Changes\nRisk Assessment"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ParseSummaryResponse(tt.response)
			if got == nil {
				t.Error("ParseSummaryResponse() should not return nil for any input")
			}
			if got.KeyChanges == nil {
				t.Error("ParseSummaryResponse() KeyChanges should be initialized")
			}
		})
	}
}

func BenchmarkParseSummaryResponse(b *testing.B) {
	response := `## Purpose
Add authentication middleware to API routes

## Key Changes
- Implement JWT validation
- Add rate limiting
- Update error handling

## Risk Assessment
🟢 Low
No breaking changes to existing APIs`

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ParseSummaryResponse(response)
	}
}

func BenchmarkPRSummary_Render(b *testing.B) {
	summary := &PRSummary{
		Purpose: "Add new feature",
		KeyChanges: []string{
			"Change 1",
			"Change 2",
			"Change 3",
		},
		RiskAssessment: RiskMedium,
		RiskDetails:    "Some risk involved",
	}
	styles := DefaultPRSummaryStyles()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		summary.Render(80, styles)
	}
}

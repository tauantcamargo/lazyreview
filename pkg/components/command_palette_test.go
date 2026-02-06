package components

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestNewCommandPalette(t *testing.T) {
	commands := []CommandAction{
		{ID: "1", Name: "Test Command", Category: "Test"},
	}

	cp := NewCommandPalette(commands)

	if cp.visible {
		t.Error("Expected palette to be hidden initially")
	}

	if len(cp.commands) != 1 {
		t.Errorf("Expected 1 command, got %d", len(cp.commands))
	}

	if cp.maxRecent != 5 {
		t.Errorf("Expected maxRecent to be 5, got %d", cp.maxRecent)
	}

	if len(cp.recentIDs) != 0 {
		t.Errorf("Expected empty recent list, got %d items", len(cp.recentIDs))
	}
}

func TestCommandPalette_ShowHide(t *testing.T) {
	cp := NewCommandPalette([]CommandAction{})

	if cp.IsVisible() {
		t.Error("Expected palette to be hidden initially")
	}

	cp.Show([]string{"test_context"})

	if !cp.IsVisible() {
		t.Error("Expected palette to be visible after Show()")
	}

	if len(cp.currentCtx) != 1 || cp.currentCtx[0] != "test_context" {
		t.Errorf("Expected context to be set, got %v", cp.currentCtx)
	}

	cp.Hide()

	if cp.IsVisible() {
		t.Error("Expected palette to be hidden after Hide()")
	}
}

func TestCommandPalette_SetSize(t *testing.T) {
	cp := NewCommandPalette([]CommandAction{})

	cp.SetSize(100, 50)

	if cp.width != 100 {
		t.Errorf("Expected width 100, got %d", cp.width)
	}

	if cp.height != 50 {
		t.Errorf("Expected height 50, got %d", cp.height)
	}

	expectedTextInputWidth := 100 - 10
	if cp.textInput.Width != expectedTextInputWidth {
		t.Errorf("Expected textInput width %d, got %d", expectedTextInputWidth, cp.textInput.Width)
	}
}

func TestCommandPalette_SetCommands(t *testing.T) {
	cp := NewCommandPalette([]CommandAction{})

	newCommands := []CommandAction{
		{ID: "1", Name: "Command 1"},
		{ID: "2", Name: "Command 2"},
	}

	cp.SetCommands(newCommands)

	if len(cp.commands) != 2 {
		t.Errorf("Expected 2 commands, got %d", len(cp.commands))
	}
}

func TestCommandPalette_ContextFiltering(t *testing.T) {
	commands := []CommandAction{
		{ID: "global", Name: "Global Command", Context: []string{}},
		{ID: "list", Name: "List Command", Context: []string{"list"}},
		{ID: "detail", Name: "Detail Command", Context: []string{"detail"}},
		{ID: "multi", Name: "Multi Command", Context: []string{"list", "detail"}},
	}

	cp := NewCommandPalette(commands)
	cp.Show([]string{"list"})

	// Should show: global, list, multi (3 commands)
	if len(cp.filtered) != 3 {
		t.Errorf("Expected 3 filtered commands in list context, got %d", len(cp.filtered))
	}

	// Verify correct commands are shown
	ids := make(map[string]bool)
	for _, cmd := range cp.filtered {
		ids[cmd.ID] = true
	}

	if !ids["global"] {
		t.Error("Expected global command to be available")
	}
	if !ids["list"] {
		t.Error("Expected list command to be available")
	}
	if !ids["multi"] {
		t.Error("Expected multi command to be available")
	}
	if ids["detail"] {
		t.Error("Expected detail command to be unavailable in list context")
	}
}

func TestCommandPalette_FuzzySearch(t *testing.T) {
	commands := []CommandAction{
		{ID: "1", Name: "Approve Pull Request", Category: "Review"},
		{ID: "2", Name: "Request Changes", Category: "Review"},
		{ID: "3", Name: "Open Browser", Category: "Navigation"},
		{ID: "4", Name: "Checkout Branch", Category: "Git", Aliases: []string{"co", "switch"}},
	}

	cp := NewCommandPalette(commands)
	cp.Show([]string{})

	tests := []struct {
		query       string
		expectedIDs []string // Expected command IDs (order doesn't matter)
		exactCount  bool     // If true, must have exact count; if false, at least these IDs
	}{
		{"approve", []string{"1"}, true},
		{"request", []string{"2"}, false}, // Fuzzy might match "Pull Request" too
		{"open", []string{"3"}, true},
		{"checkout", []string{"4"}, true},
		{"co", []string{"4"}, true},          // Alias match
		{"review", []string{"1", "2"}, true}, // Category match
		{"branch", []string{"4"}, true},
		{"nonexistent", []string{}, true},
	}

	for _, tt := range tests {
		t.Run(tt.query, func(t *testing.T) {
			// Simulate typing the query
			cp.textInput.SetValue(tt.query)
			cp.updateFiltered()

			if tt.exactCount && len(cp.filtered) != len(tt.expectedIDs) {
				t.Errorf("Query %q: expected %d results, got %d",
					tt.query, len(tt.expectedIDs), len(cp.filtered))
				return
			}

			// Check that all expected IDs are present
			foundIDs := make(map[string]bool)
			for _, cmd := range cp.filtered {
				foundIDs[cmd.ID] = true
			}

			for _, expectedID := range tt.expectedIDs {
				if !foundIDs[expectedID] {
					t.Errorf("Query %q: expected to find command ID %s, but it was not in results",
						tt.query, expectedID)
				}
			}
		})
	}
}

func TestCommandPalette_RecentCommands(t *testing.T) {
	commands := []CommandAction{
		{ID: "1", Name: "Command 1"},
		{ID: "2", Name: "Command 2"},
		{ID: "3", Name: "Command 3"},
	}

	cp := NewCommandPalette(commands)

	// Execute commands in order
	cp.recordExecution("1")
	cp.recordExecution("2")
	cp.recordExecution("3")

	recent := cp.GetRecentCommands()

	if len(recent) != 3 {
		t.Errorf("Expected 3 recent commands, got %d", len(recent))
	}

	// Most recent should be first
	if recent[0] != "3" {
		t.Errorf("Expected most recent to be '3', got %s", recent[0])
	}
	if recent[1] != "2" {
		t.Errorf("Expected second recent to be '2', got %s", recent[1])
	}
	if recent[2] != "1" {
		t.Errorf("Expected third recent to be '1', got %s", recent[2])
	}
}

func TestCommandPalette_RecentCommandsLimit(t *testing.T) {
	commands := []CommandAction{
		{ID: "1", Name: "Command 1"},
		{ID: "2", Name: "Command 2"},
		{ID: "3", Name: "Command 3"},
		{ID: "4", Name: "Command 4"},
		{ID: "5", Name: "Command 5"},
		{ID: "6", Name: "Command 6"},
		{ID: "7", Name: "Command 7"},
	}

	cp := NewCommandPalette(commands)

	// Execute more commands than maxRecent
	for i := 1; i <= 7; i++ {
		cp.recordExecution(string(rune('0' + i)))
	}

	recent := cp.GetRecentCommands()

	if len(recent) != cp.maxRecent {
		t.Errorf("Expected %d recent commands (maxRecent), got %d", cp.maxRecent, len(recent))
	}

	// Should keep most recent 5
	if recent[0] != "7" {
		t.Errorf("Expected most recent to be '7', got %s", recent[0])
	}
}

func TestCommandPalette_RecentCommandDeduplication(t *testing.T) {
	commands := []CommandAction{
		{ID: "1", Name: "Command 1"},
		{ID: "2", Name: "Command 2"},
	}

	cp := NewCommandPalette(commands)

	// Execute same command multiple times
	cp.recordExecution("1")
	cp.recordExecution("2")
	cp.recordExecution("1")

	recent := cp.GetRecentCommands()

	if len(recent) != 2 {
		t.Errorf("Expected 2 recent commands (deduplicated), got %d", len(recent))
	}

	// Most recent execution should be first
	if recent[0] != "1" {
		t.Errorf("Expected most recent to be '1', got %s", recent[0])
	}
	if recent[1] != "2" {
		t.Errorf("Expected second recent to be '2', got %s", recent[1])
	}
}

func TestCommandPalette_RecentCommandsPriority(t *testing.T) {
	commands := []CommandAction{
		{ID: "recent", Name: "Recent Command"},
		{ID: "other", Name: "Other Command"},
	}

	cp := NewCommandPalette(commands)
	cp.recordExecution("recent")
	cp.Show([]string{})

	// With empty query, recent commands should appear first
	if len(cp.filtered) < 2 {
		t.Fatal("Expected at least 2 filtered commands")
	}

	if cp.filtered[0].ID != "recent" {
		t.Errorf("Expected recent command first, got %s", cp.filtered[0].ID)
	}
}

func TestCommandPalette_KeyboardNavigation(t *testing.T) {
	commands := []CommandAction{
		{ID: "1", Name: "Command 1"},
		{ID: "2", Name: "Command 2"},
		{ID: "3", Name: "Command 3"},
	}

	cp := NewCommandPalette(commands)
	cp.Show([]string{})

	// Initial selection should be 0
	if cp.selected != 0 {
		t.Errorf("Expected initial selection 0, got %d", cp.selected)
	}

	// Press Down
	cp, _ = cp.Update(tea.KeyMsg{Type: tea.KeyDown})
	if cp.selected != 1 {
		t.Errorf("Expected selection 1 after down, got %d", cp.selected)
	}

	// Press Down again
	cp, _ = cp.Update(tea.KeyMsg{Type: tea.KeyDown})
	if cp.selected != 2 {
		t.Errorf("Expected selection 2 after down, got %d", cp.selected)
	}

	// Press Down at end (should stay at 2)
	cp, _ = cp.Update(tea.KeyMsg{Type: tea.KeyDown})
	if cp.selected != 2 {
		t.Errorf("Expected selection to stay at 2, got %d", cp.selected)
	}

	// Press Up
	cp, _ = cp.Update(tea.KeyMsg{Type: tea.KeyUp})
	if cp.selected != 1 {
		t.Errorf("Expected selection 1 after up, got %d", cp.selected)
	}

	// Press Up again
	cp, _ = cp.Update(tea.KeyMsg{Type: tea.KeyUp})
	if cp.selected != 0 {
		t.Errorf("Expected selection 0 after up, got %d", cp.selected)
	}

	// Press Up at start (should stay at 0)
	cp, _ = cp.Update(tea.KeyMsg{Type: tea.KeyUp})
	if cp.selected != 0 {
		t.Errorf("Expected selection to stay at 0, got %d", cp.selected)
	}
}

func TestCommandPalette_EscapeClosesModal(t *testing.T) {
	cp := NewCommandPalette([]CommandAction{})
	cp.Show([]string{})

	if !cp.IsVisible() {
		t.Fatal("Expected palette to be visible")
	}

	// Press Escape
	cp, _ = cp.Update(tea.KeyMsg{Type: tea.KeyEsc})

	if cp.IsVisible() {
		t.Error("Expected palette to be hidden after escape")
	}
}

func TestCommandPalette_SelectExecutesCommand(t *testing.T) {
	executed := false
	commands := []CommandAction{
		{
			ID:   "test",
			Name: "Test Command",
			Handler: func() tea.Msg {
				executed = true
				return nil
			},
		},
	}

	cp := NewCommandPalette(commands)
	cp.Show([]string{})

	// Should have 1 filtered command
	if len(cp.filtered) != 1 {
		t.Fatalf("Expected 1 filtered command, got %d", len(cp.filtered))
	}

	// Press Enter to execute
	cp, cmd := cp.Update(tea.KeyMsg{Type: tea.KeyEnter})

	// Execute the returned command
	if cmd != nil {
		cmd()
	}

	if !executed {
		t.Error("Expected command handler to be executed")
	}

	if cp.IsVisible() {
		t.Error("Expected palette to be hidden after execution")
	}

	// Check that command was added to recent
	recent := cp.GetRecentCommands()
	if len(recent) != 1 || recent[0] != "test" {
		t.Errorf("Expected command to be added to recent, got %v", recent)
	}
}

func TestCommandPalette_View(t *testing.T) {
	commands := []CommandAction{
		{ID: "1", Name: "Test Command", Category: "Test", Key: "t", Description: "A test command"},
	}

	cp := NewCommandPalette(commands)

	// Hidden should return empty string
	view := cp.View()
	if view != "" {
		t.Error("Expected empty view when hidden")
	}

	// Show and verify view contains expected elements
	cp.Show([]string{})
	view = cp.View()

	expectedStrings := []string{
		"Command Palette",
		"Test Command",
		"[t]",
		"A test command",
		"Navigate",
		"Execute",
		"Close",
	}

	for _, expected := range expectedStrings {
		if !strings.Contains(view, expected) {
			t.Errorf("Expected view to contain %q, but it didn't.\nView:\n%s", expected, view)
		}
	}
}

func TestCommandPalette_SetRecentCommands(t *testing.T) {
	cp := NewCommandPalette([]CommandAction{})

	recent := []string{"1", "2", "3"}
	cp.SetRecentCommands(recent)

	got := cp.GetRecentCommands()

	if len(got) != len(recent) {
		t.Errorf("Expected %d recent commands, got %d", len(recent), len(got))
	}

	for i, id := range recent {
		if got[i] != id {
			t.Errorf("Expected recent[%d] to be %s, got %s", i, id, got[i])
		}
	}
}

func TestCommandPalette_SetRecentCommandsTrimming(t *testing.T) {
	cp := NewCommandPalette([]CommandAction{})

	// Set more than maxRecent
	tooMany := []string{"1", "2", "3", "4", "5", "6", "7", "8"}
	cp.SetRecentCommands(tooMany)

	got := cp.GetRecentCommands()

	if len(got) != cp.maxRecent {
		t.Errorf("Expected recent commands to be trimmed to %d, got %d", cp.maxRecent, len(got))
	}

	// Should keep first maxRecent items
	for i := 0; i < cp.maxRecent; i++ {
		if got[i] != tooMany[i] {
			t.Errorf("Expected recent[%d] to be %s, got %s", i, tooMany[i], got[i])
		}
	}
}

func TestCommandPalette_UpdateWhenHidden(t *testing.T) {
	cp := NewCommandPalette([]CommandAction{})

	// Update when hidden should be no-op
	cp, cmd := cp.Update(tea.KeyMsg{Type: tea.KeyDown})

	if cmd != nil {
		t.Error("Expected nil cmd when updating hidden palette")
	}

	if cp.selected != 0 {
		t.Error("Expected selection to remain 0 when hidden")
	}
}

func TestCommandPalette_SetThemeColors(t *testing.T) {
	cp := NewCommandPalette([]CommandAction{})

	// Should not panic with valid colors
	cp.SetThemeColors("170", "240", "237", "170")

	// Should not panic with empty strings (defaults)
	cp.SetThemeColors("", "", "", "")
}

func TestCommandPalette_IsRecentCommand(t *testing.T) {
	cp := NewCommandPalette([]CommandAction{})

	cp.recordExecution("test")

	if !cp.isRecent("test") {
		t.Error("Expected 'test' to be recent")
	}

	if cp.isRecent("other") {
		t.Error("Expected 'other' not to be recent")
	}
}

func TestCommandPalette_EmptyQuery(t *testing.T) {
	commands := []CommandAction{
		{ID: "1", Name: "Command 1"},
		{ID: "2", Name: "Command 2"},
	}

	cp := NewCommandPalette(commands)
	cp.Show([]string{})

	// Empty query should show all commands
	if len(cp.filtered) != 2 {
		t.Errorf("Expected all 2 commands with empty query, got %d", len(cp.filtered))
	}
}

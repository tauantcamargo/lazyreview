package components

import (
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

func TestNewChordHandler(t *testing.T) {
	tests := []struct {
		name        string
		timeout     time.Duration
		chords      []ChordConfig
		wantTimeout time.Duration
	}{
		{
			name:        "default timeout when zero",
			timeout:     0,
			chords:      DefaultChords(),
			wantTimeout: 500 * time.Millisecond,
		},
		{
			name:        "custom timeout",
			timeout:     300 * time.Millisecond,
			chords:      DefaultChords(),
			wantTimeout: 300 * time.Millisecond,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := NewChordHandler(tt.timeout, tt.chords)
			if handler == nil {
				t.Fatal("NewChordHandler returned nil")
			}
			if handler.timeout != tt.wantTimeout {
				t.Errorf("timeout = %v, want %v", handler.timeout, tt.wantTimeout)
			}
			if len(handler.chords) != len(tt.chords) {
				t.Errorf("chords length = %d, want %d", len(handler.chords), len(tt.chords))
			}
		})
	}
}

func TestChordHandler_HandleKey_CompleteChord(t *testing.T) {
	chords := []ChordConfig{
		{Keys: []string{"g", "g"}, Action: "goto_top"},
		{Keys: []string{"g", "c"}, Action: "general_comment"},
	}
	handler := NewChordHandler(500*time.Millisecond, chords)

	// Press 'g'
	action, consumed, isPending := handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})
	if action != "" {
		t.Errorf("first 'g' returned action %q, want empty", action)
	}
	if !consumed {
		t.Error("first 'g' not consumed")
	}
	if !isPending {
		t.Error("first 'g' should be pending")
	}

	// Press 'g' again to complete 'gg'
	action, consumed, isPending = handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})
	if action != "goto_top" {
		t.Errorf("second 'g' returned action %q, want 'goto_top'", action)
	}
	if !consumed {
		t.Error("second 'g' not consumed")
	}
	if isPending {
		t.Error("second 'g' should not be pending")
	}

	// Handler should be reset
	if len(handler.pending) != 0 {
		t.Errorf("pending sequence not reset, length = %d", len(handler.pending))
	}
}

func TestChordHandler_HandleKey_DifferentChords(t *testing.T) {
	chords := []ChordConfig{
		{Keys: []string{"g", "g"}, Action: "goto_top"},
		{Keys: []string{"g", "c"}, Action: "general_comment"},
	}
	handler := NewChordHandler(500*time.Millisecond, chords)

	// Press 'g'
	action, consumed, isPending := handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})
	if !consumed || !isPending || action != "" {
		t.Error("first 'g' should be consumed and pending")
	}

	// Press 'c' to complete 'gc'
	action, consumed, isPending = handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'c'}})
	if action != "general_comment" {
		t.Errorf("'gc' returned action %q, want 'general_comment'", action)
	}
	if !consumed {
		t.Error("'c' not consumed")
	}
	if isPending {
		t.Error("'c' should not be pending")
	}
}

func TestChordHandler_HandleKey_NonMatchingKey(t *testing.T) {
	chords := []ChordConfig{
		{Keys: []string{"g", "g"}, Action: "goto_top"},
	}
	handler := NewChordHandler(500*time.Millisecond, chords)

	// Press 'x' which doesn't start any chord
	action, consumed, isPending := handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'x'}})
	if action != "" {
		t.Errorf("non-matching key returned action %q, want empty", action)
	}
	if consumed {
		t.Error("non-matching key should not be consumed")
	}
	if isPending {
		t.Error("non-matching key should not be pending")
	}
}

func TestChordHandler_HandleKey_InvalidSequence(t *testing.T) {
	chords := []ChordConfig{
		{Keys: []string{"g", "g"}, Action: "goto_top"},
	}
	handler := NewChordHandler(500*time.Millisecond, chords)

	// Press 'g' then 'x' (invalid sequence)
	handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})
	action, consumed, isPending := handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'x'}})

	if action != "" {
		t.Errorf("invalid sequence returned action %q, want empty", action)
	}
	if consumed {
		t.Error("invalid sequence should not be consumed")
	}
	if isPending {
		t.Error("invalid sequence should not be pending")
	}
	if len(handler.pending) != 0 {
		t.Error("invalid sequence should reset pending")
	}
}

func TestChordHandler_HandleKey_Timeout(t *testing.T) {
	chords := []ChordConfig{
		{Keys: []string{"g", "g"}, Action: "goto_top"},
	}
	handler := NewChordHandler(50*time.Millisecond, chords)

	// Press 'g'
	handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})

	// Wait for timeout
	time.Sleep(100 * time.Millisecond)

	// Press 'g' again - should not complete chord due to timeout
	action, consumed, isPending := handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})

	// Since timeout expired, the first 'g' was discarded, so this 'g' starts a new sequence
	if action != "" {
		t.Errorf("after timeout, single 'g' returned action %q, want empty", action)
	}
	if !consumed {
		t.Error("'g' should be consumed as start of new sequence")
	}
	if !isPending {
		t.Error("'g' should be pending")
	}
}

func TestChordHandler_Reset(t *testing.T) {
	chords := DefaultChords()
	handler := NewChordHandler(500*time.Millisecond, chords)

	// Build a partial sequence
	handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})

	if len(handler.pending) == 0 {
		t.Error("pending should not be empty before reset")
	}

	handler.Reset()

	if len(handler.pending) != 0 {
		t.Errorf("pending length after reset = %d, want 0", len(handler.pending))
	}
	if handler.pendingAction != "" {
		t.Errorf("pendingAction after reset = %q, want empty", handler.pendingAction)
	}
	if !handler.lastKeyTime.IsZero() {
		t.Error("lastKeyTime should be zero after reset")
	}
}

func TestChordHandler_PendingSequence(t *testing.T) {
	chords := DefaultChords()
	handler := NewChordHandler(500*time.Millisecond, chords)

	// No pending sequence initially
	if seq := handler.PendingSequence(); seq != "" {
		t.Errorf("initial pending sequence = %q, want empty", seq)
	}

	// Press 'g'
	handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})

	if seq := handler.PendingSequence(); seq != "g" {
		t.Errorf("pending sequence = %q, want 'g'", seq)
	}

	// Complete the sequence
	handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})

	if seq := handler.PendingSequence(); seq != "" {
		t.Errorf("pending sequence after completion = %q, want empty", seq)
	}
}

func TestChordHandler_IsPending(t *testing.T) {
	chords := DefaultChords()
	handler := NewChordHandler(50*time.Millisecond, chords)

	// Not pending initially
	if handler.IsPending() {
		t.Error("should not be pending initially")
	}

	// Press 'g'
	handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})

	if !handler.IsPending() {
		t.Error("should be pending after first key")
	}

	// Wait for timeout
	time.Sleep(100 * time.Millisecond)

	if handler.IsPending() {
		t.Error("should not be pending after timeout")
	}
}

func TestChordHandler_GetPendingAction(t *testing.T) {
	chords := []ChordConfig{
		{Keys: []string{"g", "g"}, Action: "goto_top"},
	}
	handler := NewChordHandler(500*time.Millisecond, chords)

	// No pending action initially
	if action := handler.GetPendingAction(); action != "" {
		t.Errorf("initial pending action = %q, want empty", action)
	}

	// Press 'g' - should set pending action
	handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})

	if action := handler.GetPendingAction(); action != "goto_top" {
		t.Errorf("pending action = %q, want 'goto_top'", action)
	}

	// Complete sequence - should clear pending action
	handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})

	if action := handler.GetPendingAction(); action != "" {
		t.Errorf("pending action after completion = %q, want empty", action)
	}
}

func TestChordHandler_SetTimeout(t *testing.T) {
	handler := NewChordHandler(500*time.Millisecond, DefaultChords())

	newTimeout := 300 * time.Millisecond
	handler.SetTimeout(newTimeout)

	if handler.timeout != newTimeout {
		t.Errorf("timeout = %v, want %v", handler.timeout, newTimeout)
	}
}

func TestChordHandler_AddChord(t *testing.T) {
	handler := NewChordHandler(500*time.Millisecond, []ChordConfig{})

	if len(handler.chords) != 0 {
		t.Error("initial chords should be empty")
	}

	newChord := ChordConfig{
		Keys:   []string{"g", "g"},
		Action: "goto_top",
	}
	handler.AddChord(newChord)

	if len(handler.chords) != 1 {
		t.Errorf("chords length = %d, want 1", len(handler.chords))
	}
	if handler.chords[0].Action != "goto_top" {
		t.Errorf("chord action = %q, want 'goto_top'", handler.chords[0].Action)
	}
}

func TestChordHandler_RemoveChord(t *testing.T) {
	chords := []ChordConfig{
		{Keys: []string{"g", "g"}, Action: "goto_top"},
		{Keys: []string{"g", "c"}, Action: "general_comment"},
	}
	handler := NewChordHandler(500*time.Millisecond, chords)

	handler.RemoveChord("goto_top")

	if len(handler.chords) != 1 {
		t.Errorf("chords length = %d, want 1", len(handler.chords))
	}
	if handler.chords[0].Action != "general_comment" {
		t.Errorf("remaining chord action = %q, want 'general_comment'", handler.chords[0].Action)
	}
}

func TestChordHandler_GetChords(t *testing.T) {
	chords := DefaultChords()
	handler := NewChordHandler(500*time.Millisecond, chords)

	retrieved := handler.GetChords()

	if len(retrieved) != len(chords) {
		t.Errorf("retrieved chords length = %d, want %d", len(retrieved), len(chords))
	}

	// Verify it's a copy, not the original
	retrieved[0].Action = "modified"
	if handler.chords[0].Action == "modified" {
		t.Error("GetChords should return a copy, not the original slice")
	}
}

func TestDefaultChords(t *testing.T) {
	chords := DefaultChords()

	if len(chords) == 0 {
		t.Fatal("DefaultChords returned empty slice")
	}

	// Check for expected default chords
	expectedActions := map[string]bool{
		"goto_top":        false,
		"general_comment": false,
		"refresh":         false,
	}

	for _, chord := range chords {
		if _, exists := expectedActions[chord.Action]; exists {
			expectedActions[chord.Action] = true
		}
	}

	for action, found := range expectedActions {
		if !found {
			t.Errorf("default chords missing action: %s", action)
		}
	}
}

func TestChordHandler_ThreeKeyChord(t *testing.T) {
	chords := []ChordConfig{
		{Keys: []string{"g", "t", "t"}, Action: "goto_top_top"},
	}
	handler := NewChordHandler(500*time.Millisecond, chords)

	// Press first key
	action, consumed, isPending := handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})
	if action != "" || !consumed || !isPending {
		t.Error("first key should be consumed and pending")
	}

	// Press second key
	action, consumed, isPending = handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'t'}})
	if action != "" || !consumed || !isPending {
		t.Error("second key should be consumed and pending")
	}

	// Press third key
	action, consumed, isPending = handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'t'}})
	if action != "goto_top_top" {
		t.Errorf("three-key chord returned action %q, want 'goto_top_top'", action)
	}
	if !consumed || isPending {
		t.Error("third key should be consumed and not pending")
	}
}

func TestChordHandler_ConflictResolution(t *testing.T) {
	// Test that longer chords take precedence when they share a prefix
	chords := []ChordConfig{
		{Keys: []string{"g"}, Action: "single_g"},
		{Keys: []string{"g", "g"}, Action: "double_g"},
	}
	handler := NewChordHandler(500*time.Millisecond, chords)

	// Press first 'g' - should be pending because 'gg' is possible
	action, consumed, isPending := handler.HandleKey(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})

	// The handler will check if 'g' is a prefix of any chord
	// Since 'gg' exists, it should be consumed and pending
	if !consumed {
		t.Error("'g' should be consumed")
	}
	if !isPending {
		t.Error("'g' should be pending because 'gg' chord exists")
	}
	if action != "" {
		t.Errorf("'g' returned action %q, should be empty while pending", action)
	}
}

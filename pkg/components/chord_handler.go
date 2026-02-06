package components

import (
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

// ChordConfig represents a configurable chord sequence
type ChordConfig struct {
	// Keys is the sequence of keys that make up the chord (e.g., ["g", "g"])
	Keys []string
	// Action is the action identifier this chord triggers
	Action string
	// Description is a human-readable description of what this chord does
	Description string
}

// ChordHandler manages multi-key chord sequences with timeout support
type ChordHandler struct {
	// pending stores the current sequence of keys being built
	pending []tea.KeyMsg
	// timeout is the duration to wait for the next key in a sequence
	timeout time.Duration
	// lastKeyTime tracks when the last key was pressed
	lastKeyTime time.Time
	// chords is the list of configured chord sequences
	chords []ChordConfig
	// pendingAction stores the action if we're waiting for more keys
	pendingAction string
}

// NewChordHandler creates a new chord handler with the given timeout
func NewChordHandler(timeout time.Duration, chords []ChordConfig) *ChordHandler {
	if timeout == 0 {
		timeout = 500 * time.Millisecond
	}
	return &ChordHandler{
		pending: make([]tea.KeyMsg, 0, 3),
		timeout: timeout,
		chords:  chords,
	}
}

// DefaultChords returns the default chord configurations for vim-style sequences
func DefaultChords() []ChordConfig {
	return []ChordConfig{
		{
			Keys:        []string{"g", "g"},
			Action:      "goto_top",
			Description: "Go to top",
		},
		{
			Keys:        []string{"g", "c"},
			Action:      "general_comment",
			Description: "Add general comment",
		},
		{
			Keys:        []string{"g", "r"},
			Action:      "refresh",
			Description: "Refresh current view",
		},
	}
}

// HandleKey processes a key press and returns the action to execute if a chord is complete.
// Returns:
//   - action: The action string if a chord is complete, empty otherwise
//   - consumed: true if the key was consumed by the chord handler (part of a sequence)
//   - isPending: true if we're waiting for more keys to complete a chord
func (h *ChordHandler) HandleKey(msg tea.KeyMsg) (action string, consumed bool, isPending bool) {
	now := time.Now()

	// Check if timeout expired - reset pending sequence
	if len(h.pending) > 0 && now.Sub(h.lastKeyTime) > h.timeout {
		h.Reset()
	}

	// Add current key to pending sequence
	h.pending = append(h.pending, msg)
	h.lastKeyTime = now

	// Build current sequence string
	currentSeq := h.buildSequence()

	// Check if current sequence is a prefix of any longer chord
	// This must be checked before exact matches to handle conflicts
	hasLongerChord := false
	for _, chord := range h.chords {
		if h.isPrefix(currentSeq, chord.Keys) {
			hasLongerChord = true
			h.pendingAction = chord.Action
			break
		}
	}

	// If we have a longer chord possibility, wait for more keys
	if hasLongerChord {
		return "", true, true
	}

	// Check for exact chord match
	for _, chord := range h.chords {
		if h.matchesChord(currentSeq, chord.Keys) {
			action = chord.Action
			h.Reset()
			return action, true, false
		}
	}

	// No match and not a prefix - this key doesn't belong to any chord
	h.Reset()
	return "", false, false
}

// Reset clears the pending key sequence
func (h *ChordHandler) Reset() {
	h.pending = h.pending[:0]
	h.pendingAction = ""
	h.lastKeyTime = time.Time{}
}

// PendingSequence returns the current pending key sequence as a string for display
func (h *ChordHandler) PendingSequence() string {
	if len(h.pending) == 0 {
		return ""
	}
	return h.buildSequence()
}

// IsPending returns true if there's a pending sequence waiting for more keys
func (h *ChordHandler) IsPending() bool {
	if len(h.pending) == 0 {
		return false
	}

	// Check if timeout expired
	if time.Since(h.lastKeyTime) > h.timeout {
		h.Reset()
		return false
	}

	return true
}

// GetPendingAction returns the action that would be triggered if the sequence completes
func (h *ChordHandler) GetPendingAction() string {
	return h.pendingAction
}

// SetTimeout updates the chord timeout duration
func (h *ChordHandler) SetTimeout(timeout time.Duration) {
	h.timeout = timeout
}

// AddChord adds a new chord configuration
func (h *ChordHandler) AddChord(chord ChordConfig) {
	h.chords = append(h.chords, chord)
}

// RemoveChord removes a chord by action name
func (h *ChordHandler) RemoveChord(action string) {
	filtered := make([]ChordConfig, 0, len(h.chords))
	for _, chord := range h.chords {
		if chord.Action != action {
			filtered = append(filtered, chord)
		}
	}
	h.chords = filtered
}

// GetChords returns all configured chords
func (h *ChordHandler) GetChords() []ChordConfig {
	result := make([]ChordConfig, len(h.chords))
	copy(result, h.chords)
	return result
}

// buildSequence converts the pending key messages to a sequence string
func (h *ChordHandler) buildSequence() string {
	if len(h.pending) == 0 {
		return ""
	}
	keys := make([]string, len(h.pending))
	for i, msg := range h.pending {
		keys[i] = msg.String()
	}
	return strings.Join(keys, "")
}

// matchesChord checks if the current sequence exactly matches a chord
func (h *ChordHandler) matchesChord(current string, chordKeys []string) bool {
	if len(h.pending) != len(chordKeys) {
		return false
	}
	expected := strings.Join(chordKeys, "")
	return current == expected
}

// isPrefix checks if the current sequence is a prefix of a chord
func (h *ChordHandler) isPrefix(current string, chordKeys []string) bool {
	if len(h.pending) >= len(chordKeys) {
		return false
	}
	expected := strings.Join(chordKeys[:len(h.pending)], "")
	return current == expected
}

// chordTimeoutMsg is sent when the chord timeout expires
type chordTimeoutMsg struct{}

// ChordTimeoutCmd returns a command that sends a timeout message after the chord timeout
func ChordTimeoutCmd(timeout time.Duration) tea.Cmd {
	return tea.Tick(timeout, func(t time.Time) tea.Msg {
		return chordTimeoutMsg{}
	})
}

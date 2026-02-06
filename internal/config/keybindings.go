package config

// KeybindingsConfig holds all keybinding configurations
type KeybindingsConfig struct {
	Navigation NavigationKeys `mapstructure:"navigation"`
	Actions    ActionKeys     `mapstructure:"actions"`
	Global     GlobalKeys     `mapstructure:"global"`
	Chords     ChordsConfig   `mapstructure:"chords"`
}

// NavigationKeys defines vim-style navigation keybindings
type NavigationKeys struct {
	Up       string `mapstructure:"up"`
	Down     string `mapstructure:"down"`
	Left     string `mapstructure:"left"`
	Right    string `mapstructure:"right"`
	Top      string `mapstructure:"top"`
	Bottom   string `mapstructure:"bottom"`
	PageUp   string `mapstructure:"page_up"`
	PageDown string `mapstructure:"page_down"`
}

// ActionKeys defines keybindings for review actions
type ActionKeys struct {
	Approve        string `mapstructure:"approve"`
	RequestChanges string `mapstructure:"request_changes"`
	Comment        string `mapstructure:"comment"`
	OpenBrowser    string `mapstructure:"open_browser"`
	Checkout       string `mapstructure:"checkout"`
	Edit           string `mapstructure:"edit"`
	Delete         string `mapstructure:"delete"`
	Merge          string `mapstructure:"merge"`
	Refresh        string `mapstructure:"refresh"`
}

// GlobalKeys defines global keybindings available everywhere
type GlobalKeys struct {
	Quit      string `mapstructure:"quit"`
	Help      string `mapstructure:"help"`
	Search    string `mapstructure:"search"`
	Cancel    string `mapstructure:"cancel"`
	Confirm   string `mapstructure:"confirm"`
	NextPanel string `mapstructure:"next_panel"`
	PrevPanel string `mapstructure:"prev_panel"`
}

// DefaultKeybindings returns the default keybinding configuration
func DefaultKeybindings() KeybindingsConfig {
	return KeybindingsConfig{
		Navigation: NavigationKeys{
			Up:       "k",
			Down:     "j",
			Left:     "h",
			Right:    "l",
			Top:      "g",
			Bottom:   "G",
			PageUp:   "ctrl+u",
			PageDown: "ctrl+d",
		},
		Actions: ActionKeys{
			Approve:        "a",
			RequestChanges: "r",
			Comment:        "c",
			OpenBrowser:    "o",
			Checkout:       "C",
			Edit:           "e",
			Delete:         "d",
			Merge:          "m",
			Refresh:        "R",
		},
		Global: GlobalKeys{
			Quit:      "q",
			Help:      "?",
			Search:    "/",
			Cancel:    "esc",
			Confirm:   "enter",
			NextPanel: "tab",
			PrevPanel: "shift+tab",
		},
		Chords: DefaultChords(),
	}
}

// DefaultChords returns the default chord configuration
func DefaultChords() ChordsConfig {
	return ChordsConfig{
		Enabled: true,
		Timeout: 500,
		Sequences: []ChordSequence{
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
		},
	}
}

// Keybinding represents a single keybinding with its action
type Keybinding struct {
	Key         string
	Description string
	Handler     func() error
	Contexts    []string // Empty means global
}

// ChordsConfig holds chord (multi-key sequence) configuration
type ChordsConfig struct {
	// Enabled controls whether chord support is enabled (default: true in vim mode)
	Enabled bool `mapstructure:"enabled"`
	// Timeout is the milliseconds to wait for the next key in a sequence (default: 500)
	Timeout int `mapstructure:"timeout"`
	// Sequences is the list of configured chord sequences
	Sequences []ChordSequence `mapstructure:"sequences"`
}

// ChordSequence represents a multi-key sequence like "gg"
type ChordSequence struct {
	// Keys is the sequence of keys (e.g., ["g", "g"])
	Keys []string `mapstructure:"keys"`
	// Action is the action identifier this chord triggers
	Action string `mapstructure:"action"`
	// Description is a human-readable description
	Description string `mapstructure:"description"`
}

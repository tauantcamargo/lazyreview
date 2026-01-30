package config

// KeybindingsConfig holds all keybinding configurations
type KeybindingsConfig struct {
	Navigation NavigationKeys `mapstructure:"navigation"`
	Actions    ActionKeys     `mapstructure:"actions"`
	Global     GlobalKeys     `mapstructure:"global"`
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
	}
}

// Keybinding represents a single keybinding with its action
type Keybinding struct {
	Key         string
	Description string
	Handler     func() error
	Contexts    []string // Empty means global
}

// KeySequence represents a multi-key sequence like "gg"
type KeySequence struct {
	Keys        []string
	Description string
	Handler     func() error
	Timeout     int // milliseconds to wait for next key
}

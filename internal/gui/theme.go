package gui

import "strings"

type uiTheme struct {
	Name            string
	Added           string
	Deleted         string
	Context         string
	Hunk            string
	LineNo          string
	File            string
	CursorBg        string
	SelectionBg     string
	TreeSelectedBg  string
	TreeAdded       string
	TreeDeleted     string
	TreeModified    string
	TreeRenamed     string
	TreeDir         string
	TreeComment     string
	Accent          string
	HeaderBg        string
	FooterBg        string
	BorderFocused   string
	BorderUnfocused string
	Muted           string
}

func availableThemes() []string {
	return []string{"auto", "lazygit", "darcula", "tokyonight", "gruvbox", "catppuccin", "high-contrast"}
}

// AvailableThemesWithCustom returns all available themes including custom ones
func AvailableThemesWithCustom(loader *ThemeLoader) []string {
	builtIn := availableThemes()
	custom := []string{}

	if loader != nil {
		custom = loader.ListCustomThemes()
	}

	all := make([]string, 0, len(builtIn)+len(custom))
	all = append(all, builtIn...)
	all = append(all, custom...)

	return all
}

func resolveTheme(name string) uiTheme {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "lazygit":
		return uiTheme{
			Name:            "lazygit",
			Added:           "42",
			Deleted:         "196",
			Context:         "252",
			Hunk:            "75",
			LineNo:          "240",
			File:            "81",
			CursorBg:        "236",
			SelectionBg:     "238",
			TreeSelectedBg:  "237",
			TreeAdded:       "42",
			TreeDeleted:     "196",
			TreeModified:    "214",
			TreeRenamed:     "81",
			TreeDir:         "81",
			TreeComment:     "220",
			Accent:          "81",
			HeaderBg:        "236",
			FooterBg:        "236",
			BorderFocused:   "81",
			BorderUnfocused: "239",
			Muted:           "245",
		}
	case "darcula":
		return uiTheme{
			Name:            "darcula",
			Added:           "149",
			Deleted:         "203",
			Context:         "250",
			Hunk:            "110",
			LineNo:          "240",
			File:            "180",
			CursorBg:        "236",
			SelectionBg:     "237",
			TreeSelectedBg:  "238",
			TreeAdded:       "149",
			TreeDeleted:     "203",
			TreeModified:    "221",
			TreeRenamed:     "117",
			TreeDir:         "110",
			TreeComment:     "215",
			Accent:          "180",
			HeaderBg:        "236",
			FooterBg:        "236",
			BorderFocused:   "180",
			BorderUnfocused: "239",
			Muted:           "244",
		}
	case "tokyonight":
		return uiTheme{
			Name:            "tokyonight",
			Added:           "115",
			Deleted:         "210",
			Context:         "252",
			Hunk:            "117",
			LineNo:          "245",
			File:            "111",
			CursorBg:        "237",
			SelectionBg:     "238",
			TreeSelectedBg:  "238",
			TreeAdded:       "115",
			TreeDeleted:     "210",
			TreeModified:    "221",
			TreeRenamed:     "117",
			TreeDir:         "111",
			TreeComment:     "183",
			Accent:          "111",
			HeaderBg:        "237",
			FooterBg:        "237",
			BorderFocused:   "111",
			BorderUnfocused: "240",
			Muted:           "245",
		}
	case "gruvbox":
		return uiTheme{
			Name:            "gruvbox",
			Added:           "142",
			Deleted:         "167",
			Context:         "250",
			Hunk:            "109",
			LineNo:          "243",
			File:            "214",
			CursorBg:        "237",
			SelectionBg:     "239",
			TreeSelectedBg:  "239",
			TreeAdded:       "142",
			TreeDeleted:     "167",
			TreeModified:    "214",
			TreeRenamed:     "109",
			TreeDir:         "175",
			TreeComment:     "180",
			Accent:          "214",
			HeaderBg:        "237",
			FooterBg:        "237",
			BorderFocused:   "214",
			BorderUnfocused: "241",
			Muted:           "243",
		}
	case "catppuccin":
		return uiTheme{
			Name:            "catppuccin",
			Added:           "114",
			Deleted:         "204",
			Context:         "252",
			Hunk:            "111",
			LineNo:          "245",
			File:            "183",
			CursorBg:        "238",
			SelectionBg:     "239",
			TreeSelectedBg:  "239",
			TreeAdded:       "114",
			TreeDeleted:     "204",
			TreeModified:    "222",
			TreeRenamed:     "111",
			TreeDir:         "183",
			TreeComment:     "219",
			Accent:          "183",
			HeaderBg:        "238",
			FooterBg:        "238",
			BorderFocused:   "183",
			BorderUnfocused: "241",
			Muted:           "246",
		}
	case "high-contrast":
		return HighContrastTheme()
	default:
		return uiTheme{
			Name:            "auto",
			Added:           "42",
			Deleted:         "196",
			Context:         "252",
			Hunk:            "39",
			LineNo:          "240",
			File:            "170",
			CursorBg:        "236",
			SelectionBg:     "235",
			TreeSelectedBg:  "237",
			TreeAdded:       "42",
			TreeDeleted:     "196",
			TreeModified:    "214",
			TreeRenamed:     "39",
			TreeDir:         "75",
			TreeComment:     "205",
			Accent:          "170",
			HeaderBg:        "235",
			FooterBg:        "235",
			BorderFocused:   "170",
			BorderUnfocused: "240",
			Muted:           "240",
		}
	}
}

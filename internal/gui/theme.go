package gui

import "strings"

type uiTheme struct {
	Name           string
	Added          string
	Deleted        string
	Context        string
	Hunk           string
	LineNo         string
	File           string
	CursorBg       string
	SelectionBg    string
	TreeSelectedBg string
	TreeAdded      string
	TreeDeleted    string
	TreeModified   string
	TreeRenamed    string
	TreeDir        string
	TreeComment    string
}

func availableThemes() []string {
	return []string{"auto", "darcula", "tokyonight", "gruvbox", "catppuccin"}
}

func resolveTheme(name string) uiTheme {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "darcula":
		return uiTheme{
			Name:           "darcula",
			Added:          "149",
			Deleted:        "203",
			Context:        "250",
			Hunk:           "110",
			LineNo:         "240",
			File:           "180",
			CursorBg:       "236",
			SelectionBg:    "237",
			TreeSelectedBg: "238",
			TreeAdded:      "149",
			TreeDeleted:    "203",
			TreeModified:   "221",
			TreeRenamed:    "117",
			TreeDir:        "110",
			TreeComment:    "215",
		}
	case "tokyonight":
		return uiTheme{
			Name:           "tokyonight",
			Added:          "115",
			Deleted:        "210",
			Context:        "252",
			Hunk:           "117",
			LineNo:         "245",
			File:           "111",
			CursorBg:       "237",
			SelectionBg:    "238",
			TreeSelectedBg: "238",
			TreeAdded:      "115",
			TreeDeleted:    "210",
			TreeModified:   "221",
			TreeRenamed:    "117",
			TreeDir:        "111",
			TreeComment:    "183",
		}
	case "gruvbox":
		return uiTheme{
			Name:           "gruvbox",
			Added:          "142",
			Deleted:        "167",
			Context:        "250",
			Hunk:           "109",
			LineNo:         "243",
			File:           "214",
			CursorBg:       "237",
			SelectionBg:    "239",
			TreeSelectedBg: "239",
			TreeAdded:      "142",
			TreeDeleted:    "167",
			TreeModified:   "214",
			TreeRenamed:    "109",
			TreeDir:        "175",
			TreeComment:    "180",
		}
	case "catppuccin":
		return uiTheme{
			Name:           "catppuccin",
			Added:          "114",
			Deleted:        "204",
			Context:        "252",
			Hunk:           "111",
			LineNo:         "245",
			File:           "183",
			CursorBg:       "238",
			SelectionBg:    "239",
			TreeSelectedBg: "239",
			TreeAdded:      "114",
			TreeDeleted:    "204",
			TreeModified:   "222",
			TreeRenamed:    "111",
			TreeDir:        "183",
			TreeComment:    "219",
		}
	default:
		return uiTheme{
			Name:           "auto",
			Added:          "42",
			Deleted:        "196",
			Context:        "252",
			Hunk:           "39",
			LineNo:         "240",
			File:           "170",
			CursorBg:       "236",
			SelectionBg:    "235",
			TreeSelectedBg: "237",
			TreeAdded:      "42",
			TreeDeleted:    "196",
			TreeModified:   "214",
			TreeRenamed:    "39",
			TreeDir:        "75",
			TreeComment:    "205",
		}
	}
}

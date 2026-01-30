package models

// Diff represents the complete diff for a pull request
type Diff struct {
	// Files is the list of file changes in the diff
	Files []FileDiff

	// Additions is the total lines added
	Additions int

	// Deletions is the total lines deleted
	Deletions int
}

// FileDiff represents changes to a single file
type FileDiff struct {
	// Path is the current file path
	Path string

	// OldPath is the previous file path (for renames)
	OldPath string

	// Status indicates the type of change
	Status FileStatus

	// Additions is the lines added in this file
	Additions int

	// Deletions is the lines deleted in this file
	Deletions int

	// IsBinary indicates if this is a binary file
	IsBinary bool

	// Hunks are the diff hunks for this file
	Hunks []Hunk

	// Patch is the raw patch content
	Patch string
}

// FileStatus represents the status of a file in a diff
type FileStatus string

const (
	FileStatusAdded      FileStatus = "added"
	FileStatusModified   FileStatus = "modified"
	FileStatusDeleted    FileStatus = "deleted"
	FileStatusRenamed    FileStatus = "renamed"
	FileStatusCopied     FileStatus = "copied"
	FileStatusUnchanged  FileStatus = "unchanged"
)

// Hunk represents a single diff hunk
type Hunk struct {
	// OldStart is the starting line in the old file
	OldStart int

	// OldLines is the number of lines in the old file
	OldLines int

	// NewStart is the starting line in the new file
	NewStart int

	// NewLines is the number of lines in the new file
	NewLines int

	// Header is the hunk header (e.g., "@@ -1,5 +1,7 @@")
	Header string

	// Lines are the individual diff lines
	Lines []DiffLine
}

// DiffLine represents a single line in a diff
type DiffLine struct {
	// Type is the line type (context, added, deleted)
	Type DiffLineType

	// Content is the line content (without the +/- prefix)
	Content string

	// OldLineNo is the line number in the old file (0 if not applicable)
	OldLineNo int

	// NewLineNo is the line number in the new file (0 if not applicable)
	NewLineNo int
}

// DiffLineType represents the type of a diff line
type DiffLineType string

const (
	DiffLineContext DiffLineType = "context"  // Unchanged line
	DiffLineAdded   DiffLineType = "added"    // Added line
	DiffLineDeleted DiffLineType = "deleted"  // Deleted line
	DiffLineHunk    DiffLineType = "hunk"     // Hunk header
)

// Prefix returns the diff prefix character for this line type
func (t DiffLineType) Prefix() string {
	switch t {
	case DiffLineAdded:
		return "+"
	case DiffLineDeleted:
		return "-"
	default:
		return " "
	}
}

// TotalChanges returns the total number of changes in the diff
func (d *Diff) TotalChanges() int {
	return d.Additions + d.Deletions
}

// FileCount returns the number of files in the diff
func (d *Diff) FileCount() int {
	return len(d.Files)
}

// GetFile returns the FileDiff for a given path
func (d *Diff) GetFile(path string) *FileDiff {
	for i := range d.Files {
		if d.Files[i].Path == path {
			return &d.Files[i]
		}
	}
	return nil
}

// IsRename returns true if this file was renamed
func (f *FileDiff) IsRename() bool {
	return f.Status == FileStatusRenamed && f.OldPath != ""
}

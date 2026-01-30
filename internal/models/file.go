package models

// FileChange represents a changed file in a pull request
// This is a lighter representation than FileDiff, used for file listings
type FileChange struct {
	// Filename is the file path
	Filename string

	// PreviousFilename is the old path (for renames)
	PreviousFilename string

	// Status is the change status
	Status FileStatus

	// Additions is lines added
	Additions int

	// Deletions is lines deleted
	Deletions int

	// Changes is total lines changed
	Changes int

	// Patch is the raw patch (may be truncated for large files)
	Patch string

	// SHA is the blob SHA
	SHA string

	// ContentsURL is the URL to fetch file contents
	ContentsURL string
}

// TotalChanges returns the total number of line changes
func (f *FileChange) TotalChanges() int {
	if f.Changes > 0 {
		return f.Changes
	}
	return f.Additions + f.Deletions
}

// IsRename returns true if this is a rename
func (f *FileChange) IsRename() bool {
	return f.Status == FileStatusRenamed && f.PreviousFilename != ""
}

// DisplayName returns the best name to display
func (f *FileChange) DisplayName() string {
	if f.IsRename() {
		return f.PreviousFilename + " → " + f.Filename
	}
	return f.Filename
}

// StatusIcon returns an icon representing the file status
func (f *FileChange) StatusIcon() string {
	switch f.Status {
	case FileStatusAdded:
		return "A"
	case FileStatusModified:
		return "M"
	case FileStatusDeleted:
		return "D"
	case FileStatusRenamed:
		return "R"
	case FileStatusCopied:
		return "C"
	default:
		return "?"
	}
}

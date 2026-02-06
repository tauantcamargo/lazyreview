package benchmarks

import (
	"strings"
	"testing"

	"lazyreview/internal/models"
	"lazyreview/pkg/components"
)

// BenchmarkDiffParsing benchmarks parsing unified diff format
func BenchmarkDiffParsing(b *testing.B) {
	diffText := generateLargeDiff(1000)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = parseDiff(diffText)
	}
}

// BenchmarkDiffRendering benchmarks rendering diff with syntax highlighting
func BenchmarkDiffRendering(b *testing.B) {
	diff := generateTestDiff(100)
	highlighter := components.NewHighlighter()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, file := range diff.Files {
			for _, hunk := range file.Hunks {
				for _, line := range hunk.Lines {
					_ = highlighter.HighlightLine(line.Content, file.Path)
				}
			}
		}
	}
}

// BenchmarkDiffRenderingLarge benchmarks rendering large diffs
func BenchmarkDiffRenderingLarge(b *testing.B) {
	diff := generateTestDiff(1000)
	highlighter := components.NewHighlighter()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, file := range diff.Files {
			for _, hunk := range file.Hunks {
				for _, line := range hunk.Lines {
					_ = highlighter.HighlightLine(line.Content, file.Path)
				}
			}
		}
	}
}

// BenchmarkDiffNavigation benchmarks navigating through diff hunks
func BenchmarkDiffNavigation(b *testing.B) {
	diff := generateTestDiff(500)
	currentFile := 0
	currentHunk := 0

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Simulate navigation
		currentHunk++
		if currentHunk >= len(diff.Files[currentFile].Hunks) {
			currentHunk = 0
			currentFile = (currentFile + 1) % len(diff.Files)
		}
		_ = diff.Files[currentFile].Hunks[currentHunk]
	}
}

// BenchmarkDiffLineHighlighting benchmarks syntax highlighting for different languages
func BenchmarkDiffLineHighlighting(b *testing.B) {
	highlighter := components.NewHighlighter()
	testCases := []struct {
		filename string
		code     string
	}{
		{"main.go", "func main() { fmt.Println(\"hello\") }"},
		{"app.js", "const foo = (bar) => { return bar * 2; }"},
		{"script.py", "def hello(): print('world')"},
		{"main.rs", "fn main() { println!(\"hello\"); }"},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		tc := testCases[i%len(testCases)]
		_ = highlighter.HighlightLine(tc.code, tc.filename)
	}
}

// BenchmarkDiffHunkExpansion benchmarks expanding collapsed hunks
func BenchmarkDiffHunkExpansion(b *testing.B) {
	diff := generateTestDiff(100)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Simulate expanding all hunks
		for _, file := range diff.Files {
			for _, hunk := range file.Hunks {
				_ = hunk.Lines
			}
		}
	}
}

// BenchmarkDiffCommentInsertion benchmarks inserting comments in diff
func BenchmarkDiffCommentInsertion(b *testing.B) {
	diff := generateTestDiff(100)
	comments := make(map[string][]models.Comment)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		key := diff.Files[i%len(diff.Files)].Path + ":" + string(rune(i%50))
		comments[key] = append(comments[key], models.Comment{
			ID:   string(rune(i)),
			Body: "Test comment",
			Line: i % 50,
		})
	}
}

// generateTestDiff creates a test diff with specified number of files
func generateTestDiff(fileCount int) models.Diff {
	diff := models.Diff{
		Files: make([]models.FileDiff, fileCount),
	}

	for i := 0; i < fileCount; i++ {
		file := models.FileDiff{
			Path:      "pkg/test/file" + string(rune(i)) + ".go",
			OldPath:   "pkg/test/file" + string(rune(i)) + ".go",
			Additions: 50,
			Deletions: 30,
			Status:    models.FileStatusModified,
			Hunks:     make([]models.Hunk, 5),
		}

		for j := 0; j < 5; j++ {
			hunk := models.Hunk{
				OldStart: j * 20,
				OldLines: 10,
				NewStart: j * 20,
				NewLines: 15,
				Lines:    make([]models.DiffLine, 25),
			}

			for k := 0; k < 25; k++ {
				lineType := models.DiffLineContext
				if k%3 == 0 {
					lineType = models.DiffLineAdded
				} else if k%5 == 0 {
					lineType = models.DiffLineDeleted
				}

				hunk.Lines[k] = models.DiffLine{
					Type:      lineType,
					Content:   "func TestSomething() { return nil }",
					OldLineNo: j*20 + k,
					NewLineNo: j*20 + k,
				}
			}

			file.Hunks[j] = hunk
		}

		diff.Files[i] = file
	}

	return diff
}

// generateLargeDiff creates a large unified diff text for parsing
func generateLargeDiff(lineCount int) string {
	var builder strings.Builder

	builder.WriteString("diff --git a/test.go b/test.go\n")
	builder.WriteString("index 1234567..abcdefg 100644\n")
	builder.WriteString("--- a/test.go\n")
	builder.WriteString("+++ b/test.go\n")
	builder.WriteString("@@ -1,500 +1,500 @@\n")

	for i := 0; i < lineCount; i++ {
		if i%3 == 0 {
			builder.WriteString("+func NewFunction() {\n")
		} else if i%5 == 0 {
			builder.WriteString("-func OldFunction() {\n")
		} else {
			builder.WriteString(" func ExistingFunction() {\n")
		}
	}

	return builder.String()
}

// parseDiff is a simple diff parser for benchmarking
func parseDiff(diffText string) []string {
	return strings.Split(diffText, "\n")
}

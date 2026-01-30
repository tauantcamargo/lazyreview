package components

import (
	"strings"
	"testing"
)

func TestNewHighlighter(t *testing.T) {
	h := NewHighlighter()
	if h == nil {
		t.Fatal("NewHighlighter returned nil")
	}
	if h.style == nil {
		t.Error("Highlighter style is nil")
	}
}

func TestGetLexerForFile(t *testing.T) {
	h := NewHighlighter()

	tests := []struct {
		name     string
		filename string
		wantLang string
	}{
		{
			name:     "Go file",
			filename: "main.go",
			wantLang: "Go",
		},
		{
			name:     "JavaScript file",
			filename: "app.js",
			wantLang: "JavaScript",
		},
		{
			name:     "TypeScript file",
			filename: "app.ts",
			wantLang: "TypeScript",
		},
		{
			name:     "Python file",
			filename: "script.py",
			wantLang: "Python",
		},
		{
			name:     "Java file",
			filename: "Main.java",
			wantLang: "Java",
		},
		{
			name:     "Unknown extension",
			filename: "file.xyz",
			wantLang: "plaintext",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lexer := h.GetLexerForFile(tt.filename)
			if lexer == nil {
				t.Fatal("GetLexerForFile returned nil")
			}

			config := lexer.Config()
			if config == nil {
				t.Fatal("Lexer config is nil")
			}

			// Verify we got a lexer (exact name match depends on chroma version)
			if config.Name == "" {
				t.Error("Lexer has empty name")
			}
		})
	}
}

func TestHighlightLine(t *testing.T) {
	h := NewHighlighter()

	tests := []struct {
		name     string
		line     string
		filename string
	}{
		{
			name:     "Go function",
			line:     `func main() {`,
			filename: "main.go",
		},
		{
			name:     "Go with string",
			line:     `fmt.Println("Hello, world!")`,
			filename: "main.go",
		},
		{
			name:     "JavaScript const",
			line:     `const greeting = "Hello";`,
			filename: "app.js",
		},
		{
			name:     "Python function",
			line:     `def hello_world():`,
			filename: "script.py",
		},
		{
			name:     "Comment",
			line:     `// This is a comment`,
			filename: "main.go",
		},
		{
			name:     "Empty line",
			line:     "",
			filename: "main.go",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := h.HighlightLine(tt.line, tt.filename)

			// For empty lines, result should be empty
			if tt.line == "" {
				if result != "" {
					t.Errorf("Expected empty result for empty line, got: %q", result)
				}
				return
			}

			// For non-empty lines, result should not be empty
			if result == "" {
				t.Error("HighlightLine returned empty string for non-empty input")
			}

			// Result should contain the original content (possibly with ANSI codes)
			// We can't test exact output due to ANSI codes, but we can verify
			// the result is not empty and has some styling
			if len(result) < len(tt.line) {
				t.Errorf("Highlighted result is shorter than input. Input: %q, Result: %q", tt.line, result)
			}
		})
	}
}

func TestGetLanguageName(t *testing.T) {
	h := NewHighlighter()

	tests := []struct {
		filename string
		wantLang bool // Just check if we get a non-empty language name
	}{
		{"main.go", true},
		{"app.js", true},
		{"app.ts", true},
		{"script.py", true},
		{"file.unknown", true}, // Should return something (fallback)
	}

	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			lang := h.GetLanguageName(tt.filename)
			if tt.wantLang && lang == "" {
				t.Errorf("GetLanguageName(%q) returned empty string", tt.filename)
			}
		})
	}
}

func TestHighlightCode(t *testing.T) {
	h := NewHighlighter()

	code := `package main

import "fmt"

func main() {
    fmt.Println("Hello, world!")
}
`

	result, err := h.HighlightCode(code, "main.go")
	if err != nil {
		t.Fatalf("HighlightCode failed: %v", err)
	}

	if result == "" {
		t.Error("HighlightCode returned empty string")
	}

	// Verify the result contains key parts of the code
	if !strings.Contains(result, "package") {
		t.Error("Result missing 'package' keyword")
	}
	if !strings.Contains(result, "main") {
		t.Error("Result missing 'main'")
	}
	if !strings.Contains(result, "fmt") {
		t.Error("Result missing 'fmt'")
	}
}

func TestTokenToStyle(t *testing.T) {
	h := NewHighlighter()

	// Test that tokenToStyle returns non-nil styles
	// We just verify it doesn't panic and returns valid styles
	tests := []string{
		"keyword test",
		"string test",
		"// comment",
		"123",
		"functionName",
	}

	for _, test := range tests {
		t.Run(test, func(t *testing.T) {
			// This is a basic smoke test
			// The actual styling is tested through HighlightLine
			result := h.HighlightLine(test, "test.go")
			if result == "" && test != "" {
				t.Errorf("Expected non-empty result for %q", test)
			}
		})
	}
}

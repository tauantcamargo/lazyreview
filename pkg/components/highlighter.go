package components

import (
	"bytes"
	"strings"

	"github.com/alecthomas/chroma/v2"
	"github.com/alecthomas/chroma/v2/lexers"
	"github.com/alecthomas/chroma/v2/styles"
	"github.com/charmbracelet/lipgloss"
)

// Highlighter provides syntax highlighting for code
type Highlighter struct {
	style *chroma.Style
}

// NewHighlighter creates a new highlighter
func NewHighlighter() *Highlighter {
	return &Highlighter{
		style: styles.Get("monokai"), // Good for dark terminals
	}
}

// HighlightLine applies syntax highlighting to a single line of code
func (h *Highlighter) HighlightLine(line string, filename string) string {
	if line == "" {
		return ""
	}

	// Get lexer based on filename extension
	lexer := h.GetLexerForFile(filename)

	// Tokenize the line
	tokens, err := lexer.Tokenise(nil, line)
	if err != nil {
		return line // Fallback to plain text
	}

	// Build styled output
	var result strings.Builder
	for _, token := range tokens.Tokens() {
		style := h.tokenToStyle(token.Type)
		result.WriteString(style.Render(token.Value))
	}

	return result.String()
}

// GetLexerForFile returns the appropriate lexer for a file
func (h *Highlighter) GetLexerForFile(filename string) chroma.Lexer {
	lexer := lexers.Match(filename)
	if lexer == nil {
		// Try to analyze the content for better detection
		lexer = lexers.Analyse(filename)
	}
	if lexer == nil {
		return lexers.Fallback
	}
	return chroma.Coalesce(lexer)
}

// tokenToStyle maps chroma token types to lipgloss styles
func (h *Highlighter) tokenToStyle(tokenType chroma.TokenType) lipgloss.Style {
	// Use 256-color palette for better terminal compatibility
	switch tokenType {
	// Keywords
	case chroma.Keyword, chroma.KeywordConstant, chroma.KeywordDeclaration,
		chroma.KeywordNamespace, chroma.KeywordPseudo, chroma.KeywordReserved,
		chroma.KeywordType:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("204")) // Pink/Magenta

	// Strings
	case chroma.String, chroma.StringAffix, chroma.StringBacktick,
		chroma.StringChar, chroma.StringDelimiter, chroma.StringDoc,
		chroma.StringDouble, chroma.StringEscape, chroma.StringHeredoc,
		chroma.StringInterpol, chroma.StringOther, chroma.StringRegex,
		chroma.StringSingle, chroma.StringSymbol:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("228")) // Yellow

	// Comments
	case chroma.Comment, chroma.CommentHashbang, chroma.CommentMultiline,
		chroma.CommentSingle, chroma.CommentSpecial, chroma.CommentPreproc,
		chroma.CommentPreprocFile:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("244")).Italic(true) // Gray

	// Numbers
	case chroma.Number, chroma.NumberBin, chroma.NumberFloat,
		chroma.NumberHex, chroma.NumberInteger, chroma.NumberIntegerLong,
		chroma.NumberOct:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("141")) // Purple

	// Functions
	case chroma.Name, chroma.NameFunction, chroma.NameBuiltin,
		chroma.NameBuiltinPseudo:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("81")) // Cyan/Blue

	// Classes and types
	case chroma.NameClass, chroma.NameException:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("117")) // Light blue

	// Variables and attributes
	case chroma.NameAttribute, chroma.NameVariable, chroma.NameVariableClass,
		chroma.NameVariableGlobal, chroma.NameVariableInstance:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("117")) // Light blue

	// Operators
	case chroma.Operator, chroma.OperatorWord:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("197")) // Red

	// Punctuation
	case chroma.Punctuation:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("252")) // Light gray

	// Constants
	case chroma.NameConstant:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("141")) // Purple

	// Decorators
	case chroma.NameDecorator:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("117")) // Light blue

	// Labels and tags
	case chroma.NameLabel, chroma.NameTag:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("204")) // Pink

	// Errors
	case chroma.Error:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Bold(true) // Bright red

	// Generic (diff-specific)
	case chroma.GenericDeleted:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("196")) // Red
	case chroma.GenericInserted:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("42")) // Green
	case chroma.GenericHeading:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("39")).Bold(true) // Blue
	case chroma.GenericSubheading:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("81")) // Cyan

	// Default - plain text
	default:
		return lipgloss.NewStyle().Foreground(lipgloss.Color("252")) // Light gray
	}
}

// HighlightCode highlights an entire code block (for future use)
func (h *Highlighter) HighlightCode(code string, filename string) (string, error) {
	lexer := h.GetLexerForFile(filename)

	// Tokenize the code
	tokens, err := lexer.Tokenise(nil, code)
	if err != nil {
		return code, err
	}

	// Build styled output
	var buf bytes.Buffer
	for _, token := range tokens.Tokens() {
		style := h.tokenToStyle(token.Type)
		buf.WriteString(style.Render(token.Value))
	}

	return buf.String(), nil
}

// GetLanguageName returns the language name for a file
func (h *Highlighter) GetLanguageName(filename string) string {
	lexer := h.GetLexerForFile(filename)
	if lexer == nil {
		return "text"
	}
	config := lexer.Config()
	if config == nil {
		return "text"
	}
	return config.Name
}

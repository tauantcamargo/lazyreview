package components

import (
	"bytes"
	"path/filepath"
	"strings"

	"github.com/alecthomas/chroma/v2"
	"github.com/alecthomas/chroma/v2/lexers"
	"github.com/alecthomas/chroma/v2/styles"
	"github.com/charmbracelet/lipgloss"
)

// Highlighter provides syntax highlighting for code
type Highlighter struct {
	style      *chroma.Style
	lineCache  map[string]string
	lexerCache map[string]chroma.Lexer
	styleCache map[chroma.TokenType]lipgloss.Style
}

// NewHighlighter creates a new highlighter
func NewHighlighter() *Highlighter {
	return &Highlighter{
		style:      styles.Get("monokai"), // Good for dark terminals
		lineCache:  map[string]string{},
		lexerCache: map[string]chroma.Lexer{},
		styleCache: map[chroma.TokenType]lipgloss.Style{},
	}
}

// HighlightLine applies syntax highlighting to a single line of code
func (h *Highlighter) HighlightLine(line string, filename string) string {
	if line == "" {
		return ""
	}
	cacheKey := filename + "\x00" + line
	if highlighted, ok := h.lineCache[cacheKey]; ok {
		return highlighted
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

	highlighted := result.String()
	if len(h.lineCache) > 8192 {
		h.lineCache = map[string]string{}
	}
	h.lineCache[cacheKey] = highlighted
	return highlighted
}

// GetLexerForFile returns the appropriate lexer for a file
func (h *Highlighter) GetLexerForFile(filename string) chroma.Lexer {
	cacheKey := strings.ToLower(strings.TrimSpace(filename))
	ext := strings.ToLower(filepath.Ext(cacheKey))
	if ext != "" {
		cacheKey = ext
	}
	if lexer, ok := h.lexerCache[cacheKey]; ok {
		return lexer
	}

	lexer := lexers.Match(filename)
	if lexer == nil {
		// Try to analyze the content for better detection
		lexer = lexers.Analyse(filename)
	}
	if lexer == nil {
		lexer = lexers.Fallback
	}
	lexer = chroma.Coalesce(lexer)
	h.lexerCache[cacheKey] = lexer
	return lexer
}

// tokenToStyle maps chroma token types to lipgloss styles
func (h *Highlighter) tokenToStyle(tokenType chroma.TokenType) lipgloss.Style {
	if style, ok := h.styleCache[tokenType]; ok {
		return style
	}
	var style lipgloss.Style
	// Use 256-color palette for better terminal compatibility
	switch tokenType {
	// Keywords
	case chroma.Keyword, chroma.KeywordConstant, chroma.KeywordDeclaration,
		chroma.KeywordNamespace, chroma.KeywordPseudo, chroma.KeywordReserved,
		chroma.KeywordType:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("204")) // Pink/Magenta

	// Strings
	case chroma.String, chroma.StringAffix, chroma.StringBacktick,
		chroma.StringChar, chroma.StringDelimiter, chroma.StringDoc,
		chroma.StringDouble, chroma.StringEscape, chroma.StringHeredoc,
		chroma.StringInterpol, chroma.StringOther, chroma.StringRegex,
		chroma.StringSingle, chroma.StringSymbol:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("228")) // Yellow

	// Comments
	case chroma.Comment, chroma.CommentHashbang, chroma.CommentMultiline,
		chroma.CommentSingle, chroma.CommentSpecial, chroma.CommentPreproc,
		chroma.CommentPreprocFile:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("244")).Italic(true) // Gray

	// Numbers
	case chroma.Number, chroma.NumberBin, chroma.NumberFloat,
		chroma.NumberHex, chroma.NumberInteger, chroma.NumberIntegerLong,
		chroma.NumberOct:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("141")) // Purple

	// Functions
	case chroma.Name, chroma.NameFunction, chroma.NameBuiltin,
		chroma.NameBuiltinPseudo:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("81")) // Cyan/Blue

	// Classes and types
	case chroma.NameClass, chroma.NameException:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("117")) // Light blue

	// Variables and attributes
	case chroma.NameAttribute, chroma.NameVariable, chroma.NameVariableClass,
		chroma.NameVariableGlobal, chroma.NameVariableInstance:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("117")) // Light blue

	// Operators
	case chroma.Operator, chroma.OperatorWord:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("197")) // Red

	// Punctuation
	case chroma.Punctuation:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("252")) // Light gray

	// Constants
	case chroma.NameConstant:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("141")) // Purple

	// Decorators
	case chroma.NameDecorator:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("117")) // Light blue

	// Labels and tags
	case chroma.NameLabel, chroma.NameTag:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("204")) // Pink

	// Errors
	case chroma.Error:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Bold(true) // Bright red

	// Generic (diff-specific)
	case chroma.GenericDeleted:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("196")) // Red
	case chroma.GenericInserted:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("42")) // Green
	case chroma.GenericHeading:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("39")).Bold(true) // Blue
	case chroma.GenericSubheading:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("81")) // Cyan

	// Default - plain text
	default:
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("252")) // Light gray
	}
	h.styleCache[tokenType] = style
	return style
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

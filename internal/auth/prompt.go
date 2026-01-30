package auth

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"golang.org/x/term"
)

// Prompter handles interactive user prompts
type Prompter struct {
	reader *bufio.Reader
}

// NewPrompter creates a new prompter
func NewPrompter() *Prompter {
	return &Prompter{
		reader: bufio.NewReader(os.Stdin),
	}
}

// Prompt displays a prompt and reads user input
func (p *Prompter) Prompt(prompt string) (string, error) {
	fmt.Print(prompt)
	input, err := p.reader.ReadString('\n')
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(input), nil
}

// PromptSecret displays a prompt and reads secret input (masked)
func (p *Prompter) PromptSecret(prompt string) (string, error) {
	fmt.Print(prompt)

	// Check if stdin is a terminal
	fd := int(os.Stdin.Fd())
	if !term.IsTerminal(fd) {
		// Not a terminal, read normally
		input, err := p.reader.ReadString('\n')
		if err != nil {
			return "", err
		}
		return strings.TrimSpace(input), nil
	}

	// Read password with terminal in raw mode (no echo)
	password, err := term.ReadPassword(fd)
	fmt.Println() // Add newline after password input
	if err != nil {
		return "", err
	}

	return string(password), nil
}

// Confirm displays a yes/no prompt
func (p *Prompter) Confirm(prompt string, defaultYes bool) (bool, error) {
	suffix := " [y/N]: "
	if defaultYes {
		suffix = " [Y/n]: "
	}

	input, err := p.Prompt(prompt + suffix)
	if err != nil {
		return false, err
	}

	input = strings.ToLower(strings.TrimSpace(input))
	if input == "" {
		return defaultYes, nil
	}

	return input == "y" || input == "yes", nil
}

// Select displays a selection prompt and returns the chosen index
func (p *Prompter) Select(prompt string, options []string) (int, error) {
	fmt.Println(prompt)
	for i, opt := range options {
		fmt.Printf("  %d. %s\n", i+1, opt)
	}

	for {
		input, err := p.Prompt("Enter choice (1-" + fmt.Sprintf("%d", len(options)) + "): ")
		if err != nil {
			return -1, err
		}

		var choice int
		if _, err := fmt.Sscanf(input, "%d", &choice); err == nil {
			if choice >= 1 && choice <= len(options) {
				return choice - 1, nil
			}
		}

		fmt.Println("Invalid choice, please try again.")
	}
}

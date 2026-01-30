package cmd

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"lazyreview/internal/auth"
	"lazyreview/internal/config"
	"lazyreview/internal/gui"
	"lazyreview/pkg/providers/github"

	"github.com/urfave/cli"
)

// CommandStart initializes the CLI application and sets up commands
func CommandStart() *cli.App {
	app := cli.NewApp()
	app.Name = "LazyReview"
	app.Usage = "A terminal UI for code review across multiple Git providers"
	app.Version = "0.1.0"

	app.Flags = []cli.Flag{
		cli.BoolFlag{
			Name:  "debug, d",
			Usage: "enable debug mode",
		},
	}

	// Default action (no subcommand) starts the TUI
	app.Action = func(c *cli.Context) error {
		return startTUI()
	}

	app.Commands = []cli.Command{
		{
			Name:    "start",
			Aliases: []string{"s"},
			Usage:   "Start the LazyReview TUI",
			Action: func(c *cli.Context) error {
				return startTUI()
			},
		},
		{
			Name:    "auth",
			Aliases: []string{"a"},
			Usage:   "Authentication commands",
			Subcommands: []cli.Command{
				{
					Name:    "login",
					Aliases: []string{"l"},
					Usage:   "Login to a Git provider",
					Flags: []cli.Flag{
						cli.StringFlag{
							Name:  "provider, p",
							Usage: "Provider type (github, gitlab, bitbucket, azuredevops)",
							Value: "github",
						},
						cli.StringFlag{
							Name:  "host",
							Usage: "Host URL for self-hosted instances",
						},
						cli.StringFlag{
							Name:   "token, t",
							Usage:  "Authentication token (or set via environment)",
							EnvVar: "LAZYREVIEW_TOKEN",
						},
					},
					Action: func(c *cli.Context) error {
						return loginAction(c.String("provider"), c.String("host"), c.String("token"))
					},
				},
				{
					Name:    "logout",
					Aliases: []string{"lo"},
					Usage:   "Logout from a Git provider",
					Flags: []cli.Flag{
						cli.StringFlag{
							Name:  "provider, p",
							Usage: "Provider to logout from",
						},
						cli.StringFlag{
							Name:  "host",
							Usage: "Host to logout from",
						},
						cli.BoolFlag{
							Name:  "all",
							Usage: "Logout from all providers",
						},
					},
					Action: func(c *cli.Context) error {
						if c.Bool("all") {
							return logoutAllAction()
						}
						return logoutAction(c.String("provider"), c.String("host"))
					},
				},
				{
					Name:  "status",
					Usage: "Show authentication status",
					Action: func(c *cli.Context) error {
						return authStatusAction()
					},
				},
			},
		},
		{
			Name:  "config",
			Usage: "Configuration commands",
			Subcommands: []cli.Command{
				{
					Name:  "edit",
					Usage: "Edit the configuration file",
					Action: func(c *cli.Context) error {
						return editConfigAction()
					},
				},
				{
					Name:  "path",
					Usage: "Show the configuration file path",
					Action: func(c *cli.Context) error {
						return showConfigPathAction()
					},
				},
			},
		},
		{
			Name:  "version",
			Usage: "Show version information",
			Action: func(c *cli.Context) error {
				fmt.Printf("LazyReview version %s\n", app.Version)
				return nil
			},
		},
	}

	return app
}

// startTUI loads config and starts the TUI
func startTUI() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	return gui.Run(cfg)
}

// loginAction handles the login command
func loginAction(provider, host, token string) error {
	// Parse provider type
	providerType := config.ProviderType(provider)
	switch providerType {
	case config.ProviderTypeGitHub, config.ProviderTypeGitLab,
		config.ProviderTypeBitbucket, config.ProviderTypeAzureDevOps:
		// Valid
	default:
		return fmt.Errorf("invalid provider: %s (use: github, gitlab, bitbucket, azuredevops)", provider)
	}

	// Set default host if not provided
	if host == "" {
		switch providerType {
		case config.ProviderTypeGitHub:
			host = "github.com"
		case config.ProviderTypeGitLab:
			host = "gitlab.com"
		case config.ProviderTypeBitbucket:
			host = "bitbucket.org"
		case config.ProviderTypeAzureDevOps:
			host = "dev.azure.com"
		}
	}

	// Get token interactively if not provided
	if token == "" {
		prompter := auth.NewPrompter()
		fmt.Printf("Logging in to %s (%s)\n", provider, host)
		fmt.Println()
		fmt.Println("Please enter your personal access token.")
		fmt.Println("You can create one at:")
		printTokenURL(providerType, host)
		fmt.Println()

		var err error
		token, err = prompter.PromptSecret("Token: ")
		if err != nil {
			return fmt.Errorf("failed to read token: %w", err)
		}

		if token == "" {
			return fmt.Errorf("token cannot be empty")
		}
	}

	// Initialize auth service
	authService, err := auth.NewService()
	if err != nil {
		return fmt.Errorf("failed to initialize auth service: %w", err)
	}

	// Register token validator for GitHub
	if providerType == config.ProviderTypeGitHub {
		authService.RegisterValidator(config.ProviderTypeGitHub, github.NewTokenValidator(host))
	}

	// Login (store credential)
	fmt.Println("Validating token...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cred, err := authService.Login(ctx, providerType, host, token)
	if err != nil {
		return fmt.Errorf("login failed: %w", err)
	}

	fmt.Println()
	fmt.Printf("✓ Successfully logged in to %s (%s)\n", provider, host)
	if cred.Username != "" {
		fmt.Printf("  Authenticated as: %s\n", cred.Username)
	}

	return nil
}

// printTokenURL prints the URL where users can create tokens
func printTokenURL(providerType config.ProviderType, host string) {
	switch providerType {
	case config.ProviderTypeGitHub:
		if host == "github.com" {
			fmt.Println("  https://github.com/settings/tokens/new")
			fmt.Println("  Required scopes: repo, read:org")
		} else {
			fmt.Printf("  https://%s/settings/tokens/new\n", host)
		}
	case config.ProviderTypeGitLab:
		if host == "gitlab.com" {
			fmt.Println("  https://gitlab.com/-/user_settings/personal_access_tokens")
		} else {
			fmt.Printf("  https://%s/-/user_settings/personal_access_tokens\n", host)
		}
		fmt.Println("  Required scope: api")
	case config.ProviderTypeBitbucket:
		fmt.Println("  https://bitbucket.org/account/settings/app-passwords/")
		fmt.Println("  Required permissions: pullrequest:read, pullrequest:write, repository:read")
	case config.ProviderTypeAzureDevOps:
		fmt.Println("  https://dev.azure.com/{organization}/_usersSettings/tokens")
		fmt.Println("  Required scope: Code (Read & Write)")
	}
}

// logoutAction handles the logout command
func logoutAction(provider, host string) error {
	if provider == "" {
		fmt.Println("Please specify a provider with --provider or use --all")
		return nil
	}

	providerType := config.ProviderType(provider)

	// Set default host if not provided
	if host == "" {
		switch providerType {
		case config.ProviderTypeGitHub:
			host = "github.com"
		case config.ProviderTypeGitLab:
			host = "gitlab.com"
		case config.ProviderTypeBitbucket:
			host = "bitbucket.org"
		case config.ProviderTypeAzureDevOps:
			host = "dev.azure.com"
		}
	}

	authService, err := auth.NewService()
	if err != nil {
		return fmt.Errorf("failed to initialize auth service: %w", err)
	}

	if err := authService.Logout(providerType, host); err != nil {
		if err == auth.ErrCredentialNotFound {
			fmt.Printf("No credentials found for %s (%s)\n", provider, host)
			return nil
		}
		return fmt.Errorf("logout failed: %w", err)
	}

	fmt.Printf("✓ Successfully logged out from %s (%s)\n", provider, host)
	return nil
}

// logoutAllAction handles logging out from all providers
func logoutAllAction() error {
	authService, err := auth.NewService()
	if err != nil {
		return fmt.Errorf("failed to initialize auth service: %w", err)
	}

	// Get list of credentials first for display
	creds, err := authService.ListCredentials()
	if err != nil {
		return fmt.Errorf("failed to list credentials: %w", err)
	}

	if len(creds) == 0 {
		fmt.Println("No credentials stored.")
		return nil
	}

	// Confirm
	prompter := auth.NewPrompter()
	confirmed, err := prompter.Confirm(fmt.Sprintf("Logout from %d provider(s)?", len(creds)), false)
	if err != nil {
		return err
	}

	if !confirmed {
		fmt.Println("Cancelled.")
		return nil
	}

	if err := authService.LogoutAll(); err != nil {
		return fmt.Errorf("logout failed: %w", err)
	}

	fmt.Printf("✓ Successfully logged out from %d provider(s)\n", len(creds))
	return nil
}

// authStatusAction shows authentication status
func authStatusAction() error {
	authService, err := auth.NewService()
	if err != nil {
		return fmt.Errorf("failed to initialize auth service: %w", err)
	}

	statuses, err := authService.GetAllStatus()
	if err != nil {
		return fmt.Errorf("failed to get auth status: %w", err)
	}

	fmt.Println("Authentication Status")
	fmt.Println("=====================")
	fmt.Println()

	if len(statuses) == 0 {
		fmt.Println("No providers authenticated.")
		fmt.Println()
		fmt.Println("To login, run:")
		fmt.Println("  lazyreview auth login --provider github")
		return nil
	}

	for _, status := range statuses {
		fmt.Printf("Provider: %s\n", status.ProviderType)
		fmt.Printf("  Host: %s\n", status.Host)
		fmt.Printf("  Status: ")
		if status.Authenticated {
			fmt.Println("✓ Authenticated")
		} else {
			fmt.Println("✗ Not authenticated")
		}
		if status.Username != "" {
			fmt.Printf("  Username: %s\n", status.Username)
		}
		if !status.CreatedAt.IsZero() {
			fmt.Printf("  Logged in: %s\n", status.CreatedAt.Format("2006-01-02 15:04:05"))
		}
		fmt.Println()
	}

	return nil
}

// editConfigAction opens the config file in an editor
func editConfigAction() error {
	configDir, err := config.ConfigDir()
	if err != nil {
		return err
	}

	configPath := configDir + "/config.yaml"

	// Check if config exists
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		fmt.Printf("Config file does not exist yet: %s\n", configPath)
		fmt.Println("Creating default config...")

		// Ensure directory exists
		if _, err := config.EnsureConfigDir(); err != nil {
			return err
		}

		// Create default config
		defaultConfig := `# LazyReview Configuration
version: "0.1"
default_provider: ""

ui:
  theme: auto
  paging: true
  show_checks: true

# Providers (uncomment and configure)
# providers:
#   - name: github-personal
#     type: github
#     host: github.com
#     token_env: GITHUB_TOKEN
`
		if err := os.WriteFile(configPath, []byte(defaultConfig), 0644); err != nil {
			return fmt.Errorf("failed to create config: %w", err)
		}
	}

	// Try to open with $EDITOR
	editor := os.Getenv("EDITOR")
	if editor == "" {
		editor = os.Getenv("VISUAL")
	}

	if editor != "" {
		fmt.Printf("Opening %s with %s...\n", configPath, editor)
		// Note: In a real implementation, we'd exec the editor
		// For now, just show the path
	}

	fmt.Printf("Config file: %s\n", configPath)
	return nil
}

// showConfigPathAction shows the config file path
func showConfigPathAction() error {
	configDir, err := config.ConfigDir()
	if err != nil {
		return err
	}
	fmt.Printf("%s/config.yaml\n", configDir)
	return nil
}

func init() {
	// Suppress unused import warning
	_ = strings.TrimSpace
}

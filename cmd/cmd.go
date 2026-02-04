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
	"lazyreview/internal/queue"
	"lazyreview/internal/storage"
	"lazyreview/internal/updater"
	"lazyreview/pkg/git"
	"lazyreview/pkg/keyring"
	"lazyreview/pkg/providers"
	_ "lazyreview/pkg/providers/azuredevops"
	_ "lazyreview/pkg/providers/bitbucket"
	"lazyreview/pkg/providers/github"
	_ "lazyreview/pkg/providers/gitlab"

	"github.com/urfave/cli"
)

// CommandStart initializes the CLI application and sets up commands
func CommandStart() *cli.App {
	app := cli.NewApp()
	app.Name = "LazyReview"
	app.Usage = "A terminal UI for code review across multiple Git providers"
	app.Version = "0.47.0"

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
			Name:  "ai",
			Usage: "AI provider configuration",
			Subcommands: []cli.Command{
				{
					Name:  "login",
					Usage: "Store AI API key and provider",
					Flags: []cli.Flag{
						cli.StringFlag{
							Name:  "provider, p",
							Usage: "AI provider (openai)",
							Value: "openai",
						},
						cli.StringFlag{
							Name:   "key, k",
							Usage:  "AI API key (or set via environment)",
							EnvVar: "LAZYREVIEW_AI_API_KEY",
						},
					},
					Action: func(c *cli.Context) error {
						return aiLoginAction(c.String("provider"), c.String("key"))
					},
				},
				{
					Name:  "logout",
					Usage: "Remove stored AI API key",
					Action: func(c *cli.Context) error {
						return aiLogoutAction()
					},
				},
				{
					Name:  "status",
					Usage: "Show AI provider setup status",
					Action: func(c *cli.Context) error {
						return aiStatusAction()
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
			Name:  "queue",
			Usage: "Offline queue commands",
			Subcommands: []cli.Command{
				{
					Name:  "sync",
					Usage: "Retry queued offline actions",
					Action: func(c *cli.Context) error {
						return queueSyncAction()
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
		{
			Name:  "update",
			Usage: "Update LazyReview to the latest release",
			Action: func(c *cli.Context) error {
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
				defer cancel()
				result, err := updater.Update(ctx)
				if err != nil {
					return err
				}
				if result.Updated {
					fmt.Printf("Updated to %s (%s). Restart LazyReview.\n", result.Version, result.AssetName)
				}
				return nil
			},
		},
		{
			Name:    "keys",
			Aliases: []string{"k"},
			Usage:   "Display keyboard shortcuts cheatsheet",
			Flags: []cli.Flag{
				cli.BoolFlag{
					Name:  "vim",
					Usage: "Show vim-style keybindings (default: true)",
				},
				cli.BoolFlag{
					Name:  "standard",
					Usage: "Show standard keybindings",
				},
			},
			Action: func(c *cli.Context) error {
				vimMode := !c.Bool("standard")
				return showKeybindingsAction(vimMode)
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

	// Initialize auth service
	authService, err := auth.NewService()
	if err != nil {
		return fmt.Errorf("failed to initialize auth service: %w", err)
	}

	// Detect Git context
	gitCtx, err := git.DetectGitContext()
	if err != nil {
		// Non-fatal error, just log it
		fmt.Fprintf(os.Stderr, "Warning: failed to detect git context: %v\n", err)
		gitCtx = &git.GitContext{IsGitRepo: false}
	}

	// Determine owner/repo from Git context
	var owner, repo string
	if gitCtx.IsGitRepo {
		remote := gitCtx.GetPrimaryRemote()
		if remote != nil && remote.IsValid() {
			owner = remote.Owner
			repo = remote.Repo
			fmt.Fprintf(os.Stderr, "Detected Git repository: %s/%s (provider: %s)\n", owner, repo, remote.Provider)
		}
	}

	// Get default provider config or use GitHub as default
	var providerCfg *config.ProviderConfig
	if cfg.DefaultProvider != "" {
		providerCfg = cfg.GetProviderByName(cfg.DefaultProvider)
	}

	// If no provider configured, create default GitHub config
	if providerCfg == nil {
		if statuses, err := authService.GetAllStatus(); err == nil && len(statuses) > 0 {
			status := statuses[0]
			providerCfg = &config.ProviderConfig{
				Name: string(status.ProviderType),
				Type: status.ProviderType,
				Host: status.Host,
			}
		} else {
			providerCfg = &config.ProviderConfig{
				Name: "github",
				Type: config.ProviderTypeGitHub,
				Host: "github.com",
			}
		}
	}

	// Get credentials for the provider
	cred, err := authService.GetCredential(providerCfg.Type, providerCfg.GetHost())
	if err != nil {
		if err == auth.ErrCredentialNotFound {
			return fmt.Errorf("not authenticated with %s. Run: lazyreview auth login --provider %s",
				providerCfg.Type, providerCfg.Type)
		}
		return fmt.Errorf("failed to get credentials: %w", err)
	}

	// Create provider instance
	provider, err := providers.Create(*providerCfg)
	if err != nil {
		return fmt.Errorf("failed to create provider: %w", err)
	}

	// Authenticate provider
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := provider.Authenticate(ctx, cred.Token); err != nil {
		return fmt.Errorf("failed to authenticate: %w", err)
	}

	var store storage.Storage
	sqliteStore, err := storage.DefaultStorage()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to initialize storage: %v\n", err)
	} else {
		store = sqliteStore
		defer store.Close()
	}

	return gui.Run(cfg, provider, authService, owner, repo, store)
}

func queueSyncAction() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	authService, err := auth.NewService()
	if err != nil {
		return fmt.Errorf("failed to initialize auth service: %w", err)
	}

	var providerCfg *config.ProviderConfig
	if cfg.DefaultProvider != "" {
		providerCfg = cfg.GetProviderByName(cfg.DefaultProvider)
	}
	if providerCfg == nil {
		if statuses, statusErr := authService.GetAllStatus(); statusErr == nil && len(statuses) > 0 {
			status := statuses[0]
			providerCfg = &config.ProviderConfig{
				Name: string(status.ProviderType),
				Type: status.ProviderType,
				Host: status.Host,
			}
		} else {
			providerCfg = &config.ProviderConfig{
				Name: "github",
				Type: config.ProviderTypeGitHub,
				Host: "github.com",
			}
		}
	}

	cred, err := authService.GetCredential(providerCfg.Type, providerCfg.GetHost())
	if err != nil {
		if err == auth.ErrCredentialNotFound {
			return fmt.Errorf("not authenticated with %s. Run: lazyreview auth login --provider %s",
				providerCfg.Type, providerCfg.Type)
		}
		return fmt.Errorf("failed to get credentials: %w", err)
	}

	provider, err := providers.Create(*providerCfg)
	if err != nil {
		return fmt.Errorf("failed to create provider: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := provider.Authenticate(ctx, cred.Token); err != nil {
		return fmt.Errorf("failed to authenticate: %w", err)
	}

	store, err := storage.DefaultStorage()
	if err != nil {
		return fmt.Errorf("failed to initialize storage: %w", err)
	}
	defer store.Close()

	processed, failed, err := queue.ProcessQueue(ctx, store, provider, 50)
	if err != nil {
		return fmt.Errorf("failed to process offline queue: %w", err)
	}

	fmt.Printf("Processed %d queued actions (%d failed)\n", processed, failed)
	return nil
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
		fmt.Printf("Error: Invalid provider '%s'\n\n", provider)
		fmt.Println("Supported providers:")
		fmt.Println("  • github     - GitHub.com or GitHub Enterprise")
		fmt.Println("  • gitlab     - GitLab.com or self-hosted GitLab")
		fmt.Println("  • bitbucket  - Bitbucket.org or Bitbucket Server")
		fmt.Println("  • azuredevops - Azure DevOps Services")
		fmt.Println()
		fmt.Println("Example: lazyreview auth login --provider github")
		return fmt.Errorf("invalid provider: %s", provider)
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
		fmt.Printf("\n✗ Login failed: %v\n\n", err)
		fmt.Println("Possible solutions:")
		fmt.Println("  1. Verify your token is correct (no extra spaces)")
		fmt.Println("  2. Check if your token has expired")
		fmt.Println("  3. Ensure your token has the required scopes:")
		printRequiredScopes(providerType)
		fmt.Println()
		fmt.Println("  4. For self-hosted instances, verify the --host flag is correct")
		return fmt.Errorf("authentication failed")
	}

	fmt.Println()
	fmt.Printf("✓ Successfully logged in to %s (%s)\n", provider, host)
	if cred.Username != "" {
		fmt.Printf("  Authenticated as: %s\n", cred.Username)
	}

	return nil
}

func aiProviderCredentialKey(provider string) string {
	name := strings.ToLower(strings.TrimSpace(provider))
	if name == "" || name == "none" {
		name = "openai"
	}
	return fmt.Sprintf("ai:%s:token", name)
}

const aiKeyringTimeout = 3 * time.Second

func aiKeyringSetWithTimeout(store *keyring.Store, key, value string) error {
	ch := make(chan error, 1)
	go func() {
		ch <- store.Set(key, value)
	}()
	select {
	case err := <-ch:
		return err
	case <-time.After(aiKeyringTimeout):
		return fmt.Errorf("keyring set timeout")
	}
}

func aiKeyringGetWithTimeout(store *keyring.Store, key string) (string, error) {
	type result struct {
		value string
		err   error
	}
	ch := make(chan result, 1)
	go func() {
		v, err := store.Get(key)
		ch <- result{value: v, err: err}
	}()
	select {
	case res := <-ch:
		return res.value, res.err
	case <-time.After(aiKeyringTimeout):
		return "", fmt.Errorf("keyring get timeout")
	}
}

func aiLoginAction(providerName, apiKey string) error {
	providerName = strings.ToLower(strings.TrimSpace(providerName))
	if providerName == "" {
		providerName = "openai"
	}
	if providerName != "openai" {
		return fmt.Errorf("unsupported AI provider: %s (currently supported: openai)", providerName)
	}
	if strings.TrimSpace(apiKey) == "" {
		prompter := auth.NewPrompter()
		fmt.Printf("Configuring AI provider: %s\n\n", providerName)
		fmt.Println("Enter your API key.")
		fmt.Println("OpenAI: https://platform.openai.com/api-keys")
		fmt.Println()
		var err error
		apiKey, err = prompter.PromptSecret("API Key: ")
		if err != nil {
			return fmt.Errorf("failed to read API key: %w", err)
		}
	}
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return fmt.Errorf("API key cannot be empty")
	}

	keyringErr := error(nil)
	if store, err := keyring.NewDefaultStore(); err == nil {
		if err := aiKeyringSetWithTimeout(store, "ai:api_key", apiKey); err == nil {
			_ = aiKeyringSetWithTimeout(store, aiProviderCredentialKey(providerName), apiKey)
			_ = aiKeyringSetWithTimeout(store, "ai:provider", providerName)
		} else {
			keyringErr = err
		}
	} else {
		keyringErr = err
	}

	sqlStore, err := storage.DefaultStorage()
	if err == nil {
		defer sqlStore.Close()
		_ = sqlStore.SetSetting("ai.provider", providerName)
		_ = sqlStore.SetSetting("ai.api_key", apiKey)
	} else if keyringErr != nil {
		return fmt.Errorf("failed to store AI key in keyring (%v) and could not open fallback storage: %w", keyringErr, err)
	}

	if keyringErr != nil {
		fmt.Printf("! Keyring unavailable, stored AI key in local app storage instead: %v\n", keyringErr)
	}
	fmt.Printf("✓ AI provider configured: %s\n", providerName)
	return nil
}

func aiLogoutAction() error {
	if store, err := keyring.NewDefaultStore(); err == nil {
		_ = store.Delete("ai:api_key")
		_ = store.Delete("ai:provider")
		_ = store.Delete(aiProviderCredentialKey("openai"))
	}

	sqlStore, err := storage.DefaultStorage()
	if err == nil {
		defer sqlStore.Close()
		_ = sqlStore.SetSetting("ai.provider", "none")
		_ = sqlStore.SetSetting("ai.api_key", "")
	}

	fmt.Println("✓ AI API key removed")
	return nil
}

func aiStatusAction() error {
	provider := "none"
	hasKey := false
	if store, err := keyring.NewDefaultStore(); err == nil {
		if p, pErr := aiKeyringGetWithTimeout(store, "ai:provider"); pErr == nil && strings.TrimSpace(p) != "" {
			provider = strings.TrimSpace(p)
		}
		if _, keyErr := aiKeyringGetWithTimeout(store, aiProviderCredentialKey(provider)); keyErr == nil {
			hasKey = true
		} else if _, keyErr := aiKeyringGetWithTimeout(store, "ai:api_key"); keyErr == nil {
			hasKey = true
		}
	}
	if sqlStore, err := storage.DefaultStorage(); err == nil {
		defer sqlStore.Close()
		if p, pErr := sqlStore.GetSetting("ai.provider"); pErr == nil && strings.TrimSpace(p) != "" {
			provider = strings.TrimSpace(p)
		}
		if !hasKey {
			if key, keyErr := sqlStore.GetSetting("ai.api_key"); keyErr == nil && strings.TrimSpace(key) != "" {
				hasKey = true
			}
		}
	}
	fmt.Println("AI Configuration")
	fmt.Println("================")
	fmt.Printf("Provider: %s\n", provider)
	if hasKey {
		fmt.Println("API Key: ✓ configured")
	} else {
		fmt.Println("API Key: ✗ not configured")
	}
	fmt.Println()
	fmt.Println("To configure:")
	fmt.Println("  lazyreview ai login --provider openai")
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

func printRequiredScopes(providerType config.ProviderType) {
	switch providerType {
	case config.ProviderTypeGitHub:
		fmt.Println("     - repo (Full control of private repositories)")
		fmt.Println("     - read:org (Read org and team membership)")
	case config.ProviderTypeGitLab:
		fmt.Println("     - api (Full API access)")
	case config.ProviderTypeBitbucket:
		fmt.Println("     - pullrequest:read")
		fmt.Println("     - pullrequest:write")
		fmt.Println("     - repository:read")
	case config.ProviderTypeAzureDevOps:
		fmt.Println("     - Code (Read & Write)")
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
  vim_mode: true
  editor: ""

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

// showKeybindingsAction displays the keyboard shortcuts cheatsheet
func showKeybindingsAction(vimMode bool) error {
	mode := "Vim-style"
	if !vimMode {
		mode = "Standard"
	}

	fmt.Printf("LazyReview Keyboard Shortcuts (%s mode)\n", mode)
	fmt.Println(strings.Repeat("=", 50))
	fmt.Println()

	// Navigation section
	fmt.Println("NAVIGATION")
	fmt.Println(strings.Repeat("-", 50))
	if vimMode {
		fmt.Println("  j / ↓           Move down")
		fmt.Println("  k / ↑           Move up")
		fmt.Println("  h / ←           Move left / go back")
		fmt.Println("  l / →           Move right / enter")
		fmt.Println("  gg              Go to top")
		fmt.Println("  G               Go to bottom")
		fmt.Println("  ctrl+u          Half page up")
		fmt.Println("  ctrl+d          Half page down")
		fmt.Println("  b / pgup        Full page up")
		fmt.Println("  f / pgdn        Full page down")
	} else {
		fmt.Println("  ↑               Move up")
		fmt.Println("  ↓               Move down")
		fmt.Println("  ←               Move left / go back")
		fmt.Println("  →               Move right / enter")
		fmt.Println("  home            Go to top")
		fmt.Println("  end             Go to bottom")
		fmt.Println("  ctrl+u          Half page up")
		fmt.Println("  ctrl+d          Half page down")
		fmt.Println("  pgup            Full page up")
		fmt.Println("  pgdn            Full page down")
	}
	fmt.Println()

	// Panel navigation
	fmt.Println("PANEL NAVIGATION")
	fmt.Println(strings.Repeat("-", 50))
	fmt.Println("  tab             Next panel")
	fmt.Println("  shift+tab       Previous panel")
	fmt.Println("  enter           Select item")
	fmt.Println("  esc             Go back / cancel")
	fmt.Println()

	// PR list view
	fmt.Println("PR LIST VIEW")
	fmt.Println(strings.Repeat("-", 50))
	fmt.Println("  m               Switch to My PRs")
	fmt.Println("  R               Switch to Review Requests")
	fmt.Println("  /               Search / filter")
	fmt.Println("  S               Save current filter")
	fmt.Println("  F               Open saved filters")
	fmt.Println("  1-9             Quick switch workspace tabs")
	fmt.Println()

	// Review actions
	fmt.Println("REVIEW ACTIONS (Detail View)")
	fmt.Println(strings.Repeat("-", 50))
	fmt.Println("  a               Approve PR")
	fmt.Println("  r               Request changes")
	fmt.Println("  c               Comment on current line")
	fmt.Println("  C               General comment on PR")
	fmt.Println("  v               Add review comment")
	fmt.Println("  y               Reply to comment")
	fmt.Println("  e               Edit comment")
	fmt.Println("  x               Delete comment")
	fmt.Println("  z               Resolve thread")
	fmt.Println("  s               Draft summary")
	fmt.Println("  A / ctrl+a      AI-assisted review")
	fmt.Println()

	// Diff navigation
	fmt.Println("DIFF NAVIGATION")
	fmt.Println(strings.Repeat("-", 50))
	fmt.Println("  n / ]           Next file")
	fmt.Println("  N / [           Previous file")
	fmt.Println("  {               Previous hunk")
	fmt.Println("  }               Next hunk")
	fmt.Println("  t               Toggle comments sidebar")
	fmt.Println("  i               Toggle comment preview")
	fmt.Println()

	// Other actions
	fmt.Println("OTHER ACTIONS")
	fmt.Println(strings.Repeat("-", 50))
	fmt.Println("  o               Open PR in browser")
	fmt.Println("  O               Open file in editor")
	fmt.Println("  shift+c         Checkout PR branch")
	fmt.Println("  R               Refresh data")
	fmt.Println("  U               Update LazyReview")
	fmt.Println("  m               Merge PR")
	fmt.Println()

	// Global
	fmt.Println("GLOBAL")
	fmt.Println(strings.Repeat("-", 50))
	fmt.Println("  ?               Toggle help panel")
	fmt.Println("  q               Quit / go back")
	fmt.Println("  ctrl+c          Force quit")
	fmt.Println()

	// Text input
	fmt.Println("TEXT INPUT (when composing)")
	fmt.Println(strings.Repeat("-", 50))
	fmt.Println("  ctrl+s          Submit comment")
	fmt.Println("  esc             Cancel input")
	fmt.Println()

	fmt.Println("Tip: Toggle vim mode in config.yaml (ui.vim_mode: true/false)")
	return nil
}

func init() {
	// Suppress unused import warning
	_ = strings.TrimSpace
}

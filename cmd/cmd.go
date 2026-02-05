package cmd

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"lazyreview/internal/auth"
	"lazyreview/internal/config"
	"lazyreview/internal/gui"
	"lazyreview/internal/models"
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
	app.Version = "0.54.0"

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
				{
					Name:  "show",
					Usage: "Display current configuration",
					Action: func(c *cli.Context) error {
						return showConfigAction()
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
		{
			Name:  "doctor",
			Usage: "Check system health and diagnose issues",
			Action: func(c *cli.Context) error {
				return doctorAction()
			},
		},
		{
			Name:  "status",
			Usage: "Show quick overview of PRs and auth status",
			Action: func(c *cli.Context) error {
				return statusAction()
			},
		},
		{
			Name:      "open",
			Aliases:   []string{"o"},
			Usage:     "Open a PR in browser",
			ArgsUsage: "[PR_NUMBER]",
			Flags: []cli.Flag{
				cli.StringFlag{
					Name:  "repo, r",
					Usage: "Repository in owner/repo format",
				},
			},
			Action: func(c *cli.Context) error {
				prNumber := c.Args().First()
				repo := c.String("repo")
				return openPRAction(prNumber, repo)
			},
		},
		{
			Name:    "list",
			Aliases: []string{"ls"},
			Usage:   "List PRs in terminal",
			Flags: []cli.Flag{
				cli.BoolFlag{
					Name:  "mine, m",
					Usage: "Show only my PRs",
				},
				cli.BoolFlag{
					Name:  "review, r",
					Usage: "Show PRs needing my review",
				},
				cli.IntFlag{
					Name:  "limit, n",
					Usage: "Limit number of results",
					Value: 10,
				},
				cli.StringFlag{
					Name:  "state, s",
					Usage: "Filter by state (open, closed, all)",
					Value: "open",
				},
			},
			Action: func(c *cli.Context) error {
				return listPRsAction(c.Bool("mine"), c.Bool("review"), c.Int("limit"), c.String("state"))
			},
		},
		{
			Name:      "approve",
			Usage:     "Approve a PR",
			ArgsUsage: "PR_NUMBER",
			Flags: []cli.Flag{
				cli.StringFlag{
					Name:  "repo, r",
					Usage: "Repository in owner/repo format",
				},
				cli.StringFlag{
					Name:  "message, m",
					Usage: "Approval message",
					Value: "LGTM!",
				},
			},
			Action: func(c *cli.Context) error {
				prNumber := c.Args().First()
				if prNumber == "" {
					return fmt.Errorf("PR number is required")
				}
				return approvePRAction(prNumber, c.String("repo"), c.String("message"))
			},
		},
		{
			Name:      "request-changes",
			Aliases:   []string{"rc"},
			Usage:     "Request changes on a PR",
			ArgsUsage: "PR_NUMBER",
			Flags: []cli.Flag{
				cli.StringFlag{
					Name:  "repo, r",
					Usage: "Repository in owner/repo format",
				},
				cli.StringFlag{
					Name:  "message, m",
					Usage: "Review comment (required)",
				},
			},
			Action: func(c *cli.Context) error {
				prNumber := c.Args().First()
				if prNumber == "" {
					return fmt.Errorf("PR number is required")
				}
				message := c.String("message")
				if message == "" {
					return fmt.Errorf("message is required when requesting changes")
				}
				return requestChangesAction(prNumber, c.String("repo"), message)
			},
		},
		{
			Name:      "checkout",
			Aliases:   []string{"co"},
			Usage:     "Checkout a PR branch locally",
			ArgsUsage: "PR_NUMBER",
			Flags: []cli.Flag{
				cli.StringFlag{
					Name:  "repo, r",
					Usage: "Repository in owner/repo format",
				},
			},
			Action: func(c *cli.Context) error {
				prNumber := c.Args().First()
				if prNumber == "" {
					return fmt.Errorf("PR number is required")
				}
				return checkoutPRAction(prNumber, c.String("repo"))
			},
		},
		{
			Name:      "diff",
			Usage:     "View PR diff in terminal",
			ArgsUsage: "PR_NUMBER",
			Flags: []cli.Flag{
				cli.StringFlag{
					Name:  "repo, r",
					Usage: "Repository in owner/repo format",
				},
				cli.BoolFlag{
					Name:  "stat",
					Usage: "Show diff stats only",
				},
			},
			Action: func(c *cli.Context) error {
				prNumber := c.Args().First()
				if prNumber == "" {
					return fmt.Errorf("PR number is required")
				}
				return diffPRAction(prNumber, c.String("repo"), c.Bool("stat"))
			},
		},
		{
			Name:  "completion",
			Usage: "Generate shell completion scripts",
			Subcommands: []cli.Command{
				{
					Name:  "bash",
					Usage: "Generate bash completion script",
					Action: func(c *cli.Context) error {
						fmt.Print(bashCompletion)
						return nil
					},
				},
				{
					Name:  "zsh",
					Usage: "Generate zsh completion script",
					Action: func(c *cli.Context) error {
						fmt.Print(zshCompletion)
						return nil
					},
				},
				{
					Name:  "fish",
					Usage: "Generate fish completion script",
					Action: func(c *cli.Context) error {
						fmt.Print(fishCompletion)
						return nil
					},
				},
			},
		},
		{
			Name:      "merge",
			Aliases:   []string{"m"},
			Usage:     "Merge a pull request",
			ArgsUsage: "PR_NUMBER",
			Flags: []cli.Flag{
				cli.StringFlag{
					Name:  "repo, r",
					Usage: "Repository in owner/repo format",
				},
				cli.StringFlag{
					Name:  "method",
					Usage: "Merge method: merge, squash, rebase (default: merge)",
					Value: "merge",
				},
				cli.StringFlag{
					Name:  "message, m",
					Usage: "Commit message for merge (optional)",
				},
				cli.BoolFlag{
					Name:  "delete-branch",
					Usage: "Delete source branch after merge",
				},
			},
			Action: func(c *cli.Context) error {
				prNumber := c.Args().First()
				if prNumber == "" {
					return fmt.Errorf("PR number is required")
				}
				return mergeAction(prNumber, c.String("repo"), c.String("method"), c.String("message"), c.Bool("delete-branch"))
			},
		},
		{
			Name:      "comment",
			Usage:     "Add a comment to a pull request",
			ArgsUsage: "PR_NUMBER",
			Flags: []cli.Flag{
				cli.StringFlag{
					Name:  "repo, r",
					Usage: "Repository in owner/repo format",
				},
				cli.StringFlag{
					Name:  "message, m",
					Usage: "Comment message (required)",
				},
			},
			Action: func(c *cli.Context) error {
				prNumber := c.Args().First()
				if prNumber == "" {
					return fmt.Errorf("PR number is required")
				}
				message := c.String("message")
				if message == "" {
					return fmt.Errorf("message is required (use --message or -m)")
				}
				return commentAction(prNumber, c.String("repo"), message)
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

// doctorAction checks system health and diagnoses issues
func doctorAction() error {
	fmt.Println("LazyReview Doctor")
	fmt.Println(strings.Repeat("=", 50))
	fmt.Println()

	allOk := true

	// Check 1: Git installation
	fmt.Print("Checking Git installation... ")
	if output, err := exec.Command("git", "--version").Output(); err != nil {
		fmt.Println("✗ FAIL")
		fmt.Println("  Git is not installed or not in PATH")
		fmt.Println("  Install: https://git-scm.com/downloads")
		allOk = false
	} else {
		version := strings.TrimSpace(string(output))
		fmt.Printf("✓ OK (%s)\n", version)
	}

	// Check 2: Git repository context
	fmt.Print("Checking Git repository... ")
	gitCtx, err := git.DetectGitContext()
	if err != nil || !gitCtx.IsGitRepo {
		fmt.Println("⚠ Not in a Git repository")
		fmt.Println("  LazyReview works best when run from a Git repo")
	} else {
		remote := gitCtx.GetPrimaryRemote()
		if remote != nil && remote.IsValid() {
			fmt.Printf("✓ OK (%s/%s)\n", remote.Owner, remote.Repo)
		} else {
			fmt.Println("✓ OK (no remote detected)")
		}
	}

	// Check 3: Config file
	fmt.Print("Checking configuration... ")
	cfg, err := config.Load()
	if err != nil {
		fmt.Println("✗ FAIL")
		fmt.Printf("  Error: %v\n", err)
		fmt.Println("  Run: lazyreview config edit")
		allOk = false
	} else {
		configDir, _ := config.ConfigDir()
		fmt.Printf("✓ OK (%s/config.yaml)\n", configDir)
		if cfg.UI.VimMode {
			fmt.Println("  Mode: vim-style keybindings")
		} else {
			fmt.Println("  Mode: standard keybindings")
		}
	}

	// Check 4: Authentication
	fmt.Print("Checking authentication... ")
	authService, err := auth.NewService()
	if err != nil {
		fmt.Println("✗ FAIL")
		fmt.Printf("  Error: %v\n", err)
		allOk = false
	} else {
		statuses, err := authService.GetAllStatus()
		if err != nil {
			fmt.Println("✗ FAIL")
			fmt.Printf("  Error: %v\n", err)
			allOk = false
		} else if len(statuses) == 0 {
			fmt.Println("⚠ No providers authenticated")
			fmt.Println("  Run: lazyreview auth login --provider github")
		} else {
			fmt.Printf("✓ OK (%d provider(s))\n", len(statuses))
			for _, s := range statuses {
				status := "✓"
				if !s.Authenticated {
					status = "✗"
				}
				fmt.Printf("  %s %s (%s) as %s\n", status, s.ProviderType, s.Host, s.Username)
			}
		}
	}

	// Check 5: AI provider (optional)
	fmt.Print("Checking AI provider... ")
	aiKey := os.Getenv("LAZYREVIEW_AI_API_KEY")
	if aiKey == "" {
		if store, err := keyring.NewDefaultStore(); err == nil {
			aiKey, _ = store.Get("ai:api_key")
		}
	}
	if aiKey != "" {
		fmt.Println("✓ OK (configured)")
	} else {
		fmt.Println("⚠ Not configured (optional)")
		fmt.Println("  For AI reviews: lazyreview ai login")
	}

	// Check 6: Network connectivity
	fmt.Print("Checking network (github.com)... ")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "HEAD", "https://api.github.com", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Println("✗ FAIL")
		fmt.Printf("  Cannot reach GitHub API: %v\n", err)
		allOk = false
	} else {
		resp.Body.Close()
		fmt.Printf("✓ OK (status %d)\n", resp.StatusCode)
	}

	fmt.Println()
	if allOk {
		fmt.Println("All checks passed! LazyReview is ready to use.")
	} else {
		fmt.Println("Some checks failed. Please resolve the issues above.")
	}

	return nil
}

// statusAction shows a quick overview of PRs and auth status
func statusAction() error {
	// Load config
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Initialize auth service
	authService, err := auth.NewService()
	if err != nil {
		return fmt.Errorf("failed to initialize auth service: %w", err)
	}

	// Show Git context
	gitCtx, _ := git.DetectGitContext()
	if gitCtx != nil && gitCtx.IsGitRepo {
		remote := gitCtx.GetPrimaryRemote()
		if remote != nil && remote.IsValid() {
			fmt.Printf("Repository: %s/%s (%s)\n", remote.Owner, remote.Repo, remote.Provider)
			if gitCtx.CurrentBranch != "" {
				fmt.Printf("Branch: %s\n", gitCtx.CurrentBranch)
			}
		}
	} else {
		fmt.Println("Repository: (not in a git repo)")
	}
	fmt.Println()

	// Show auth status
	statuses, err := authService.GetAllStatus()
	if err != nil {
		return err
	}

	if len(statuses) == 0 {
		fmt.Println("Authentication: Not logged in")
		fmt.Println("  Run: lazyreview auth login --provider github")
		return nil
	}

	fmt.Println("Authentication:")
	for _, s := range statuses {
		if s.Authenticated {
			fmt.Printf("  ✓ %s (%s) as %s\n", s.ProviderType, s.Host, s.Username)
		}
	}
	fmt.Println()

	// Try to get PR counts
	var providerCfg *config.ProviderConfig
	if cfg.DefaultProvider != "" {
		providerCfg = cfg.GetProviderByName(cfg.DefaultProvider)
	}
	if providerCfg == nil && len(statuses) > 0 {
		status := statuses[0]
		providerCfg = &config.ProviderConfig{
			Name: string(status.ProviderType),
			Type: status.ProviderType,
			Host: status.Host,
		}
	}

	if providerCfg != nil {
		cred, err := authService.GetCredential(providerCfg.Type, providerCfg.GetHost())
		if err == nil {
			provider, err := providers.Create(*providerCfg)
			if err == nil {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()

				if err := provider.Authenticate(ctx, cred.Token); err == nil {
					fmt.Println("Pull Requests:")

					// Get user's PRs
					myPRs, err := provider.ListUserPullRequests(ctx, providers.UserPROptions{
						Involvement: "authored",
						State:       "open",
						PerPage:     100,
					})
					if err == nil {
						fmt.Printf("  My open PRs: %d\n", len(myPRs))
					}

					// Get review requests
					reviewPRs, err := provider.ListUserPullRequests(ctx, providers.UserPROptions{
						Involvement: "review-requested",
						State:       "open",
						PerPage:     100,
					})
					if err == nil {
						fmt.Printf("  Needs my review: %d\n", len(reviewPRs))
					}
				}
			}
		}
	}

	fmt.Println()
	fmt.Println("Run 'lazyreview' to open the TUI")
	return nil
}

// showConfigAction displays the current configuration
func showConfigAction() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	fmt.Println("LazyReview Configuration")
	fmt.Println(strings.Repeat("=", 50))
	fmt.Println()

	// Version
	fmt.Printf("Version: %s\n", cfg.Version)
	fmt.Printf("Default Provider: %s\n", valueOrDefault(cfg.DefaultProvider, "(none)"))
	fmt.Println()

	// UI Settings
	fmt.Println("UI Settings:")
	fmt.Printf("  Theme: %s\n", valueOrDefault(cfg.UI.Theme, "auto"))
	fmt.Printf("  Vim Mode: %v\n", cfg.UI.VimMode)
	fmt.Printf("  Show Checks: %v\n", cfg.UI.ShowChecks)
	fmt.Printf("  Paging: %v\n", cfg.UI.Paging)
	fmt.Printf("  Editor: %s\n", valueOrDefault(cfg.UI.Editor, "$EDITOR"))
	fmt.Println()

	// Performance Settings
	fmt.Println("Performance Settings:")
	fmt.Printf("  Cache TTL: %ds\n", valueOrDefaultInt(cfg.Performance.CacheTTL, 120))
	fmt.Printf("  Comment Cache TTL: %ds\n", valueOrDefaultInt(cfg.Performance.CommentCacheTTL, 20))
	fmt.Printf("  Max Concurrency: %d\n", valueOrDefaultInt(cfg.Performance.MaxConcurrency, 6))
	fmt.Printf("  Rate Limit: %d req/sec\n", valueOrDefaultInt(cfg.Performance.RateLimitPerSecond, 10))
	fmt.Println()

	// Providers
	fmt.Println("Configured Providers:")
	if len(cfg.Providers) == 0 {
		fmt.Println("  (none configured)")
	} else {
		for _, p := range cfg.Providers {
			fmt.Printf("  • %s (%s @ %s)\n", p.Name, p.Type, p.GetHost())
		}
	}
	fmt.Println()

	// Config file location
	configDir, _ := config.ConfigDir()
	fmt.Printf("Config file: %s/config.yaml\n", configDir)
	fmt.Println("Run 'lazyreview config edit' to modify")

	return nil
}

func valueOrDefault(value, defaultValue string) string {
	if value == "" {
		return defaultValue
	}
	return value
}

func valueOrDefaultInt(value, defaultValue int) int {
	if value == 0 {
		return defaultValue
	}
	return value
}

// openPRAction opens a PR in the browser
func openPRAction(prNumber, repo string) error {
	// Detect git context if repo not specified
	var owner, repoName string
	if repo != "" {
		parts := strings.Split(repo, "/")
		if len(parts) != 2 {
			return fmt.Errorf("invalid repo format, expected owner/repo")
		}
		owner, repoName = parts[0], parts[1]
	} else {
		gitCtx, err := git.DetectGitContext()
		if err != nil || !gitCtx.IsGitRepo {
			return fmt.Errorf("not in a git repository, use --repo flag")
		}
		remote := gitCtx.GetPrimaryRemote()
		if remote == nil || !remote.IsValid() {
			return fmt.Errorf("could not detect repository, use --repo flag")
		}
		owner, repoName = remote.Owner, remote.Repo
	}

	// Build URL
	var url string
	if prNumber != "" {
		url = fmt.Sprintf("https://github.com/%s/%s/pull/%s", owner, repoName, prNumber)
	} else {
		url = fmt.Sprintf("https://github.com/%s/%s/pulls", owner, repoName)
	}

	fmt.Printf("Opening: %s\n", url)

	// Open in browser
	var cmd *exec.Cmd
	switch {
	case isCommandAvailable("open"):
		cmd = exec.Command("open", url)
	case isCommandAvailable("xdg-open"):
		cmd = exec.Command("xdg-open", url)
	case isCommandAvailable("start"):
		cmd = exec.Command("cmd", "/c", "start", url)
	default:
		fmt.Println("Could not detect browser opener, please open manually:")
		fmt.Println(url)
		return nil
	}

	return cmd.Run()
}

func isCommandAvailable(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

// listPRsAction lists PRs in terminal
func listPRsAction(mine, review bool, limit int, state string) error {
	// Initialize auth and provider
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	authService, err := auth.NewService()
	if err != nil {
		return fmt.Errorf("failed to initialize auth: %w", err)
	}

	statuses, err := authService.GetAllStatus()
	if err != nil || len(statuses) == 0 {
		return fmt.Errorf("not authenticated. Run: lazyreview auth login --provider github")
	}

	// Get provider config
	var providerCfg *config.ProviderConfig
	if cfg.DefaultProvider != "" {
		providerCfg = cfg.GetProviderByName(cfg.DefaultProvider)
	}
	if providerCfg == nil {
		status := statuses[0]
		providerCfg = &config.ProviderConfig{
			Name: string(status.ProviderType),
			Type: status.ProviderType,
			Host: status.Host,
		}
	}

	cred, err := authService.GetCredential(providerCfg.Type, providerCfg.GetHost())
	if err != nil {
		return fmt.Errorf("failed to get credentials: %w", err)
	}

	provider, err := providers.Create(*providerCfg)
	if err != nil {
		return fmt.Errorf("failed to create provider: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := provider.Authenticate(ctx, cred.Token); err != nil {
		return fmt.Errorf("failed to authenticate: %w", err)
	}

	// Determine PR state
	var prState models.PullRequestState
	switch state {
	case "open":
		prState = models.PRStateOpen
	case "closed":
		prState = models.PRStateClosed
	default:
		prState = models.PRStateOpen
	}

	// Fetch PRs
	var prs []models.PullRequest
	if mine {
		prs, err = provider.ListUserPullRequests(ctx, providers.UserPROptions{
			Involvement: "authored",
			State:       prState,
			PerPage:     limit,
		})
	} else if review {
		prs, err = provider.ListUserPullRequests(ctx, providers.UserPROptions{
			Involvement: "review-requested",
			State:       prState,
			PerPage:     limit,
		})
	} else {
		// Try to detect repo
		gitCtx, _ := git.DetectGitContext()
		if gitCtx != nil && gitCtx.IsGitRepo {
			remote := gitCtx.GetPrimaryRemote()
			if remote != nil && remote.IsValid() {
				opts := providers.ListOptions{
					State:   prState,
					PerPage: limit,
				}
				prs, err = provider.ListPullRequests(ctx, remote.Owner, remote.Repo, opts)
			}
		}
		if prs == nil {
			// Fall back to user's PRs
			prs, err = provider.ListUserPullRequests(ctx, providers.UserPROptions{
				Involvement: "authored",
				State:       prState,
				PerPage:     limit,
			})
		}
	}

	if err != nil {
		return fmt.Errorf("failed to fetch PRs: %w", err)
	}

	if len(prs) == 0 {
		fmt.Println("No pull requests found.")
		return nil
	}

	// Display PRs
	fmt.Printf("Pull Requests (%d):\n", len(prs))
	fmt.Println(strings.Repeat("-", 70))
	for _, pr := range prs {
		status := "○"
		if pr.State == models.PRStateClosed || pr.State == models.PRStateMerged {
			status = "●"
		}
		if pr.IsDraft {
			status = "◌"
		}

		title := pr.Title
		if len(title) > 50 {
			title = title[:47] + "..."
		}

		fmt.Printf("%s #%-5d %-50s %s\n", status, pr.Number, title, pr.Author.Login)
	}

	return nil
}

// approvePRAction approves a PR
func approvePRAction(prNumber, repo, message string) error {
	// Detect git context if repo not specified
	var owner, repoName string
	if repo != "" {
		parts := strings.Split(repo, "/")
		if len(parts) != 2 {
			return fmt.Errorf("invalid repo format, expected owner/repo")
		}
		owner, repoName = parts[0], parts[1]
	} else {
		gitCtx, err := git.DetectGitContext()
		if err != nil || !gitCtx.IsGitRepo {
			return fmt.Errorf("not in a git repository, use --repo flag")
		}
		remote := gitCtx.GetPrimaryRemote()
		if remote == nil || !remote.IsValid() {
			return fmt.Errorf("could not detect repository, use --repo flag")
		}
		owner, repoName = remote.Owner, remote.Repo
	}

	// Parse PR number
	var prNum int
	if _, err := fmt.Sscanf(prNumber, "%d", &prNum); err != nil {
		return fmt.Errorf("invalid PR number: %s", prNumber)
	}

	// Initialize auth and provider
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	authService, err := auth.NewService()
	if err != nil {
		return fmt.Errorf("failed to initialize auth: %w", err)
	}

	statuses, err := authService.GetAllStatus()
	if err != nil || len(statuses) == 0 {
		return fmt.Errorf("not authenticated. Run: lazyreview auth login --provider github")
	}

	var providerCfg *config.ProviderConfig
	if cfg.DefaultProvider != "" {
		providerCfg = cfg.GetProviderByName(cfg.DefaultProvider)
	}
	if providerCfg == nil {
		status := statuses[0]
		providerCfg = &config.ProviderConfig{
			Name: string(status.ProviderType),
			Type: status.ProviderType,
			Host: status.Host,
		}
	}

	cred, err := authService.GetCredential(providerCfg.Type, providerCfg.GetHost())
	if err != nil {
		return fmt.Errorf("failed to get credentials: %w", err)
	}

	provider, err := providers.Create(*providerCfg)
	if err != nil {
		return fmt.Errorf("failed to create provider: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := provider.Authenticate(ctx, cred.Token); err != nil {
		return fmt.Errorf("failed to authenticate: %w", err)
	}

	// Submit approval
	fmt.Printf("Approving PR #%d in %s/%s...\n", prNum, owner, repoName)

	review := models.ReviewInput{
		Body:  message,
		Event: models.ReviewEventApprove,
	}

	if err := provider.CreateReview(ctx, owner, repoName, prNum, review); err != nil {
		return fmt.Errorf("failed to approve PR: %w", err)
	}

	fmt.Printf("✓ PR #%d approved!\n", prNum)
	return nil
}

// requestChangesAction requests changes on a PR
func requestChangesAction(prNumber, repo, message string) error {
	// Detect git context if repo not specified
	var owner, repoName string
	if repo != "" {
		parts := strings.Split(repo, "/")
		if len(parts) != 2 {
			return fmt.Errorf("invalid repo format, expected owner/repo")
		}
		owner, repoName = parts[0], parts[1]
	} else {
		gitCtx, err := git.DetectGitContext()
		if err != nil || !gitCtx.IsGitRepo {
			return fmt.Errorf("not in a git repository, use --repo flag")
		}
		remote := gitCtx.GetPrimaryRemote()
		if remote == nil || !remote.IsValid() {
			return fmt.Errorf("could not detect repository, use --repo flag")
		}
		owner, repoName = remote.Owner, remote.Repo
	}

	// Parse PR number
	var prNum int
	if _, err := fmt.Sscanf(prNumber, "%d", &prNum); err != nil {
		return fmt.Errorf("invalid PR number: %s", prNumber)
	}

	// Initialize auth and provider
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	authService, err := auth.NewService()
	if err != nil {
		return fmt.Errorf("failed to initialize auth: %w", err)
	}

	statuses, err := authService.GetAllStatus()
	if err != nil || len(statuses) == 0 {
		return fmt.Errorf("not authenticated. Run: lazyreview auth login --provider github")
	}

	var providerCfg *config.ProviderConfig
	if cfg.DefaultProvider != "" {
		providerCfg = cfg.GetProviderByName(cfg.DefaultProvider)
	}
	if providerCfg == nil {
		status := statuses[0]
		providerCfg = &config.ProviderConfig{
			Name: string(status.ProviderType),
			Type: status.ProviderType,
			Host: status.Host,
		}
	}

	cred, err := authService.GetCredential(providerCfg.Type, providerCfg.GetHost())
	if err != nil {
		return fmt.Errorf("failed to get credentials: %w", err)
	}

	provider, err := providers.Create(*providerCfg)
	if err != nil {
		return fmt.Errorf("failed to create provider: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := provider.Authenticate(ctx, cred.Token); err != nil {
		return fmt.Errorf("failed to authenticate: %w", err)
	}

	// Submit request changes
	fmt.Printf("Requesting changes on PR #%d in %s/%s...\n", prNum, owner, repoName)

	review := models.ReviewInput{
		Body:  message,
		Event: models.ReviewEventRequestChanges,
	}

	if err := provider.CreateReview(ctx, owner, repoName, prNum, review); err != nil {
		return fmt.Errorf("failed to request changes: %w", err)
	}

	fmt.Printf("✓ Changes requested on PR #%d\n", prNum)
	return nil
}

// checkoutPRAction checks out a PR branch locally
func checkoutPRAction(prNumber, repo string) error {
	// Detect git context if repo not specified
	var owner, repoName string
	if repo != "" {
		parts := strings.Split(repo, "/")
		if len(parts) != 2 {
			return fmt.Errorf("invalid repo format, expected owner/repo")
		}
		owner, repoName = parts[0], parts[1]
	} else {
		gitCtx, err := git.DetectGitContext()
		if err != nil || !gitCtx.IsGitRepo {
			return fmt.Errorf("not in a git repository")
		}
		remote := gitCtx.GetPrimaryRemote()
		if remote == nil || !remote.IsValid() {
			return fmt.Errorf("could not detect repository")
		}
		owner, repoName = remote.Owner, remote.Repo
	}

	// Parse PR number
	var prNum int
	if _, err := fmt.Sscanf(prNumber, "%d", &prNum); err != nil {
		return fmt.Errorf("invalid PR number: %s", prNumber)
	}

	// Initialize auth and provider to get PR details
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	authService, err := auth.NewService()
	if err != nil {
		return fmt.Errorf("failed to initialize auth: %w", err)
	}

	statuses, err := authService.GetAllStatus()
	if err != nil || len(statuses) == 0 {
		return fmt.Errorf("not authenticated. Run: lazyreview auth login --provider github")
	}

	var providerCfg *config.ProviderConfig
	if cfg.DefaultProvider != "" {
		providerCfg = cfg.GetProviderByName(cfg.DefaultProvider)
	}
	if providerCfg == nil {
		status := statuses[0]
		providerCfg = &config.ProviderConfig{
			Name: string(status.ProviderType),
			Type: status.ProviderType,
			Host: status.Host,
		}
	}

	cred, err := authService.GetCredential(providerCfg.Type, providerCfg.GetHost())
	if err != nil {
		return fmt.Errorf("failed to get credentials: %w", err)
	}

	provider, err := providers.Create(*providerCfg)
	if err != nil {
		return fmt.Errorf("failed to create provider: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := provider.Authenticate(ctx, cred.Token); err != nil {
		return fmt.Errorf("failed to authenticate: %w", err)
	}

	// Get PR details to get branch name
	pr, err := provider.GetPullRequest(ctx, owner, repoName, prNum)
	if err != nil {
		return fmt.Errorf("failed to get PR: %w", err)
	}

	branchName := pr.SourceBranch
	fmt.Printf("Checking out PR #%d branch: %s\n", prNum, branchName)

	// Fetch and checkout
	fetchCmd := exec.Command("git", "fetch", "origin", fmt.Sprintf("pull/%d/head:%s", prNum, branchName))
	fetchCmd.Stdout = os.Stdout
	fetchCmd.Stderr = os.Stderr
	if err := fetchCmd.Run(); err != nil {
		// Try alternative: fetch the branch directly
		fetchCmd = exec.Command("git", "fetch", "origin", branchName)
		fetchCmd.Stdout = os.Stdout
		fetchCmd.Stderr = os.Stderr
		if err := fetchCmd.Run(); err != nil {
			return fmt.Errorf("failed to fetch branch: %w", err)
		}
	}

	checkoutCmd := exec.Command("git", "checkout", branchName)
	checkoutCmd.Stdout = os.Stdout
	checkoutCmd.Stderr = os.Stderr
	if err := checkoutCmd.Run(); err != nil {
		return fmt.Errorf("failed to checkout branch: %w", err)
	}

	fmt.Printf("✓ Checked out branch: %s\n", branchName)
	return nil
}

// diffPRAction shows PR diff in terminal
func diffPRAction(prNumber, repo string, statOnly bool) error {
	// Detect git context if repo not specified
	var owner, repoName string
	if repo != "" {
		parts := strings.Split(repo, "/")
		if len(parts) != 2 {
			return fmt.Errorf("invalid repo format, expected owner/repo")
		}
		owner, repoName = parts[0], parts[1]
	} else {
		gitCtx, err := git.DetectGitContext()
		if err != nil || !gitCtx.IsGitRepo {
			return fmt.Errorf("not in a git repository, use --repo flag")
		}
		remote := gitCtx.GetPrimaryRemote()
		if remote == nil || !remote.IsValid() {
			return fmt.Errorf("could not detect repository, use --repo flag")
		}
		owner, repoName = remote.Owner, remote.Repo
	}

	// Parse PR number
	var prNum int
	if _, err := fmt.Sscanf(prNumber, "%d", &prNum); err != nil {
		return fmt.Errorf("invalid PR number: %s", prNumber)
	}

	// Initialize auth and provider
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	authService, err := auth.NewService()
	if err != nil {
		return fmt.Errorf("failed to initialize auth: %w", err)
	}

	statuses, err := authService.GetAllStatus()
	if err != nil || len(statuses) == 0 {
		return fmt.Errorf("not authenticated. Run: lazyreview auth login --provider github")
	}

	var providerCfg *config.ProviderConfig
	if cfg.DefaultProvider != "" {
		providerCfg = cfg.GetProviderByName(cfg.DefaultProvider)
	}
	if providerCfg == nil {
		status := statuses[0]
		providerCfg = &config.ProviderConfig{
			Name: string(status.ProviderType),
			Type: status.ProviderType,
			Host: status.Host,
		}
	}

	cred, err := authService.GetCredential(providerCfg.Type, providerCfg.GetHost())
	if err != nil {
		return fmt.Errorf("failed to get credentials: %w", err)
	}

	provider, err := providers.Create(*providerCfg)
	if err != nil {
		return fmt.Errorf("failed to create provider: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	if err := provider.Authenticate(ctx, cred.Token); err != nil {
		return fmt.Errorf("failed to authenticate: %w", err)
	}

	// Get PR details
	pr, err := provider.GetPullRequest(ctx, owner, repoName, prNum)
	if err != nil {
		return fmt.Errorf("failed to get PR: %w", err)
	}

	fmt.Printf("PR #%d: %s\n", pr.Number, pr.Title)
	fmt.Printf("Author: %s | %s -> %s\n", pr.Author.Login, pr.SourceBranch, pr.TargetBranch)
	fmt.Println(strings.Repeat("-", 60))

	if statOnly {
		// Get files for stats only
		files, err := provider.GetPullRequestFiles(ctx, owner, repoName, prNum)
		if err != nil {
			return fmt.Errorf("failed to get PR files: %w", err)
		}

		var totalAdditions, totalDeletions int
		for _, f := range files {
			fmt.Printf(" %s | +%d -%d\n", f.Filename, f.Additions, f.Deletions)
			totalAdditions += f.Additions
			totalDeletions += f.Deletions
		}
		fmt.Println(strings.Repeat("-", 60))
		fmt.Printf("%d files changed, +%d insertions, -%d deletions\n", len(files), totalAdditions, totalDeletions)
		return nil
	}

	// Get full diff
	diff, err := provider.GetPullRequestDiff(ctx, owner, repoName, prNum)
	if err != nil {
		return fmt.Errorf("failed to get PR diff: %w", err)
	}

	// Print diff with basic coloring
	for _, file := range diff.Files {
		fmt.Printf("\n\033[1m%s\033[0m (+%d -%d)\n", file.Path, file.Additions, file.Deletions)
		fmt.Println(strings.Repeat("─", 60))

		for _, hunk := range file.Hunks {
			fmt.Printf("\033[36m%s\033[0m\n", hunk.Header)
			for _, line := range hunk.Lines {
				switch line.Type {
				case models.DiffLineAdded:
					fmt.Printf("\033[32m+%s\033[0m\n", line.Content)
				case models.DiffLineDeleted:
					fmt.Printf("\033[31m-%s\033[0m\n", line.Content)
				default:
					fmt.Printf(" %s\n", line.Content)
				}
			}
		}
	}

	return nil
}

func init() {
	// Suppress unused import warning
	_ = strings.TrimSpace
}

// mergeAction merges a PR
func mergeAction(prNumberStr, repoFlag, method, message string, deleteBranch bool) error {
	// Detect git context if repo not specified
	var owner, repoName string
	if repoFlag != "" {
		parts := strings.Split(repoFlag, "/")
		if len(parts) != 2 {
			return fmt.Errorf("invalid repo format, expected owner/repo")
		}
		owner, repoName = parts[0], parts[1]
	} else {
		gitCtx, err := git.DetectGitContext()
		if err != nil || !gitCtx.IsGitRepo {
			return fmt.Errorf("not in a git repository, use --repo flag")
		}
		remote := gitCtx.GetPrimaryRemote()
		if remote == nil || !remote.IsValid() {
			return fmt.Errorf("could not detect repository, use --repo flag")
		}
		owner, repoName = remote.Owner, remote.Repo
	}

	// Parse PR number
	var prNum int
	if _, err := fmt.Sscanf(prNumberStr, "%d", &prNum); err != nil {
		return fmt.Errorf("invalid PR number: %s", prNumberStr)
	}

	// Initialize auth and provider
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	authService, err := auth.NewService()
	if err != nil {
		return fmt.Errorf("failed to initialize auth: %w", err)
	}

	statuses, err := authService.GetAllStatus()
	if err != nil || len(statuses) == 0 {
		return fmt.Errorf("not authenticated. Run: lazyreview auth login --provider github")
	}

	var providerCfg *config.ProviderConfig
	if cfg.DefaultProvider != "" {
		providerCfg = cfg.GetProviderByName(cfg.DefaultProvider)
	}
	if providerCfg == nil {
		status := statuses[0]
		providerCfg = &config.ProviderConfig{
			Name: string(status.ProviderType),
			Type: status.ProviderType,
			Host: status.Host,
		}
	}

	cred, err := authService.GetCredential(providerCfg.Type, providerCfg.GetHost())
	if err != nil {
		return fmt.Errorf("failed to get credentials: %w", err)
	}

	provider, err := providers.Create(*providerCfg)
	if err != nil {
		return fmt.Errorf("failed to create provider: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := provider.Authenticate(ctx, cred.Token); err != nil {
		return fmt.Errorf("failed to authenticate: %w", err)
	}

	// Validate merge method
	var mergeMethod providers.MergeMethod
	switch method {
	case "merge":
		mergeMethod = providers.MergeMethodMerge
	case "squash":
		mergeMethod = providers.MergeMethodSquash
	case "rebase":
		mergeMethod = providers.MergeMethodRebase
	default:
		return fmt.Errorf("invalid merge method: %s (use: merge, squash, rebase)", method)
	}

	// Get PR to verify it exists and is mergeable
	pr, err := provider.GetPullRequest(ctx, owner, repoName, prNum)
	if err != nil {
		return fmt.Errorf("failed to get PR: %w", err)
	}

	if pr.State != models.PRStateOpen {
		return fmt.Errorf("PR #%d is not open (state: %s)", prNum, pr.State)
	}

	// Merge the PR
	opts := providers.MergeOptions{
		Method:       mergeMethod,
		DeleteBranch: deleteBranch,
	}
	if message != "" {
		opts.CommitMessage = message
	}

	err = provider.MergePullRequest(ctx, owner, repoName, prNum, opts)
	if err != nil {
		return fmt.Errorf("failed to merge PR: %w", err)
	}

	fmt.Printf("✓ Successfully merged PR #%d using %s method\n", prNum, method)
	if deleteBranch {
		fmt.Printf("  Branch '%s' has been deleted\n", pr.SourceBranch)
	}

	return nil
}

// commentAction adds a comment to a PR
func commentAction(prNumberStr, repoFlag, message string) error {
	// Detect git context if repo not specified
	var owner, repoName string
	if repoFlag != "" {
		parts := strings.Split(repoFlag, "/")
		if len(parts) != 2 {
			return fmt.Errorf("invalid repo format, expected owner/repo")
		}
		owner, repoName = parts[0], parts[1]
	} else {
		gitCtx, err := git.DetectGitContext()
		if err != nil || !gitCtx.IsGitRepo {
			return fmt.Errorf("not in a git repository, use --repo flag")
		}
		remote := gitCtx.GetPrimaryRemote()
		if remote == nil || !remote.IsValid() {
			return fmt.Errorf("could not detect repository, use --repo flag")
		}
		owner, repoName = remote.Owner, remote.Repo
	}

	// Parse PR number
	var prNum int
	if _, err := fmt.Sscanf(prNumberStr, "%d", &prNum); err != nil {
		return fmt.Errorf("invalid PR number: %s", prNumberStr)
	}

	// Initialize auth and provider
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	authService, err := auth.NewService()
	if err != nil {
		return fmt.Errorf("failed to initialize auth: %w", err)
	}

	statuses, err := authService.GetAllStatus()
	if err != nil || len(statuses) == 0 {
		return fmt.Errorf("not authenticated. Run: lazyreview auth login --provider github")
	}

	var providerCfg *config.ProviderConfig
	if cfg.DefaultProvider != "" {
		providerCfg = cfg.GetProviderByName(cfg.DefaultProvider)
	}
	if providerCfg == nil {
		status := statuses[0]
		providerCfg = &config.ProviderConfig{
			Name: string(status.ProviderType),
			Type: status.ProviderType,
			Host: status.Host,
		}
	}

	cred, err := authService.GetCredential(providerCfg.Type, providerCfg.GetHost())
	if err != nil {
		return fmt.Errorf("failed to get credentials: %w", err)
	}

	provider, err := providers.Create(*providerCfg)
	if err != nil {
		return fmt.Errorf("failed to create provider: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := provider.Authenticate(ctx, cred.Token); err != nil {
		return fmt.Errorf("failed to authenticate: %w", err)
	}

	// Create the comment
	input := models.CommentInput{
		Body: message,
	}

	err = provider.CreateComment(ctx, owner, repoName, prNum, input)
	if err != nil {
		return fmt.Errorf("failed to add comment: %w", err)
	}

	fmt.Printf("✓ Comment added to PR #%d\n", prNum)
	return nil
}

// Shell completion scripts

var bashCompletion = `#!/bin/bash

_lazyreview_completions() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    local commands="start auth config version keys doctor status open list approve request-changes checkout diff completion merge comment help"

    case "${prev}" in
        auth)
            COMPREPLY=( $(compgen -W "login logout status" -- ${cur}) )
            return 0
            ;;
        config)
            COMPREPLY=( $(compgen -W "path edit show" -- ${cur}) )
            return 0
            ;;
        completion)
            COMPREPLY=( $(compgen -W "bash zsh fish" -- ${cur}) )
            return 0
            ;;
        --provider|-p)
            COMPREPLY=( $(compgen -W "github gitlab bitbucket azuredevops" -- ${cur}) )
            return 0
            ;;
        --method)
            COMPREPLY=( $(compgen -W "merge squash rebase" -- ${cur}) )
            return 0
            ;;
        --state)
            COMPREPLY=( $(compgen -W "open closed all" -- ${cur}) )
            return 0
            ;;
        lazyreview)
            COMPREPLY=( $(compgen -W "${commands}" -- ${cur}) )
            return 0
            ;;
    esac

    if [[ ${cur} == -* ]] ; then
        local flags="--help --version --debug"
        COMPREPLY=( $(compgen -W "${flags}" -- ${cur}) )
        return 0
    fi

    COMPREPLY=( $(compgen -W "${commands}" -- ${cur}) )
}

complete -F _lazyreview_completions lazyreview
`

var zshCompletion = `#compdef lazyreview

_lazyreview() {
    local -a commands
    commands=(
        'start:Start the LazyReview TUI'
        'auth:Authentication commands'
        'config:Configuration commands'
        'version:Show version'
        'keys:Show keyboard shortcuts'
        'doctor:Run system diagnostics'
        'status:Show quick status overview'
        'open:Open PR in browser'
        'list:List pull requests'
        'approve:Approve a pull request'
        'request-changes:Request changes on a PR'
        'checkout:Checkout a PR branch locally'
        'diff:View PR diff in terminal'
        'completion:Generate shell completion scripts'
        'merge:Merge a pull request'
        'comment:Add a comment to a PR'
        'help:Show help'
    )

    local -a auth_commands
    auth_commands=(
        'login:Login to a Git provider'
        'logout:Logout from a Git provider'
        'status:Show authentication status'
    )

    local -a config_commands
    config_commands=(
        'path:Show config file path'
        'edit:Edit config file'
        'show:Show current configuration'
    )

    local -a completion_commands
    completion_commands=(
        'bash:Generate bash completion script'
        'zsh:Generate zsh completion script'
        'fish:Generate fish completion script'
    )

    _arguments -C \
        '1: :->command' \
        '*: :->args'

    case $state in
        command)
            _describe -t commands 'lazyreview commands' commands
            ;;
        args)
            case $words[2] in
                auth)
                    _describe -t auth_commands 'auth commands' auth_commands
                    ;;
                config)
                    _describe -t config_commands 'config commands' config_commands
                    ;;
                completion)
                    _describe -t completion_commands 'completion commands' completion_commands
                    ;;
                merge)
                    _arguments \
                        '--repo[Repository]:repo:' \
                        '--method[Merge method]:method:(merge squash rebase)' \
                        '--message[Commit message]:message:' \
                        '--delete-branch[Delete source branch]' \
                        '*:PR number:'
                    ;;
                approve|request-changes|checkout|diff|open|comment)
                    _arguments \
                        '--repo[Repository]:repo:' \
                        '--message[Message]:message:' \
                        '*:PR number:'
                    ;;
                list)
                    _arguments \
                        '--mine[Show only my PRs]' \
                        '--review[Show PRs needing review]' \
                        '--limit[Limit results]:limit:' \
                        '--state[PR state]:state:(open closed all)' \
                        '--repo[Repository]:repo:'
                    ;;
            esac
            ;;
    esac
}

_lazyreview "$@"
`

var fishCompletion = `# Fish completion for lazyreview

complete -c lazyreview -f

complete -c lazyreview -n "__fish_use_subcommand" -a "start" -d "Start the LazyReview TUI"
complete -c lazyreview -n "__fish_use_subcommand" -a "auth" -d "Authentication commands"
complete -c lazyreview -n "__fish_use_subcommand" -a "config" -d "Configuration commands"
complete -c lazyreview -n "__fish_use_subcommand" -a "version" -d "Show version"
complete -c lazyreview -n "__fish_use_subcommand" -a "keys" -d "Show keyboard shortcuts"
complete -c lazyreview -n "__fish_use_subcommand" -a "doctor" -d "Run system diagnostics"
complete -c lazyreview -n "__fish_use_subcommand" -a "status" -d "Show quick status overview"
complete -c lazyreview -n "__fish_use_subcommand" -a "open" -d "Open PR in browser"
complete -c lazyreview -n "__fish_use_subcommand" -a "list" -d "List pull requests"
complete -c lazyreview -n "__fish_use_subcommand" -a "approve" -d "Approve a pull request"
complete -c lazyreview -n "__fish_use_subcommand" -a "request-changes" -d "Request changes on a PR"
complete -c lazyreview -n "__fish_use_subcommand" -a "checkout" -d "Checkout a PR branch locally"
complete -c lazyreview -n "__fish_use_subcommand" -a "diff" -d "View PR diff in terminal"
complete -c lazyreview -n "__fish_use_subcommand" -a "completion" -d "Generate shell completions"
complete -c lazyreview -n "__fish_use_subcommand" -a "merge" -d "Merge a pull request"
complete -c lazyreview -n "__fish_use_subcommand" -a "comment" -d "Add a comment to a PR"
complete -c lazyreview -n "__fish_use_subcommand" -a "help" -d "Show help"

complete -c lazyreview -n "__fish_seen_subcommand_from auth" -a "login" -d "Login to a Git provider"
complete -c lazyreview -n "__fish_seen_subcommand_from auth" -a "logout" -d "Logout from a Git provider"
complete -c lazyreview -n "__fish_seen_subcommand_from auth" -a "status" -d "Show authentication status"

complete -c lazyreview -n "__fish_seen_subcommand_from config" -a "path" -d "Show config file path"
complete -c lazyreview -n "__fish_seen_subcommand_from config" -a "edit" -d "Edit config file"
complete -c lazyreview -n "__fish_seen_subcommand_from config" -a "show" -d "Show current configuration"

complete -c lazyreview -n "__fish_seen_subcommand_from completion" -a "bash" -d "Generate bash completion"
complete -c lazyreview -n "__fish_seen_subcommand_from completion" -a "zsh" -d "Generate zsh completion"
complete -c lazyreview -n "__fish_seen_subcommand_from completion" -a "fish" -d "Generate fish completion"

complete -c lazyreview -n "__fish_seen_subcommand_from auth" -l provider -s p -d "Provider type" -a "github gitlab bitbucket azuredevops"
complete -c lazyreview -n "__fish_seen_subcommand_from merge" -l repo -s r -d "Repository"
complete -c lazyreview -n "__fish_seen_subcommand_from merge" -l method -d "Merge method" -a "merge squash rebase"
complete -c lazyreview -n "__fish_seen_subcommand_from merge" -l message -s m -d "Commit message"
complete -c lazyreview -n "__fish_seen_subcommand_from merge" -l delete-branch -d "Delete source branch"
complete -c lazyreview -n "__fish_seen_subcommand_from list" -l mine -d "Show only my PRs"
complete -c lazyreview -n "__fish_seen_subcommand_from list" -l review -d "Show PRs needing review"
complete -c lazyreview -n "__fish_seen_subcommand_from list" -l limit -d "Limit results"
complete -c lazyreview -n "__fish_seen_subcommand_from list" -l state -d "PR state" -a "open closed all"

complete -c lazyreview -l help -s h -d "Show help"
complete -c lazyreview -l version -s v -d "Show version"
complete -c lazyreview -l debug -s d -d "Enable debug mode"
`

package cmd

import (
	"fmt"

	"lazyreview/internal/config"
	"lazyreview/internal/gui"

	"github.com/urfave/cli"
)

// CommandStart initializes the CLI application and sets up the "start" command
// This command will launch the LazyReview TUI application
// It is the entry point for users to start using the LazyReview tool
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
					},
					Action: func(c *cli.Context) error {
						provider := c.String("provider")
						host := c.String("host")
						return loginAction(provider, host)
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
						cli.BoolFlag{
							Name:  "all",
							Usage: "Logout from all providers",
						},
					},
					Action: func(c *cli.Context) error {
						if c.Bool("all") {
							return logoutAllAction()
						}
						return logoutAction(c.String("provider"))
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
func loginAction(provider, host string) error {
	fmt.Printf("Login to %s", provider)
	if host != "" {
		fmt.Printf(" (%s)", host)
	}
	fmt.Println()
	fmt.Println("Authentication will be implemented in Phase 2")
	return nil
}

// logoutAction handles the logout command
func logoutAction(provider string) error {
	if provider == "" {
		fmt.Println("Please specify a provider with --provider or use --all")
		return nil
	}
	fmt.Printf("Logout from %s\n", provider)
	fmt.Println("Authentication will be implemented in Phase 2")
	return nil
}

// logoutAllAction handles logging out from all providers
func logoutAllAction() error {
	fmt.Println("Logging out from all providers...")
	fmt.Println("Authentication will be implemented in Phase 2")
	return nil
}

// authStatusAction shows authentication status
func authStatusAction() error {
	fmt.Println("Authentication Status")
	fmt.Println("=====================")
	fmt.Println("No providers configured yet.")
	fmt.Println("Authentication will be implemented in Phase 2")
	return nil
}

// editConfigAction opens the config file in an editor
func editConfigAction() error {
	configDir, err := config.ConfigDir()
	if err != nil {
		return err
	}
	fmt.Printf("Config directory: %s\n", configDir)
	fmt.Println("Config editing will be implemented later")
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

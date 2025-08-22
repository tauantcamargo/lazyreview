package cmd

import (
	"lazyreview/pkg/tui"

	"github.com/urfave/cli"
)

// CommandStart initializes the CLI application and sets up the "start" command
// This command will launch the LazyReview TUI application
// It is the entry point for users to start using the LazyReview tool
func CommandStart() *cli.App {
	app := cli.NewApp()
	app.Name = "LazyReview"
	app.Usage = "A simple CLI tool for reviewing Pull Requests"
	app.Version = "0.1.0"

	app.Commands = []cli.Command{
		{
			Name:    "start",
			Aliases: []string{"s"},
			Usage:   "Start the LazyReview application",
			Action: func(c *cli.Context) error {
				tui.IntializeUI()
				return nil
			},
		},
	}

	return app
}

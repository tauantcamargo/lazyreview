package main

import (
	"lazyreview/cmd"
	"log"
	"os"
)

func main() {
	app := cmd.CommandStart()

	if err := app.Run(os.Args); err != nil {
		log.Fatal(err)
	}
}

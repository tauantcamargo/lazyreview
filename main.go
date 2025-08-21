package main

import (
	"errors"
	"fmt"
	"log"

	"github.com/awesome-gocui/gocui"
)

func main() {
	g, err := gocui.NewGui(gocui.OutputNormal, true)
	if err != nil {
		log.Panicln(err)
	}

	defer g.Close()

	g.SetManagerFunc(layout)

	if err := g.SetKeybinding("", gocui.KeyCtrlC, gocui.ModNone, quit); err != nil {
		log.Panicln(err)
	}

	if err := g.MainLoop(); err != nil && !errors.Is(err, gocui.ErrQuit) {
		log.Panicln(err)
	}
}

func layout(g *gocui.Gui) error {
	maxX, maxY := g.Size()

	if v, err := g.SetView("hello", maxX/2-7, maxY/2, maxX/2+7, maxY/2+2, 0); err != nil {
		if !errors.Is(err, gocui.ErrUnknownView) {
			return err
		}

		if _, err := g.SetCurrentView("hello"); err != nil {
			return err
		}

		fmt.Fprintln(v, "LazyReview")
	}

	return nil
}

func quit(g *gocui.Gui, v *gocui.View) error {
	return gocui.ErrQuit
}

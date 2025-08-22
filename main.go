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

// Create App Layout
func layout(g *gocui.Gui) error {
	maxX, maxY := g.Size()

	if v, err := g.SetView("header", 0, 0, maxX-1, 3, 0); err != nil {
		if !errors.Is(err, gocui.ErrUnknownView) {
			return err
		}

		if _, err := g.SetCurrentView("header"); err != nil {
			return err
		}

		fmt.Fprintln(v, "LazyReview - A simple CLI tool for reviewing Pull Requests")
		v.Title = "Header"
		v.FgColor = gocui.ColorWhite
		v.BgColor = gocui.ColorBlue
		v.Wrap = true
		v.Autoscroll = true
		v.Editable = false
		v.Highlight = true
		v.SelBgColor = gocui.ColorCyan
		v.SelFgColor = gocui.ColorBlack

	}

	// Add sidebar
	if v, err := g.SetView("sidebar", 0, 3, maxX-1, maxY-3, 0); err != nil {
		if !errors.Is(err, gocui.ErrUnknownView) {
			return err
		}

		if _, err := g.SetCurrentView("sidebar"); err != nil {
			return err
		}

		fmt.Fprintln(v, "Sidebar content goes here.")
		v.Title = "Sidebar"
		v.FgColor = gocui.ColorWhite
		v.BgColor = gocui.ColorBlack
		v.Wrap = true
		v.Autoscroll = true
		v.Editable = false
		v.Highlight = true
		v.SelBgColor = gocui.ColorCyan
		v.SelFgColor = gocui.ColorBlack
	}

	if v, err := g.SetView("content", 31, 3, maxX-1, maxY-3, 0); err != nil {
		if !errors.Is(err, gocui.ErrUnknownView) {
			return err
		}

		if _, err := g.SetCurrentView("content"); err != nil {
			return err
		}

		fmt.Fprintln(v, "This is where the main content will be displayed.")
		v.Title = "Content"
		v.FgColor = gocui.ColorWhite
		v.BgColor = gocui.ColorBlack
		v.Wrap = true
		v.Autoscroll = true
		v.Editable = false
		v.Highlight = true
		v.SelBgColor = gocui.ColorCyan
		v.SelFgColor = gocui.ColorBlack
		v.Editor = gocui.DefaultEditor
	}

	// footer
	if v, err := g.SetView("footer", 0, maxY-3, maxX-1, maxY, 0); err != nil {
		if !errors.Is(err, gocui.ErrUnknownView) {
			return err
		}

		if _, err := g.SetCurrentView("footer"); err != nil {
			return err
		}

		fmt.Fprintln(v, "Press Ctrl+C to quit")
		v.Title = "Footer"
		v.FgColor = gocui.ColorWhite
		v.BgColor = gocui.ColorBlue
		v.Wrap = true
		v.Autoscroll = true
		v.Editable = false
		v.Highlight = true
		v.SelBgColor = gocui.ColorCyan
		v.SelFgColor = gocui.ColorBlack
	}

	g.SetCurrentView("content")

	return nil
}

func quit(g *gocui.Gui, v *gocui.View) error {
	return gocui.ErrQuit
}

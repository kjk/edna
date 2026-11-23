package server

import (
	"context"
	"fmt"
	"os"
	"os/exec"

	"github.com/kjk/common/log"
	"github.com/kjk/common/u"
)

var (
	e          = fmt.Errorf
	must       = u.Must
	panicIf    = u.PanicIf
	isWinOrMac = u.IsWinOrMac
	logf       = log.Logf
	logErrorf  = log.Errorf
)

func ctx() context.Context {
	return context.Background()
}

// startLoggedInDir starts a command in dir, with output going to our
// stdout / stderr (like u.RunLoggedInDir but doesn't wait). Returns a
// function that kills it
func startLoggedInDir(dir string, exe string, args ...string) (func(), error) {
	cmd := exec.Command(exe, args...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	logf("running: %s in dir '%s'\n", cmd.String(), cmd.Dir)
	err := cmd.Start()
	if err != nil {
		return nil, err
	}
	return func() {
		cmd.Process.Kill()
	}, nil
}

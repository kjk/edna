package server

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"os/exec"

	"github.com/kjk/common/u"
)

var (
	e          = fmt.Errorf
	must       = u.Must
	panicIf    = u.PanicIf
	isWinOrMac = u.IsWinOrMac
)

func ctx() context.Context {
	return context.Background()
}

// func push[S ~[]E, E any](s *S, els ...E) {
// 	*s = append(*s, els...)
// }

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

func printFS(fsys fs.FS) {
	logf("printFS('%v')\n", fsys)
	dfs := fsys.(fs.ReadDirFS)
	nFiles := 0
	u.IterReadDirFS(dfs, ".", func(filePath string, d fs.DirEntry) error {
		logf("%s\n", filePath)
		nFiles++
		return nil
	})
	logf("%d files\n", nFiles)
	panicIf(nFiles == 0)
}

func runLoggedInDir(dir string, exe string, args ...string) error {
	cmd := exec.Command(exe, args...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	logf("running: %s in dir '%s'\n", cmd.String(), cmd.Dir)
	err := cmd.Run()
	return err
}

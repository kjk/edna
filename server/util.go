package server

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strconv"
	"strings"
	"syscall"

	"github.com/kjk/common/u"
)

var (
	f          = fmt.Sprintf
	e          = fmt.Errorf
	must       = u.Must
	panicIf    = u.PanicIf
	panicIfErr = u.PanicIfErr
	isWinOrMac = u.IsWinOrMac
	formatSize = u.FormatSize
)

func ctx() context.Context {
	return context.Background()
}

func push[S ~[]E, E any](s *S, els ...E) {
	*s = append(*s, els...)
}

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

func waitForSigIntOrKill() {
	// Ctrl-C sends SIGINT
	sctx, stop := signal.NotifyContext(ctx(), os.Interrupt /*SIGINT*/, os.Kill /* SIGKILL */, syscall.SIGTERM)
	defer stop()
	<-sctx.Done()
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

func updateGoDeps(noProxy bool) {
	{
		cmd := exec.Command("go", "get", "-u", ".")
		cmd.Dir = "."
		if noProxy {
			cmd.Env = append(os.Environ(), "GOPROXY=direct")
		}
		logf("running: %s in dir '%s'\n", cmd.String(), cmd.Dir)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		err := cmd.Run()
		panicIf(err != nil, "go get failed with '%s'", err)
	}
	{
		cmd := exec.Command("go", "mod", "tidy")
		cmd.Dir = "."
		logf("running: %s in dir '%s'\n", cmd.String(), cmd.Dir)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		err := cmd.Run()
		panicIf(err != nil, "go get failed with '%s'", err)
	}
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

func getCallstackFrames(skip int) []string {
	var callers [32]uintptr
	n := runtime.Callers(skip+1, callers[:])
	frames := runtime.CallersFrames(callers[:n])
	var cs []string
	for {
		frame, more := frames.Next()
		if !more {
			break
		}
		s := frame.File + ":" + strconv.Itoa(frame.Line)
		cs = append(cs, s)
	}
	return cs
}

func getCallstack(skip int) string {
	frames := getCallstackFrames(skip + 1)
	return strings.Join(frames, "\n")
}

// given map[string]any, return a given key if it exists
// and is a string. Otherwise return empty string.
func mapStr(m map[string]any, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

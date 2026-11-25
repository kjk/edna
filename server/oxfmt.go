package server

import (
	"bytes"
	"context"
	_ "embed"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"sync/atomic"
	"time"
)

//go:embed Dockerfile.oxfmt
var oxfmtDockerfile []byte

const (
	oxfmtImage    = "localhost/edna:oxfmt"
	maxFormatSize = 1 << 20
	formatTimeout = 20 * time.Second
)

var (
	oxfmtReady   atomic.Bool
	formatSlots  = make(chan struct{}, 4)
	formatOrigin = http.NewCrossOriginProtection()
)

func initOxfmt() {
	if _, err := exec.LookPath("podman"); err != nil {
		logf("initOxfmt: podman not found in PATH, formatter disabled\n")
		return
	}
	go func() {
		if err := buildOxfmtImage(); err != nil {
			logf("initOxfmt: %v\n", err)
			return
		}
		oxfmtReady.Store(true)
		logf("initOxfmt: %s image ready\n", oxfmtImage)
	}()
}

func buildOxfmtImage() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	if runtime.GOOS == "windows" || runtime.GOOS == "darwin" {
		// Podman runs in a VM on desktop. "machine start" also returns an error
		// if the VM is already running, so let the build check availability.
		_ = exec.CommandContext(ctx, "podman", "machine", "start").Run()
	}

	dir, err := os.MkdirTemp("", "edna-oxfmt-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)
	if err := os.WriteFile(filepath.Join(dir, "Dockerfile"), oxfmtDockerfile, 0600); err != nil {
		return err
	}
	cmd := exec.CommandContext(ctx, "podman", "build", "-t", oxfmtImage, dir)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("podman build: %w\n%s", err, output)
	}
	return nil
}

func supportsFormatType(fileType string) bool {
	switch fileType {
	case "js", "jsx", "ts", "tsx", "json", "css", "html", "md", "yaml":
		return true
	default:
		return false
	}
}

// POST /api/format?type=js&tabWidth=2&useTabs=false
func handleFormat(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodPost) {
		return
	}
	if err := formatOrigin.Check(r); err != nil {
		http.Error(w, "Cross-origin formatting is forbidden", http.StatusForbidden)
		return
	}
	params := r.URL.Query()
	fileType := params.Get("type")
	if !supportsFormatType(fileType) {
		http.Error(w, "Unsupported format type", http.StatusBadRequest)
		return
	}
	tabWidth, useTabs := params.Get("tabWidth"), params.Get("useTabs")
	if tabWidth == "" {
		tabWidth = "2"
	}
	if useTabs == "" {
		useTabs = "false"
	}
	width, err := strconv.Atoi(tabWidth)
	if err != nil || width < 1 || width > 8 || (useTabs != "true" && useTabs != "false") {
		http.Error(w, "Invalid indentation settings", http.StatusBadRequest)
		return
	}
	if !oxfmtReady.Load() {
		http.Error(w, "Formatter unavailable", http.StatusServiceUnavailable)
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxFormatSize))
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			http.Error(w, "Source exceeds the formatter size limit", http.StatusRequestEntityTooLarge)
			return
		}
		http.Error(w, "Failed to read source", http.StatusBadRequest)
		return
	}
	select {
	case formatSlots <- struct{}{}:
		defer func() { <-formatSlots }()
	default:
		http.Error(w, "Formatter busy", http.StatusServiceUnavailable)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), formatTimeout)
	defer cancel()

	// The container time limit also applies if the Podman client is killed.
	cmd := exec.CommandContext(ctx, "podman", "run", "--rm", "-i", "--pull=never",
		"--network=none", "--memory=256m", "--cpus=1", "--pids-limit=64",
		"--cap-drop=ALL", "--security-opt=no-new-privileges", "--read-only",
		"--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=1m,mode=1777", "--user=65534",
		"--timeout="+strconv.Itoa(int(formatTimeout/time.Second)),
		oxfmtImage, "file."+fileType, strconv.Itoa(width), useTabs)
	cmd.Stdin = bytes.NewReader(body)
	formatted, err := cmd.Output()
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			http.Error(w, "Formatting timed out", http.StatusGatewayTimeout)
			return
		}
		http.Error(w, "Failed to format source", http.StatusUnprocessableEntity)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write(formatted)
}

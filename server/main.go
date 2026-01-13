package server

import (
	"flag"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kjk/common/u"
)

var (
	dataDirCached = ""
)

func getDataDirMust() string {
	if dataDirCached != "" {
		return dataDirCached
	}

	dataDirCached = "data"
	if flgRunProd && u.IsLinux() {
		dataDirCached = "/home/data/" + projectName
	}
	err := os.MkdirAll(dataDirCached, 0755)
	must(err)

	return dataDirCached
}

func getLogsDirMust() string {
	res := filepath.Join(getDataDirMust(), "logs")
	err := os.MkdirAll(res, 0755)
	must(err)
	return res
}

func getSecrets() []byte {
	// in production deployment secrets are embedded in binary as secretsEnv
	if len(secretsEnv) > 0 {
		logf("getSecrets(): using secrets from embedded secretsEnv of length %d\n", len(secretsEnv))
		return secretsEnv
	}
	panicIf(flgRunProd && !isWinOrMac(), "when running with -run-prod on Linux must have secrets embedded in the binary")

	// when running non-prod we try to read secrets from secrets repo
	// secrets file only exists on my laptop so it's ok if read fails
	// this could be because someone else is running or me on codespaces/gitpod etc.
	d, err := os.ReadFile(secretsSrcPath)
	if err == nil && len(d) > 0 {
		logf("getSecrets(): using secrets from %s of size %d\n", secretsSrcPath, len(d))
		return d
	}
	logf("Warning: secrets not found")
	return nil
}

func loadSecrets() {
	d := getSecrets()
	m := u.ParseEnvMust(d)
	logf("loadSecret: got %d secrets\n", len(m))
	getEnv := func(key string, val *string, minLen int, must bool) {
		v := strings.TrimSpace(m[key])
		if len(v) < minLen {
			panicIf(must, "missing %s, len: %d, wanted: %d\n", key, len(v), minLen)
			logf("missing %s, len: %d, wanted: %d\n", key, len(v), minLen)
			return
		}
		*val = v
		if isDevOrLocal() {
			logf("Got %s='%s'\n", key, v)
		} else {
			logf("Got %s\n", key)
		}
	}
	getEnv("MAILGUN_DOMAIN", &mailgunDomain, 4, false)
	getEnv("MAILGUN_API_KEY", &mailgunAPIKey, 32, false)
	getEnv("GITHUB_SECRET_PROD", &secretGitHub, 40, true)
	if isDevOrLocal() {
		getEnv("GITHUB_SECRET_LOCAL", &secretGitHub, 40, true)
	}
}

var (
	// assets being served on-demand by vite
	flgRunDev bool
	// compiled assets embedded in the binary
	flgRunProd bool
)

func isDevOrLocal() bool {
	return flgRunDev || isWinOrMac()
}

func measureDuration() func() {
	timeStart := time.Now()
	return func() {
		logf("took %s\n", time.Since(timeStart))
	}
}

func clean() {
	emptyFrontEndBuildDir()
	must(os.RemoveAll("node_modules"))
	for _, f := range []string{"bun.lockb", "bun.lock", "package-lock.json", "yarn.lock"} {
		os.Remove(f)
	}
}

func Main() {
	var (
		flgDeployHetzner bool
		flgSetupAndRun   bool
		flgGen           bool
	)
	flag.BoolVar(&flgRunDev, "run-dev", false, "run the server in dev mode")
	flag.BoolVar(&flgRunProd, "run-prod", false, "run server in production")
	flag.BoolVar(&flgDeployHetzner, "deploy", false, "deploy to hetzner")
	flag.BoolVar(&flgSetupAndRun, "setup-and-run", false, "setup and run on the server")
	flag.BoolVar(&flgGen, "gen", false, "generate code (ai models)")
	flag.Parse()

	// for ad-hoc testing
	if true {
	} else {
		adHocTestOpenStore()
		rebuildFrontend()
		// make those reachable to avoid dead code warnings
		adHocTestGetNotes()
		adHocTestOpenStore()
		adHocGetZipWithPutRecordsTest()
		adHocTestReplyZip()
		adHocTestOpenStore()
		adHocTestReplayBrowserStoreZip()
		adHocTestRunServerProd()
		adHocTestReplayBrowserStoreZip()
		clean()
		return
	}

	if flgGen {
		path := filepath.Join("src", "gen.mjs")
		u.RunLoggedInDirMust(".", "bun", "run", path)
		return
	}

	if flgDeployHetzner {
		defer measureDuration()()
		deployToHetzner()
		return
	}

	if GitCommitHash != "" {
		uriBase := "https://github.com/kjk/elaris/commit/"
		logf("elaris.arslexis.io, build: %s (%s)\n", GitCommitHash, uriBase+GitCommitHash)
	}

	if flgSetupAndRun {
		defer measureDuration()()
		setupAndRun()
		return
	}

	loadSecrets()

	if flgRunDev {
		setupLogging()
		defer closeLogging()

		runServerDev()
		return
	}

	if flgRunProd {
		setupLogging()
		defer closeLogging()

		runServerProd()
		return
	}

	flag.Usage()
}

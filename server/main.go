package server

import (
	"flag"
	"os"
	"path/filepath"
	"time"

	"github.com/dustin/go-humanize"

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

// minimum amount of secrets that allows for running in dev mode
// if some secrets are missing, the related functionality will be disabled
// (e.g. sending mails or github loging)
// you can put your own secrets here
const secretsDev = `# secrets for dev mode
# COOKIE_AUTH_KEY=baa18ad1db89a7e9fbb50638815be63150a4494ac465779ee2f30bc980f1a55e
# COOKIE_ENCR_KEY=2780ffc17eec2d85960473c407ee37c0249db93e4586ec52e3ef9e153ba61e72
`

func getSecrets() []byte {
	// in production deployment secrets are embedded in binary as secretsEnv
	if len(secretsEnv) > 0 {
		logf("getSecrets(): using secrets from embedded secretsEnv of length %d\n", len(secretsEnv))
		return secretsEnv
	}
	//panicIf(flgRunProd, "when running in production must have secrets embedded in the binary")

	// when running non-prod we try to read secrets from secrets repo
	// secrets file only exists on my laptop so it's ok if read fails
	// this could be because someone else is running or me on codespaces/gitpod etc.
	d, err := os.ReadFile(secretsSrcPath)
	if err == nil && len(d) > 0 {
		logf("getSecrets(): using secrets from %s of size %d\n", secretsSrcPath, len(d))
		return d
	}
	// we fallback to minimum amount of secrets from secretsDev
	logf("getSecrets(): using minimal dev secrets from secretsDev of length %d\n", len(secretsDev))
	return []byte(secretsDev)
}

func loadSecrets() {
	d := getSecrets()
	m := u.ParseEnvMust(d)
	logf("loadSecret: got %d secrets\n", len(m))
	// getEnv := func(key string, val *string, minLen int, must bool) {
	// 	v := strings.TrimSpace(m[key])
	// 	if len(v) < minLen {
	// 		panicIf(must, "missing %s, len: %d, wanted: %d\n", key, len(v), minLen)
	// 		logf("missing %s, len: %d, wanted: %d\n", key, len(v), minLen)
	// 		return
	// 	}
	// 	*val = v
	// 	if isDev() {
	// 		logf("Got %s='%s'\n", key, v)
	// 	} else {
	// 		logf("Got %s\n", key)
	// 	}
	// }
	// those we need always
	// must := false
	// // getEnv("COOKIE_AUTH_KEY", &cookieAuthKeyHex, 64, must)
	// // getEnv("COOKIE_ENCR_KEY", &cookieEncrKeyHex, 64, must)

	// // those are only required in prod
	// getEnv("GITHUB_SECRET_ONLINETOOL", &secretGitHubOnlineTool, 40, must)
	// getEnv("GITHUB_SECRET_TOOLS_ARSLEXIS", &secretGitHubToolsArslexis, 40, must)
	// getEnv("GITHUB_SECRET_LOCAL", &secretGitHubLocal, 40, must)
	// getEnv("MAILGUN_DOMAIN", &mailgunDomain, 4, must)
	// getEnv("MAILGUN_API_KEY", &mailgunAPIKey, 32, must)
}

var (
	// assets being served on-demand by vite
	flgRunDev bool
	// compiled assets embedded in the binary
	flgRunProd bool
)

func isDev() bool {
	return flgRunDev
}

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
		flgBuildFrontend bool
	)
	{
		flag.BoolVar(&flgRunDev, "run-dev", false, "run the server in dev mode")
		flag.BoolVar(&flgBuildFrontend, "build-frontend", false, "build frontend assets")
		flag.BoolVar(&flgRunProd, "run-prod", false, "run server in production")
		flag.BoolVar(&flgDeployHetzner, "deploy", false, "deploy to hetzner")
		flag.BoolVar(&flgSetupAndRun, "setup-and-run", false, "setup and run on the server")
		flag.BoolVar(&flgGen, "gen", false, "generate code")
		flag.Parse()
	}

	if false { // ad-hoc code
		if true {
			testRunServerProd()
		} else {
			// make it reachable for compilation
			clean()
			updateGoDeps(true)
		}
		return
	}

	if flgGen {
		path := filepath.Join("src", "gen.mjs")
		u.RunLoggedInDirMust(".", "bun", "run", path)
		return
	}

	if GitCommitHash != "" {
		uriBase := "https://github.com/kjk/edna/commit/"
		logf("edna.arslexis.io, build: %s (%s)\n", GitCommitHash, uriBase+GitCommitHash)
	}

	if flgDeployHetzner {
		defer measureDuration()()
		deployToHetzner()
		return
	}

	if flgSetupAndRun {
		defer measureDuration()()
		setupAndRun()
		return
	}

	if flgBuildFrontend {
		defer measureDuration()()
		rebuildFrontend()
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

type benchResult struct {
	name string
	data []byte
	dur  time.Duration
}

func humanSize(n int) string {
	un := uint64(n)
	return humanize.Bytes(un)
}

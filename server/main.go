package main

import (
	"bytes"
	"flag"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/andybalholm/brotli"
	"github.com/dustin/go-humanize"
	"github.com/kjk/common/logtastic"
	"github.com/klauspost/compress/gzip"
	"github.com/klauspost/compress/zstd"

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
	getEnv := func(key string, val *string, minLen int, must bool) {
		v := strings.TrimSpace(m[key])
		if len(v) < minLen {
			panicIf(must, "missing %s, len: %d, wanted: %d\n", key, len(v), minLen)
			logf("missing %s, len: %d, wanted: %d\n", key, len(v), minLen)
			return
		}
		*val = v
		if isDev() {
			logf("Got %s='%s'\n", key, v)
		} else {
			logf("Got %s\n", key)
		}
	}
	// those we need always
	must := false
	// // getEnv("COOKIE_AUTH_KEY", &cookieAuthKeyHex, 64, must)
	// // getEnv("COOKIE_ENCR_KEY", &cookieEncrKeyHex, 64, must)

	// // those are only required in prod
	getEnv("LOGTASTIC_API_KEY", &logtastic.ApiKey, 30, must)
	// getEnv("PIRSCH_SECRET", &pirschClientSecret, 64, must)
	// getEnv("GITHUB_SECRET_ONLINETOOL", &secretGitHubOnlineTool, 40, must)
	// getEnv("GITHUB_SECRET_TOOLS_ARSLEXIS", &secretGitHubToolsArslexis, 40, must)
	// getEnv("GITHUB_SECRET_LOCAL", &secretGitHubLocal, 40, must)
	// getEnv("MAILGUN_DOMAIN", &mailgunDomain, 4, must)
	// getEnv("MAILGUN_API_KEY", &mailgunAPIKey, 32, must)

	// // when running locally we shouldn't send axiom / pirsch
	// if isDev() || flgRunProdLocal {
	// 	axiomApiToken = ""
	// 	pirschClientSecret = ""
	// }

	// when running locally, don't
	if false && flgRunDev || flgRunProdLocal {
		logfLocal("loadSecrets: clearing logtasticApiKey\n")
		logtastic.ApiKey = ""
	}
}

var (
	// assets being served on-demand by vite
	flgRunDev bool
	// compiled assets embedded in the binary
	flgRunProd bool
	// compiled assets served from server/dist directory
	// mostly for testing that the assets are correctly built
	flgRunProdLocal bool
)

func isDev() bool {
	return flgRunDev
}

func measureDuration() func() {
	timeStart := time.Now()
	return func() {
		logf("took %s\n", time.Since(timeStart))
	}
}

func main() {
	var (
		flgDeployHetzner  bool
		flgSetupAndRun    bool
		flgBuildLocalProd bool
		flgBuildFrontend  bool
		flgUpdateGoDeps   bool
		flgGen            bool
		flgAdHoc          bool
		flgClean          bool
	)
	{
		flag.BoolVar(&flgRunDev, "run-dev", false, "run the server in dev mode")
		flag.BoolVar(&flgRunProd, "run-prod", false, "run server in production")
		flag.BoolVar(&flgRunProdLocal, "run-local-prod", false, "run server in production but locally")
		flag.BoolVar(&flgDeployHetzner, "deploy-hetzner", false, "deploy to hetzner")
		flag.BoolVar(&flgBuildLocalProd, "build-local-prod", false, "build for production run locally")
		flag.BoolVar(&flgBuildFrontend, "build-frontend", false, "build frontend code")
		flag.BoolVar(&flgSetupAndRun, "setup-and-run", false, "setup and run on the server")
		flag.BoolVar(&flgUpdateGoDeps, "update-go-deps", false, "update go dependencies")
		flag.BoolVar(&flgGen, "gen", false, "generate code")
		flag.BoolVar(&flgAdHoc, "ad-hoc", false, "run ad-hoc code")
		flag.BoolVar(&flgClean, "clean", false, "remove all files")
		flag.Parse()
	}

	if flgAdHoc {
		testCompress()
		return
	}

	if flgClean {
		emptyFrontEndBuildDir()
		must(os.RemoveAll("node_modules"))
		for _, f := range []string{"bun.lockb", "bun.lock", "package-lock.json", "yarn.lock"} {
			os.Remove(f)
		}
		return
	}

	if flgGen {
		if hasBun() {
			path := filepath.Join("src", "gen.mjs")
			u.RunLoggedInDirMust(".", "bun", "run", path)
		} else {
			runLoggedInDir(".", "npm", "run", "gen")
		}
		return
	}

	if GitCommitHash != "" {
		uriBase := "https://github.com/kjk/edna/commit/"
		logf("edna.arslexis.io, build: %s (%s)\n", GitCommitHash, uriBase+GitCommitHash)
	}

	if flgUpdateGoDeps {
		defer measureDuration()()
		updateGoDeps(true)
		return
	}

	if flgBuildFrontend {
		defer measureDuration()()
		rebuildFrontend()
		return
	}

	if flgBuildLocalProd {
		defer measureDuration()()
		buildForProdLocal()
		emptyFrontEndBuildDir()
		return
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

	n := 0
	if flgRunDev {
		n++
	}
	if flgRunProdLocal {
		n++
	}
	if flgRunProd {
		n++
	}
	if n == 0 {
		flag.Usage()
		return
	}
	panicIf(n > 1, "can only use one of: -run-dev, -run-prod, -run-local-prod")

	loadSecrets()
	if logtastic.ApiKey != "" {
		logtastic.BuildHash = GitCommitHash
		logtastic.LogDir = getLogsDirMust()
		if flgRunProd {
			logtastic.Server = "l.arslexis.io"
		} else {
			logtastic.Server = "127.0.0.1:9327"
		}
		logf("logtatistic server: %s\n", logtastic.Server)
	}

	if flgRunDev {
		runServerDev()
		return
	}

	if flgRunProd {
		runServerProd()
		return
	}

	if flgRunProdLocal {
		runServerProdLocal()
		return
	}

	flag.Usage()
}

type benchResult struct {
	name string
	data []byte
	dur  time.Duration
}

func benchFileCompress(path string) {
	d, err := os.ReadFile(path)
	panicIfErr(err)

	var results []benchResult
	gzipCompress := func(d []byte) []byte {
		var buf bytes.Buffer
		w, err := gzip.NewWriterLevel(&buf, gzip.BestCompression)
		panicIfErr(err)
		_, err = w.Write(d)
		panicIfErr(err)
		err = w.Close()
		panicIfErr(err)
		return buf.Bytes()
	}

	zstdCompress := func(d []byte, level zstd.EncoderLevel) []byte {
		var buf bytes.Buffer
		w, err := zstd.NewWriter(&buf, zstd.WithEncoderLevel(level), zstd.WithEncoderConcurrency(1))
		panicIfErr(err)
		_, err = w.Write(d)
		panicIfErr(err)
		err = w.Close()
		panicIfErr(err)
		return buf.Bytes()
	}

	brCompress := func(d []byte, level int) []byte {
		var dst bytes.Buffer
		w := brotli.NewWriterLevel(&dst, level)
		_, err := w.Write(d)
		panicIfErr(err)
		err = w.Close()
		panicIfErr(err)
		return dst.Bytes()
	}

	var cd []byte
	logf("compressing with gzip\n")
	t := time.Now()
	cd = gzipCompress(d)
	push(&results, benchResult{"gzip", cd, time.Since(t)})

	logf("compressing with brotli: default (level 6)\n")
	t = time.Now()
	cd = brCompress(d, brotli.DefaultCompression)
	push(&results, benchResult{"brotli default", cd, time.Since(t)})

	logf("compressing with brotli: best (level 11)\n")
	t = time.Now()
	cd = brCompress(d, brotli.BestCompression)
	push(&results, benchResult{"brotli best", cd, time.Since(t)})

	logf("compressing with zstd level: better (3)\n")
	t = time.Now()
	cd = zstdCompress(d, zstd.SpeedBetterCompression)
	push(&results, benchResult{"zstd better", cd, time.Since(t)})

	logf("compressing with zstd level: best (4)\n")
	t = time.Now()
	cd = zstdCompress(d, zstd.SpeedBestCompression)
	push(&results, benchResult{"zstd best", cd, time.Since(t)})

	for _, r := range results {
		logf("%14s: %6d (%s) in %s\n", r.name, len(r.data), humanSize(len(r.data)), r.dur)
	}
}

func humanSize(n int) string {
	un := uint64(n)
	return humanize.Bytes(un)
}

func testCompress() {
	logf("testCompress()\n")
	rebuildFrontend()
	if hasBun() {
		u.RunLoggedInDirMust(".", "bun", "run", "build")
	} else if u.IsWindows() {
		u.RunLoggedInDirMust(".", "npm", "build")
	}

	dir := filepath.Join("src", "dist", "assets")
	files, err := os.ReadDir(dir)
	panicIfErr(err)
	var e fs.DirEntry
	for _, f := range files {
		if strings.HasPrefix(f.Name(), "index-") && strings.HasSuffix(f.Name(), ".js") {
			e = f
			break
		}
	}

	info, _ := e.Info()
	logf("found %s of size %d (%s)\n", e.Name(), info.Size(), humanSize(int(info.Size())))
	path := filepath.Join(dir, e.Name())
	benchFileCompress(path)
}

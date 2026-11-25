package server

import (
	"flag"
	"io/fs"
	"os"
	"path/filepath"
	"time"

	"github.com/kjk/common/deploy"
	"github.com/kjk/common/log"
	"github.com/kjk/common/u"
)

func NewDeployConfig() *deploy.Config {
	c := &deploy.Config{
		ProjectName:               "edna",
		Domain:                    "edna.arslexis.io",
		HTTPPort:                  9325,
		FrontEndBuildDir:          "dist",
		ServerUser:                "root",
		ServerIP:                  "138.201.51.123",
		PrivateKeyPath:            "~/.ssh/hetzner_ed",
		CaddyConfigPath:           "/etc/caddy/Caddyfile",
		RebuildFrontEndMust:       rebuildFrontend,
		EmptyFrontEndBuildDirMust: emptyFrontEndBuildDir,
	}
	deploy.InitializeDeployConfig(c)
	return c
}

func emptyFrontEndBuildDir(c *deploy.Config) {
	os.RemoveAll(c.FrontEndBuildDir)
	u.WriteToFile(filepath.Join(c.FrontEndBuildDir, "gitkeep.txt"), "don't delete this folder\n")
}

func rebuildFrontend(c *deploy.Config) {
	// assuming this is not deployment: re-build the frontend
	emptyFrontEndBuildDir(c)
	logf("deleted frontend dist dir '%s'\n", c.FrontEndBuildDir)
	// --frozen-lockfile: install exactly what's in bun.lock (fails if package.json and bun.lock are out of sync)
	u.RunLoggedInDirMust(".", "bun", "install", "--frozen-lockfile")
	u.RunLoggedInDirMust(".", "bun", "run", "build")
}

func getLogsDirMust(projectName string, prod bool) string {
	dir := "data"
	if prod && u.IsLinux() {
		dir = filepath.Join("/home/data", projectName)
	}
	res := filepath.Join(dir, "logs")
	err := os.MkdirAll(res, 0755)
	must(err)
	return res
}

func measureDuration() func() {
	timeStart := time.Now()
	return func() {
		logf("took %s\n", time.Since(timeStart))
	}
}

func Main(distFS fs.ReadDirFS, gitCommitHash string) {
	var (
		flgRunDev        bool
		flgRunProd       bool
		flgDeployHetzner bool
		flgSetupAndRun   bool
		flgGen           bool
	)
	{
		flag.BoolVar(&flgRunDev, "run-dev", false, "run the server in dev mode")
		flag.BoolVar(&flgRunProd, "run-prod", false, "run server in production")
		flag.BoolVar(&flgDeployHetzner, "deploy", false, "deploy to hetzner")
		flag.BoolVar(&flgSetupAndRun, "setup-and-run", false, "setup and run on the server")
		flag.BoolVar(&flgGen, "gen", false, "generate code")
		flag.Parse()
	}

	if flgGen {
		path := filepath.Join("src", "gen.ts")
		u.RunLoggedInDirMust(".", "bun", "run", path)
		return
	}

	if gitCommitHash != "" {
		uriBase := "https://github.com/kjk/edna/commit/"
		logf("edna.arslexis.io, build: %s (%s)\n", gitCommitHash, uriBase+gitCommitHash)
	}
	deployConfig := NewDeployConfig()

	// runs a deploy step and logs how long it took
	timed := func(step func()) {
		defer measureDuration()()
		step()
	}

	if flgDeployHetzner {
		timed(func() { deploy.ToHetzner(deployConfig) })
		return
	}

	if flgSetupAndRun {
		timed(func() { deploy.SetupOnServerAndRun(deployConfig) })
		return
	}

	// runs the server with logging to files
	withLog := func(runServer func()) {
		logConfig := log.Config{
			Dir: getLogsDirMust(deployConfig.ProjectName, flgRunProd),
		}
		log.Init(&logConfig)
		defer log.Close()
		initOxfmt()
		runServer()
	}

	if flgRunDev {
		withLog(func() { runServerDev(deployConfig.HTTPPort) })
		return
	}

	if flgRunProd {
		withLog(func() { runServerProd(deployConfig.HTTPPort, distFS) })
		return
	}

	flag.Usage()
}

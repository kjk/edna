package server

import (
	"flag"
	"os"
	"path/filepath"
	"time"

	"github.com/kjk/common/deploy"
	"github.com/kjk/common/log"
	"github.com/kjk/common/u"
)

var (
	dataDirCached = ""
	deployConfig  = NewDeployConfig()
	GitCommitHash string // available in production build
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
	{
		must(os.RemoveAll("node_modules"))
		os.Remove("yarn.lock")
		os.Remove("package-lock.json")
		u.RunLoggedInDirMust(".", "bun", "install")
	}
	u.RunLoggedInDirMust(".", "bun", "run", "build")
}

func getDataDirMust() string {
	if dataDirCached != "" {
		return dataDirCached
	}

	dataDirCached = "data"
	if flgRunProd && u.IsLinux() {
		dataDirCached = "/home/data/" + deployConfig.ProjectName
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

func Main() {
	var (
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

	if false { // ad-hoc code
		if true {
		} else {
			// make it reachable for compilation
		}
		return
	}

	if flgGen {
		path := filepath.Join("src", "gen.t")
		u.RunLoggedInDirMust(".", "bun", "run", path)
		return
	}

	if GitCommitHash != "" {
		uriBase := "https://github.com/kjk/edna/commit/"
		logf("edna.arslexis.io, build: %s (%s)\n", GitCommitHash, uriBase+GitCommitHash)
	}

	if flgDeployHetzner {
		defer measureDuration()()
		deploy.ToHetzner(deployConfig)
		return
	}

	if flgSetupAndRun {
		defer measureDuration()()
		deploy.SetupOnServerAndRun(deployConfig)
		return
	}

	logConfig := log.Config{
		Dir: getLogsDirMust(),
	}

	if flgRunDev {
		log.Init(&logConfig)
		defer log.Close()

		runServerDev()
		return
	}

	if flgRunProd {
		log.Init(&logConfig)
		defer log.Close()

		runServerProd()
		return
	}

	flag.Usage()
}

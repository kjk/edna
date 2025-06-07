package main

import (
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/kjk/common/u"
	"github.com/melbahja/goph"
	"github.com/pkg/sftp"
)

// variables to customize
var (
	projectName       = "edna"
	domain            = "edna.arslexis.io"
	httpPort          = 9325
	frontEndBuildDir  = filepath.Join("server", "dist")
	wantedProdSecrets = []string{"LOGTASTIC_API_KEY"}
)

// stuff that is derived from the above
var (
	secretsSrcPath = filepath.Join("..", "secrets", projectName+".env")
	secretsPath    = filepath.Join("server", "secrets.env")

	deployServerDir             = "/root/apps/" + projectName
	deployServerUser            = "root"
	deployServerIP              = "138.201.51.123"
	deployServerPrivateKeyPath  = "~/.ssh/hetzner_ed"
	deployServerCaddyConfigPath = "/etc/caddy/Caddyfile"

	GitCommitHash string

	caddyConfigDelim = "# ---- " + domain
	caddyConfig      = fmt.Sprintf(`%s {
	reverse_proxy localhost:%v
}`, domain, httpPort)

	systemdRunScriptPath = path.Join(deployServerDir, "systemd-run.sh")

	systemdRunScriptTmpl = `#!/bin/bash
tmux new-session -d -s {sessionName}
tmux send-keys -t {sessionName} "cd {workdDir}" Enter
tmux send-keys -t {sessionName} "./{exeName} -run-prod" Enter
echo "finished running under tmux"
`

	systemdService = fmt.Sprintf(`[Unit]
Description=%s
After=network.target

[Service]
ExecStart=%s
Type=oneshot
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
`, domain, systemdRunScriptPath)

	systemdServicePath     = path.Join(deployServerDir, projectName+".service")
	systemdServicePathLink = fmt.Sprintf("/etc/systemd/system/%s.service", projectName)
)

func writeFileMust(path string, s string, perm fs.FileMode) {
	err := os.WriteFile(path, []byte(s), perm)
	panicIf(err != nil, "os.WriteFile(%s) failed with '%s'", path, err)
	logf("created '%s'\n", path)
}

func sftpFileNotExistsMust(sftp *sftp.Client, path string) {
	_, err := sftp.Stat(path)
	u.PanicIf(err == nil, "file '%s' already exists on the server\n", path)
}

func sftpMkdirAllMust(sftp *sftp.Client, path string) {
	err := sftp.MkdirAll(path)
	panicIf(err != nil, "sftp.MkdirAll('%s') failed with '%s'", path, err)
	logf("created '%s' dir on the server\n", path)
}

func sshRunCommandMust(client *goph.Client, exe string, args ...string) {
	cmd, err := client.Command(exe, args...)
	panicIf(err != nil, "client.Command() failed with '%s'\n", err)
	logf("running '%s' on the server\n", cmd.String())
	out, err := cmd.CombinedOutput()
	logf("%s:\n%s\n", cmd.String(), string(out))
	panicIf(err != nil, "cmd.Output() failed with '%s'\n", err)
}

func copyToServerMaybeGzippedMust(client *goph.Client, sftp *sftp.Client, localPath, remotePath string, gzipped bool) {
	if gzipped {
		remotePath += ".gz"
		sftpFileNotExistsMust(sftp, remotePath)
		u.GzipCompressFile(localPath+".gz", localPath)
		localPath += ".gz"
		defer os.Remove(localPath)
	}
	sizeStr := u.FormatSize(u.FileSize(localPath))
	logf("uploading '%s' (%s) to '%s'", localPath, sizeStr, remotePath)
	timeStart := time.Now()
	err := client.Upload(localPath, remotePath)
	panicIf(err != nil, "\nclient.Upload() failed with '%s'", err)
	logf(" took %s\n", time.Since(timeStart))

	if gzipped {
		// ungzip on the server
		sshRunCommandMust(client, "gzip", "-d", remotePath)
	}
}

func validateSecrets(m map[string]string, wantedSecrets []string) {
	for _, k := range wantedSecrets {
		_, ok := m[k]
		panicIf(!ok, "didn't find secret '%s' in '%s'", k)
	}
}

func createEmptyFile(path string, content string) {
	logf("createEmptyFile: '%s'\n", path)
	must(os.MkdirAll(filepath.Dir(path), 0755))
	os.Remove(path)
	err := os.WriteFile(path, []byte(content), 0644)
	must(err)
}

func emptyFrontEndBuildDir() {
	os.RemoveAll(frontEndBuildDir)
	createEmptyFile(filepath.Join(frontEndBuildDir, "gitkeep.txt"), "don't delete this folder\n")
}

func reinstallPackages() {
	must(os.RemoveAll("node_modules"))
	os.Remove("yarn.lock")
	os.Remove("package-lock.json")
	if hasBun() {
		u.RunLoggedInDirMust(".", "bun", "install")
	} else {
		u.RunLoggedInDirMust(".", "npm", "install")
	}
}

func hasBun() bool {
	_, err := exec.LookPath("bun")
	return err == nil
}

func rebuildFrontend() {
	// assuming this is not deployment: re-build the frontend
	emptyFrontEndBuildDir()
	logf("deleted frontend dist dir '%s'\n", frontEndBuildDir)
	reinstallPackages()
	if hasBun() {
		u.RunLoggedInDirMust(".", "bun", "run", "build")
	} else {
		u.RunLoggedInDirMust(".", "npm", "run", "build")
	}
	// copy files from src\dist => server\dist
	copyFilesRecurMust(filepath.Join("src", "dist"), frontEndBuildDir)
}

// get date and hash of current git checkin
func getGitHashDateMust() (string, string) {
	// git log --pretty=format:"%h %ad %s" --date=short -1
	cmd := exec.Command("git", "log", "-1", `--pretty=format:%h %ad %s`, "--date=short")
	out, err := cmd.Output()
	panicIf(err != nil, "git log failed")
	s := strings.TrimSpace(string(out))
	//logf("exec out: '%s'\n", s)
	parts := strings.SplitN(s, " ", 3)
	panicIf(len(parts) != 3, "expected 3 parts in '%s'", s)
	return parts[0], parts[1] // hashShort, date
}

func buildForProd(forLinux bool) string {
	{
		// delete old builds
		pattern := projectName + "-*"
		files, err := filepath.Glob(pattern)
		must(err)
		for _, path := range files {
			err = os.Remove(path)
			must(err)
			logf("deleted %s\n", path)
		}
	}

	// re-build the frontend. remove build process artifacts
	// to keep things clean
	{
		// copy secrets from ../secrets/${me}.env to server/secrets.env
		// so that it's included in the binary as secretsEnv
		d, err := os.ReadFile(secretsSrcPath)
		must(err)
		m := u.ParseEnvMust(d)
		validateSecrets(m, wantedProdSecrets)
		err = os.WriteFile(secretsPath, d, 0644)
		must(err)
	}
	defer createEmptyFile(secretsPath, "")

	rebuildFrontend()

	hashShort, date := getGitHashDateMust()
	exeName := fmt.Sprintf("%s-%s-%s", projectName, date, hashShort)
	if u.IsWindows() && !forLinux {
		exeName += ".exe"
	}

	// build the binary, for linux if forLinux is true, otherwise for OS arh
	{
		// TODO: why needs ./server and not just "server"?
		// it works in arslexis-website
		ldFlags := f("-X main.GitCommitHash=%s", hashShort)
		cmd := exec.Command("go", "build", "-o", exeName, "-ldflags", ldFlags, "./server")
		if forLinux {
			cmd.Env = os.Environ()
			cmd.Env = append(cmd.Env, "GOOS=linux", "GOARCH=amd64")
		}
		out, err := cmd.CombinedOutput()
		logf("%s:\n%s\n", cmd.String(), out)
		panicIf(err != nil, "go build failed")

		sizeStr := u.FormatSize(u.FileSize(exeName))
		logf("created '%s' of size %s\n", exeName, sizeStr)
	}

	return exeName
}

func buildForProdLocal() string {
	exeName := buildForProd(false)
	exeSize := u.FormatSize(u.FileSize(exeName))
	logf("created:\n%s %s\n", exeName, exeSize)
	return exeName
}

/*
How deploying to hetzner works:
- compile linux binary with name ${app}-YYYY-MM-DD-${hashShort}
- copy binary to hetzner
- run on hetzner
*/
func deployToHetzner() {
	exeName := buildForProd(true)
	panicIf(!u.FileExists(exeName), "file '%s' doesn't exist", exeName)
	emptyFrontEndBuildDir()

	serverExePath := path.Join(deployServerDir, exeName)

	keyPath := u.ExpandTildeInPath(deployServerPrivateKeyPath)
	panicIf(!u.FileExists(keyPath), "key file '%s' doesn't exist", keyPath)
	auth, err := goph.Key(keyPath, "")
	panicIf(err != nil, "goph.Key() failed with '%s'", err)
	client, err := goph.New(deployServerUser, deployServerIP, auth)
	panicIf(err != nil, "goph.New() failed with '%s'", err)
	defer client.Close()

	// global sftp client for multiple operations
	sftp, err := client.NewSftp()
	panicIf(err != nil, "client.NewSftp() failed with '%s'", err)
	defer sftp.Close()

	// check:
	// - caddy is installed
	// - binary doesn't already exists
	{
		_, err = sftp.Stat(deployServerCaddyConfigPath)
		panicIf(err != nil, "sftp.Stat() for '%s' failed with '%s'\nInstall caddy on the server?\n", deployServerCaddyConfigPath, err)

		sftpFileNotExistsMust(sftp, serverExePath)
	}

	// create destination dir on the server
	sftpMkdirAllMust(sftp, deployServerDir)

	// copy binary to the server
	copyToServerMaybeGzippedMust(client, sftp, exeName, serverExePath, true)

	// make the file executable
	{
		err = sftp.Chmod(serverExePath, 0755)
		panicIf(err != nil, "sftp.Chmod() failed with '%s'", err)
		logf("created dir on the server '%s'\n", deployServerDir)
	}

	sshRunCommandMust(client, serverExePath, "-setup-and-run")
	logf("Running on http://%s:%d or https://%s\n", deployServerIP, httpPort, domain)
}

func countFilesInFS(fsys fs.ReadDirFS) int {
	n := 0
	u.IterReadDirFS(fsys, ".", func(filePath string, d fs.DirEntry) error {
		n++
		return nil
	})
	return n
}

func checkHasEmbeddedFiles() {
	nEmbedded := countFilesInFS(wwwFS)
	if nEmbedded < 5 {
		logf("not enough embedded files ('%d')\n", nEmbedded)
		os.Exit(1)
	}
}

func setupAndRun() {
	logf("setupAndRun() for %s\n", projectName)
	checkHasEmbeddedFiles()

	if !u.FileExists(deployServerCaddyConfigPath) {
		logf("%s doesn't exist.\nMust install caddy?\n", deployServerCaddyConfigPath)
		os.Exit(1)
	}

	// kill existing process
	// note: muse use "ps ax" (and not e.g. "pkill") because we don't want to kill ourselves
	{
		out := u.RunMust("ps", "ax")
		lines := strings.Split(out, "\n")
		pidsToKill := []string{}
		for _, l := range lines {
			if len(l) == 0 {
				continue
			}
			parts := strings.Fields(l)
			//parts := strings.SplitN(l, "\t", 5)
			if len(parts) < 5 {
				logf("unexpected line in ps ax: '%s', len(parts)=%d\n", l, len(parts))
				continue
			}
			pid := parts[0]
			name := parts[4]
			if !strings.Contains(name, projectName) {
				//logf("skipping process '%s' pid: '%s'\n", name, pid)
				continue
			}
			logf("MAYBE KILLING process '%s' pid: '%s'\n", name, pid)
			myPid := fmt.Sprintf("%v", os.Getpid())
			if pid == myPid {
				logf("NOT KILLING because it's myself\n")
				// no suicide allowed
				continue
			}
			pidsToKill = append(pidsToKill, pid)
			logf("found process to kill: '%s' pid: '%s'\n", name, pid)
		}
		for _, pid := range pidsToKill {
			u.RunLoggedMust("kill", pid)
		}
		if len(pidsToKill) == 0 {
			logf("no %s* processes to kill\n", projectName)
		}
	}

	ownExeName := filepath.Base(os.Args[0])

	// configure systemd to restart on reboot
	{
		// systemd-run.sh script that will be called by systemd on reboot
		runScript := strings.ReplaceAll(systemdRunScriptTmpl, "{exeName}", ownExeName)
		runScript = strings.ReplaceAll(runScript, "{sessionName}", projectName)
		runScript = strings.ReplaceAll(runScript, "{workdDir}", deployServerDir)
		writeFileMust(systemdRunScriptPath, runScript, 0755)

		// systemd .service file linked from /etc/systemd/system/
		writeFileMust(systemdServicePath, systemdService, 0755)
		os.Remove(systemdServicePathLink)
		err := os.Symlink(systemdServicePath, systemdServicePathLink)
		panicIf(err != nil, "os.Symlink(%s, %s) failed with '%s'", systemdServicePath,
			systemdServicePathLink, err)
		logf("created symlink '%s' to '%s'\n", systemdServicePathLink, systemdServicePath)

		serviceName := projectName + ".service"

		// daemon-reload needed if service file changed
		u.RunLoggedMust("systemctl", "daemon-reload")
		// runLoggedMust("systemctl", "start", serviceName)
		u.RunLoggedMust("systemctl", "enable", serviceName)

		u.RunLoggedMust(systemdRunScriptPath)
	}

	// update and reload caddy config
	didReplace := u.AppendOrReplaceInFileMust(deployServerCaddyConfigPath, caddyConfig, caddyConfigDelim)
	if didReplace {
		u.RunLoggedMust("systemctl", "reload", "caddy")
	}

	// archive previous deploys
	{
		pattern := filepath.Join(deployServerDir, projectName+"-*")
		files, err := filepath.Glob(pattern)
		must(err)
		logf("archiving previous deploys, pattern: '%s', %d files\n", pattern, len(files))
		backupDir := filepath.Join(deployServerDir, "backup")
		for _, file := range files {
			name := filepath.Base(file)
			if name == ownExeName {
				logf("skipping archiving of '%s' (myself)\n", name)
				continue
			}
			backupPath := filepath.Join(backupDir, name)
			err = os.MkdirAll(backupDir, 0755)
			u.PanicIfErr(err, "os.MkdirAll('%s') failed with %s\n", backupDir, err)
			err = os.Rename(file, backupPath)
			u.PanicIfErr(err, "os.Rename('%s', '%s') failed with %s\n", file, backupPath, err)
			logf("moved '%s' to '%s'\n", file, backupPath)
		}
	}
}

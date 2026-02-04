package main

import (
	"edna/server"
	"embed"
)

var (
	//go:embed dist/*
	distFS embed.FS

	// set when building for deploying
	GitCommitHash string
)

func main() {
	server.DistFS = distFS
	server.Main()
}

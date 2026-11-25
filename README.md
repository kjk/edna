# Edna

[Edna](https://edna.arslexis.io) is a note taking app with superpowers.

Integrated AI chat, blocks, markdown, syntax highlighting for 40+ languages (JavaScript, Python, C++, Go, Java, C#, Ruby and more), command palette, programmability.

To learn more, see https://edna.arslexis.io/help

## Compiling and running for yourself

You need Go and [bun](https://bun.sh/)

- `bun install`
- `bun run build`
- `go build -o edna .` (on Windows, `-o edna.exe`)

This generates a stand-alone `edna` binary that can run on Windows desktop, Mac desktop or Linux server.

To run: `./edna -run-prod`

Edna runs on port `9325` so visit http://localhost:9325

Block formatting for languages other than Go requires Podman on the Edna server. Edna builds the Oxfmt image at startup and runs it on demand. On Windows and macOS, initialize a Podman machine before starting Edna.

## Production in docker

### Build

```
docker build -t edna .
```

### Run Production

```
docker run -p 80:9325 edna -run-prod
```

For Oxfmt formatting, run the Edna binary directly on a host with Podman. The Docker image runs Edna without Podman.

## Credits

Edna started as a fork of Heynote but I've added many features since:

- ability to have multiple notes, so that it can be used as a note taking app in addition to being a scratchpad
- made it a web app, with ability to store notes on disk
- note switcher inspired by Notational Velocity (`Ctrl + P` / `⌘ + P`)
- command palette
- context menu
- ability to run JavaScript functions, either to produce output or transform the content of block or selection
- ability to execute Go code blocks

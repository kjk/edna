# Elaris

[Elaris](https://elaris.arslexis.io) is a note taking app with superpowers.

Integrated AI chat, blocks, markdown, syntax highlighting for 40+ languages (JavaScript, Python, C++, Go, Java, C#, Ruby and more), command palette, programmability.

To learn more, see https://elaris.arslexis.io/help

## Compiling and running for yourself

You need Go and [bun](https://bun.sh/)

- `go run . -build-frontend`
- `go build -o elaris .` (on Windows, `-o Elaris.exe`)

This generates a stand-alone `elaris` binary that can run on Windows desktop, Mac desktop or Linux server.

To run: `./elaris -run-prod`

Elaris runs on port `9325` so visit http://localhost:9325'

## Development or production in docker:

### Build

```
docker build -t elaris .
```

### Run Production

```
docker run -p 80:9325 elaris -run-prod
```

### Run development frontend

```
docker run -v ${PWD}/src:/app/src -p 8080:3035 elaris -run-dev
```

## Credits

Elaris started as a fork of Heynote but I've added many features since:

- ability to have multiple notes, so that it can be used as a note taking app in addition to being a scratchpad
- made it a web app, with ability to store notes on disk
- note switcher inspired by Notational Velocity (`Ctrl + P` / `⌘ + P)
- command palette
- context menu
- ability to run JavaScript functions, either to produce output or transform the content of block or selection
- ability to execute Go code blocks

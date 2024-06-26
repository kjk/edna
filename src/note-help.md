# Welcome to Edna

[Edna](https://edna.arslexis.io) is a note taking app for developers and power users. A cross between Obsidian and Notational Velocity.

This is a help note. To switch to a different note, press `Mod + P`.

To see help in HTML, press `Help` at the bottom right or visit https://edna.arslexis.io/help

∞∞∞markdown
# Keyboard shortcuts

{{keyHelp}}

∞∞∞markdown
# Why Edna?

## Notes and blocks

Unique feature of Edna is that a note can be divided into blocks.

Each block has a type: markdown, plain text, math block, JavaScript code, Go code etc.

Use:
* `Mod + L` to assign a type for current block
* `Mod + B` to navigate between blocks
* `Mod + A` and `Delete` to delete block (select block test and delete)

Use [keyboard shortcuts](#keyboard-shortcuts) to create blocks, move between blocks.

## No installation required

Edna is a web-based application but can store notes on disk, like a desktop app (when using Chrome or Edge).

You can use it offline (without network connection) and for desktop-like experince you can install a desktop shortcut.

## Miminalist UI, lots of functionality

UI is optimized for writing. Editor uses most of the space.

To acess more functionality:

- `Mod + Shift + P` for command pallete
- use [keyboard shortcuts](#keyboard-shortcuts))
- context menu (right-click)
- top bar and status bar

## Speed

[Edna](https://edna.arslexis.io) is optimized for speed of writing, creating new notes, switching between notes.

Like in Notational Velocity, you can switch between notes, create and delete notes in the same note switcher UI.

Press `Mod + P` for note switcher and:

- switch between notes
- create new note
- delete a note
- assign a quick access `Alt + <n>` shortcut

## Context menu

Right-click for context menu.

For native context menu do `Ctrl + right-click`. This is especially useful when spell checking to correct mis-spellings.

## Switch to recently opened note

Press `Mod + E` to switch to a note from list of recently opened notes.

Last 10 recently opened notes can be opened with `0` ... `9` shortcut.

To switch to previous note: press `Mod + E` and `Enter`.

## Quick access shortcut

You can assign `Alt + 0` to `Alt + 9` for quickly accessing notes:

- `Mod + P` for note selector dialog
- select a note in the list
- press `Alt + 0` to `Alt + 9` to assign it as quick access shortcut

Default shortcuts are:

- `Alt + 1` : scratch note
- `Alt + 2` : daily journal
- `Alt + 3` : inbox

Notes with quick access shortcut are shown at the top of note selector (`Mod + P`).

## Features for developers

### Syntax highlighting of blocks

Blocks are syntax highlighted based on their type.

### Formatting of blocks

You can format current block using:

- `Alt + Shift + F` keyboard shortcut
- right-click and use context menu `Block / Format as ${type}`
- press format icon in status bar (bottom right)

We support formatting of Go, JSON, JavaScript, HTML, CSS and Markdown blocks.

### Executing of code blocks

We support execution of Go blocks:

- `Alt + Shift + R` keyboard shortcut
- right-click and use context menu `Block / Run`

The output of execution will be shown in a new block created below the executed block.

We have the same capabilities as https://tools.arslexis.io/goplayground/

The code block must be a valid Go program.

∞∞∞markdown
# Multiple notes

## Open another note

- `Mod + P` for note switcher
- click on note to open

or:

- enter text to narrow down list of notes
- `up` / `down` arrow keys to select a note
- `Enter` to open selected note

## Create a new note

- `Mod + P` to open note switcher
- type name of the note to create
- `Enter` to create if the name doesn't match any existing note
- `Mod + Enter` to create if the name partially matches an existing note

Or: right-click for context menu and `Create New note`.

## Create a new scratch note

`Alt + N` to create temporary scratch note. We'll pick a unique name `scratch-<n>`

## Delete a note

Right-click for context menu, `This Note / Delete` or:

- `Mod + P` for note switcher
- select a note with arrow key or by typing a partial name match
- `Mod + Delete` or `Mod + Backspace` to delete selected note

A `scratch` note cannot be deleted.

## Rename a note

Right-click for context menu, `This Note / Rename`

## Quick access shortcut

You can assign `Alt + 0` to `Alt + 9` keyboard shortcuts for quickly opening up to 10 notes.

- `Mod + P`
- select a note
- press `Alt + <n>` shortcut to re-assign it to selected note

Notes with assigned shortcut show up at the top of note switcher.

## Open recent note

Press `Mod + E` to open a note from history. You can press `0` to `9` to open one of the last 10 notes.

∞∞∞markdown
# Default notes

At first run we create 3 default notes:

- `scratch`, `Alt + 1`
- `daily journal`, `Alt + 2`
- `inbox`, `Alt + 3`

You can delete them (except the `scratch` note).

`scratch` note is meant for temporary notes.

`inbox` for storing things to process later e.g. links to YouTube videos to watch later or web pages to read later.

`daily journal` is for daily notes. We auto-create a block for each day.

∞∞∞markdown
# Storing notes on disk

By default notes are stored in the browser (localStorage).

If your browser supports file system access (currently Chrome and Edge) you can store notes on disk.

You can do one time export from localStorage to a directory on disk:

- right click for context menu, `Notes storage / Move notes from browser to directory`
- pick a directory on disk
- we save notes on disk as `${name}.edna.txt` files in chosen directory and delete notes in localStorage

You can have multiple directories with notes. Think of each directory with notes as a separate Workspace.

Use context menu `Notes storage / Open notes in directory` to switch to notes in a different directory. If it's an empty directory, without existing notes, we'll create default `scratch` note.

You can go back to storing notes in the browser with context menu `Notes storage / Open notes in browser (localStorage)`. Unlike going from browser => directory, it doesn't import the notes from directory.

∞∞∞markdown
# Accessing notes on multiple computers

If you pick a directory managed by Dropbox or One Drive or Google Drive etc. then you'll be able to access notes on multiple computers.

On the first computer export notes from browser to disk:

- right click for context menu, `Notes storage / Move notes from browser to directory`
- pick a directory shared by Dropbox / One Drive / Google Drive etc.

On other computers:

- right click for context menu, `Notes storage / Open notes in directory`
- pick the same directory

Please note that that the last written version wins. If you switch really quickly between computers, before the directory with notes has been replicated, you might over-write previous content.

∞∞∞markdown
# Encryption

When storing notes on disk, you can encrypt them with a password.

The password is only stored in your browser (in local storage). It never leaves your computer.

Encryption and decryption takes place on your computer.

If you lose the password, you'll lose access to your notes.

**Don't lose the password**.

Notes are encrypted with [ChaCha20-Poly1305](https://en.wikipedia.org/wiki/ChaCha20-Poly1305) algorithm via [kiss-crypto](https://github.com/team-reflect/kiss-crypto) library.

## Picking good password
Good password is:

- long (short passwords can be cracked via brute force; long passwords cannot)
- easy to type
- easy to remember

We recommend passwords that are long, memorable phrases.

Example: `Blue bear attacked a tiny dog`.

Such passwords are easier to type and remember than typical "8a$7y!glo" passwords.

∞∞∞markdown
# Backing up notes

For notes stored in file system, you can enable notes backup via Settings.

Once a day notes will be packed into a .zip file and saved in `backup` folder as `edna.backup.<YYYY-MM-DD>.zip` file.

Only last 14 backups are stored to save space.

To restore from a backup, unzip files to an empty folder and switch to it via context menu `Notes storage / Open notes in directory`

Encrypted notes are stored in their encrypted form.

∞∞∞markdown
# Exporting notes to a .zip file

Edna files are just text files with `.edna.txt` extension.

You can export all the notes to a .zip file.

Use right-click context menu and `Export notes to zip file` menu.

We pack all the notes into a .zip file and initiate auto-download as `edna.notes.export-YYYY-MM-DD.zip` file to browser's downloads directory.

You can then e.g. restore the notes by unzipping it to a directory and opening that directory in Edna with `Notes storage` / `Switch to notes in a directory` context menu.

∞∞∞markdown
# Lists with TODO items

In Markdown blocks, lists with [x] and [ ] are rendered as checkboxes:

- [ ] Try out Edna
- [ ] Do laundry

∞∞∞math
This is a Math block. Lines are evaluated as math expressions.

radius = 5
area = radius^2 * PI
sqrt(9)

It also supports some basic unit conversions, including currencies:

13 inches in cm
time = 3900 seconds to minutes
time * 2

1 EUR in USD

∞∞∞markdown
# code blocks

∞∞∞javascript
// Edna is great for storing code snippets
// this is a javascript block
// change type of block with `Mod + L`
// you can format it with `Alt + Shift + F`
let x = 5
console.log("x is", x)
∞∞∞markdown
# Privacy and security

Your notes are private and secure.

Notes are stored on your computer: in the browser (local storage) or on disk.

For additional security, you can [encrypt notes](#encryption) with a password.

The code is [open source](https://github.com/kjk/edna) so you can audit it.

∞∞∞markdown
# No lock in

The notes are stored in plain text files on disk (or in localStorage under `note:${name}` key)

Blocks are marked with `\n∞∞∞${type}\n` e.g. `\n∞∞∞markdown\n` marks the beginning of markdown block.

You can edit the notes in any text editor (just be mindful of the above block markers).

You can back them up, store in git repositories, write scripts to process them.

They are not locked in a proprietary Edna format.

∞∞∞markdown
# How I use Edna

Edna is flexible and you should find your own way of using it.

I use Edna daily::

- I use `scratch` note for temporary notes
- I use `daily journal` for keeping track of what I do
- I have `todo` note for keeping track of short term todos
- I have a note for each project I work on
- I have a note for each programming language / technology I use. I keep code snippets and notes about it
- I have `ideas` note for jotting down ideas
- I have `investing` note for keeping track of various stock investment ideas

∞∞∞markdown
# Open source

[Edna](https://edna.arslexis.io) is open source: https://github.com/kjk/edna

To report a bug or request a feature: https://github.com/kjk/edna/issues

∞∞∞markdown
# Contact

You can contact me via https://blog.kowalczyk.info/contactme

You can find more software by [me](https://blog.kowalczyk.info/) on https://arslexis.io

∞∞∞markdown
# Credits

Edna is a fork of [Heynote](https://github.com/heyman/heynote) with the following differences:

- web first (no desktop apps)
- multiple notes
- ability to access notes on multiple devices by storing them on folder managed by Dropbox / One Drive / Google Drive

There's a spirit of Notational Velocity and Simplenote in Edna in how it allows quickly creating notes and switching between them.

Edna is built on [CodeMirror](https://codemirror.net/), [Svelte 5](https://svelte.dev/), [Math.js](https://mathjs.org/), [Prettier](https://prettier.io/).

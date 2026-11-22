# Editor reimplementation on rework

## Scope and comparison

The reference revisions are Edna c66eeab and Heynote c301e42f. The comparison was of the two local src/editor trees. The replacement targets Edna's behavior and saved note format. Heynote's Electron, search panel, image handling and spell checking are outside this project.

| Edna surface | Comparison and decision |
| --- | --- |
| new-parser | Independent multi-block language with its own node set, parser and nesting. Keep it and its golden tests. |
| languages | Both projects register many of the same languages. Preserve the token, display name, file extension, detection ID and formatter support expected by saved notes and menus. Rebuild registry logic. |
| block | Both editors have block extraction, widgets, commands, selection, line movement and math. Edna has its own parser, block offsets, empty-block handling and delimiter protections. Rewrite all runtime modules. |
| Editor and input | Editor construction, setup, keymaps, indentation, clipboard and autosave have counterparts. Edna has Svelte consumers, extra commands and asynchronous save bookkeeping. Keep the facade for those consumers. Rewrite the internals. |
| Presentation and workers | Folding, font and color themes, task markers, links, color swatches, scroll margins and language detection have counterparts. Rewrite the extensions, including the edit-distance routine. |
| Edna glue | Keep NoteLoader, the editor's shared range types and fold length constant. NoteLoader manages Edna note switching. Keep app-level storage, menus and commands. |

## Implementation handoff

Use fresh implementation contexts after the tests run against the intact editor and the runtime modules have been deleted. Work from this document, TypeScript declarations, tests, retained sources, application callers and installed dependency APIs. Exclude the reference checkout, old editor sources, Git history, bundles and source maps. Preserve repository notices and dependency attribution. The worker bundle, math library and other packaged dependencies are separate from the editor modules.

### Document model and editing

- Expose Block with index, language, autoDetect, from, contentFrom and to. Both string and syntax-tree extraction must agree with the retained parser for malformed inputs, unknown tokens and empty blocks. Provide blockState, active/first/last/nth/position/range lookups, content bounds, relative line/column and BlocksInfo. At a shared offset the preceding content owns its end. Coordinates are CodeMirror UTF-16 offsets.
- noteBlockExtension supplies hidden atomic headers, alternating full-width block backgrounds, block-relative numbering, selectionChange status and delimiter protection. User edits preserve the first header. Search replacement protects all headers. Normalize restored/programmatic selections away from hidden bytes. Count characters as users see them across selected blocks (two newlines between blocks).
- Commands insert before/after current or first/last, split at each selection (inherit its language), insertAfterActiveBlock, change language, delete active block and move active block up/down. Insertions use configured defaults except splits. Add-after-current can consume an empty trailing line. Reordering carries the active selection. Deleting the sole block restores an empty default block. Last-block append-and-scroll places the new block at the top.
- gotoBlock, next/previous block and paragraph, and their selecting variants act on each range. Move to the relevant edge of the current block first, then the neighboring block. Paragraphs use blank line boundaries. Shift variants preserve anchors. Add vertical cursors, move/delete selected lines, transpose adjacent characters and select the block then the note on successive Select All presses, including an empty block. Preserve boundaries, undo grouping and read-only mode.

### Editor lifecycle and input

- MultiBlockEditor accepts a mount element, save and dirty callbacks, find panel factory, extra bindings, focus and preferences. Its view, contentGen, diskContent and saveCallback are consumed externally. Preserve get/set content, serialized selections, cursor, folded ranges, blocks, focus, destroy, save, didLoadCurrencies and the settings methods. Emit docChanged and selectionChange with block-relative one-based cursorLine (line, col, length), language, languageAuto and selectionSize.
- Switching notes increments the content generation. Loading is clean and outside undo history. Ignore invalid restored positions and folds crossing headers. Autosave after two idle seconds, flush on teardown, retry after errors and keep dirty if content changes before completion. A late save cannot change bookkeeping for another note. See docs/state-machines.md, M5, M6 and issues U9–U29.
- Preferences can change live without replacing the view. Wire selection drawing, line wrap, history, find, Markdown handling, gutters, bracket closing, multi-cursor editing, tabs and language-dependent indentation. Retain platform-specific shortcuts and extra app shortcuts, Emacs mark mode, clipboard and date/time commands. Tab aligns to the next stop or indents a selection. Markdown selected text also supports wrapping with emphasis/backtick characters.
- Clipboard writes selected fragments or distinct full lines; raw delimiters become blank lines. Cutting a final line preserves the next header. Paste/drop filter complete delimiter lines in context. Multi-cursor paste distributes one line per selection when counts match. Read-only prevents changes. Copy/cut reset Emacs marking and Emacs copy collapses selection.

### Rendering, folding and services

- Fold current/selected/all blocks, unfold blocks or everything, toggle and support syntax folds. Block previews retain at most 50 characters of the first line, show line counts and allow click-to-open. A newly hidden cursor moves to the start of the fold. Editing a folded line reveals it. Creating adjacent blocks, language changes and undo/redo preserve unrelated folds.
- Evaluate math in document order with independent scopes per block, including hidden definitions above the viewport. Carry prev across successful evaluations, honor custom format, suppress invalid results and widgets inside folds, refresh on currency load. Render strings directly, numeric results with eight-digit precision, and copy full precision on click with feedback.
- Render interactive Markdown task markers. Mouse toggle and multi-line/multi-cursor toggle respect read-only. Selection toggling sets a uniform value based on majority (tie checks). Identify HTTP(S) links and open on platform modifier-click. Show validated CSS hex/rgb/hsl swatches only in CSS, HTML, JS/TS including JSX/TSX, Vue and Svelte.
- Support light/dark themes, syntax contrast, alternating block backgrounds, legible gutters, focus, selection, panels, math and link styles. Keep first divider flush and later ones spaced. Honor font preferences including proportional fonts. Keep five lines of scrolling context except near the start of the last block.
- Detect only auto blocks via the existing worker protocol. Changes longer than eight characters and differing by about 10% warrant a guess. Match replies by request and block across intervening edits. Ignore stale notes, deleted blocks, divergent content, manual languages and results that would invalidate redo. Reset a cleared auto block to text. Cancel pending work on disposal.

## Verification

Run the Chromium UI suite against the original behavior before deleting code. Exercise keys, clicks, menus, visible lines, status, folds, checkboxes and note switching. Keep direct contracts where a UI cannot introduce the state (e.g. stale saves, worker replies, malformed persisted offsets and parser parity). Run the same tests after integration, plus node tests, type checks and production build. No deployment is part of the rewrite.

## Module API inventory

These are compatibility names. Internals may be grouped differently.

- `annotation` — `heynoteEvent`, `LANGUAGE_CHANGE`, `CURRENCIES_LOADED`, `SET_CONTENT`, `ADD_NEW_BLOCK`, `MOVE_BLOCK`, `DELETE_BLOCK`, `SET_FONT`, `transactionsHasAnnotation`, `transactionsHasAnnotationsAny`, `transactionsHasHistoryEvent`.
- `block/block-parsing` — `NoteBlock`, `getBlocksFromSyntaxTree`, `getBlocksFromString`.
- `block/block` — `getBlocks`, `blockState`, `getActiveNoteBlock`, `Block`, `blockContent`, `BlocksInfo`, `getBlocksInfo`, `getFirstNoteBlock`, `getLastNoteBlock`, `getBlockN`, `getNoteBlockFromPos`, `getNoteBlocksBetween`, `getNoteBlocksFromRangeSet`, `getBlockLineFromPos`, `blockLineNumbers`, `noteBlockExtension`, `insertAfterActiveBlock`.
- `block/commands` — `getBlockDelimiter`, `defaultBlockDelimiter`, `insertNewBlockAtCursor`, `addNewBlockBeforeCurrent`, `addNewBlockAfterCurrent`, `addNewBlockBeforeFirst`, `addNewBlockAfterLastAndScrollDown`, `addNewBlockAfterLast`, `changeLanguageTo`, `changeCurrentBlockLanguage`, `gotoBlock`, `gotoNextBlock`, `selectNextBlock`, `gotoPreviousBlock`, `selectPreviousBlock`, `gotoNextParagraph`, `selectNextParagraph`, `gotoPreviousParagraph`, `selectPreviousParagraph`, `newCursorBelow`, `newCursorAbove`, `triggerCurrenciesLoaded`, `moveCurrentBlockUp`, `moveCurrentBlockDown`, `deleteBlock`, `moveLineDown`, `moveLineUp`, `selectAll`.
- `block/delete-line` — `deleteLine`.
- `block/math` — `mathBlock`.
- `block/move-lines` — `moveLineUp`, `moveLineDown`.
- `block/select-all` — `emptyBlockSelected`, `selectAll`.
- `block/transpose-chars` — `transposeChars`.
- `cmutils` — `isMac`, `isWindows`, `isReadOnly`, `getCurrentSelection`, `hasSelection`, `focusEditorView`, `getFoldedRanges`.
- `color-preview` — `colorPreviewExtension`.
- `copy-paste` — `removeDelimitersFromPastedText`, `heynoteCopyCut`, `copyCommand`, `cutCommand`, `pasteCommand`.
- `date-time` — `insertDateAndTime`, `insertTime`.
- `editor` — `KeymapSpec`, `MultiBlockEditor`. The facade exposes `destroy`, `save`, `getContent`, `setContent`, `getSelectionJSON`, `setSelection`, `getFoldedRanges`, `setFoldedRanges`, `getBlocks`, `getCursorPosition`, `setCursorPosition`, `focus`, `isReadOnly`, `setReadOnly`, `setFont`, `setTheme`, `setKeymap`, `setLineNumberGutter`, `setFoldGutter`, `setColorPreview`, `setDefaultBlockLanguage`, `didLoadCurrencies`, `setBracketClosing` and `setTabsState`.
- `emacs` — `setEmacsMarkMode`, `emacsKeymap`.
- `event` — `SelectionChangeEvent`.
- `extensions` — `createDynamicCloseBracketsExtension`.
- `fold-gutter` — `moveSelectionOutOfNewFolds`, `foldGutterExtension`, `toggleBlockFold`, `foldBlock`, `unfoldBlock`, `foldAllBlocks`, `unfoldAlBlocks`, `unfoldEverything`.
- `indentation` — `indentationExtension`, `insertIndentation`.
- `keymap` — `keymapFromSpec`, `ednaKeymap`.
- `language-detection/autodetect` — `applyDetectionResult`, `languageDetection`.
- `language-detection/levenshtein` — `levenshtein_distance`.
- `languages` — `Language`, `kLanguages`, `LANGUAGES`, `extForLang`, `getLanguage`, `getLanguageNameFromToken`, `langSupportsRun`, `langGetParser`, `PrettierInfo`, `langGetPrettierInfo`, `langSupportsFormat`.
- `links` — `links`.
- `save` — `autoSaveContent`.
- `scroll-margin` — `scrollMargin`.
- `setup` — `CreateFindPanelFn`, `customSetup`.
- `theme/base` — `heynoteBase`.
- `theme/dark` — `heynoteDark`, `darkHighlightStyle`, `darkTheme`.
- `theme/font-theme` — `setDefaultFontFamilyAndSize`, `isMonospaceFont`, `getFontTheme`.
- `theme/light` — `heynoteLight`.
- `todo-checkbox` — `todoCheckboxPlugin`, `toggleCheckbox`.

## Input compatibility

| Gesture | Action |
| --- | --- |
| Mod + C/X/V/A | Copy, cut, paste, select active block then entire note |
| Tab / Shift + Tab | Insert indentation or indent/outdent selection |
| Alt / Mod + Enter | Add before / after active block |
| Alt / Mod + Shift + Enter | Add before first / after last and scroll down |
| Mod + Alt + Enter | Split at cursor |
| Mod + Shift + Space | Toggle Markdown tasks |
| Alt + Up/Down | Move selected lines |
| Mod + Alt + Up/Down | Add cursor above/below |
| Mod + Alt + Shift + Up/Down | Move block |
| Alt + Shift + D/T | Insert localized date and time / 24-hour time followed by a space |
| Mod + Up/Down, Ctrl + Up/Down | Block and paragraph motion, also support Shift to extend |
| Mod + Shift + [ or ] | Fold/unfold code |
| Mod + Alt + [, ] or period | Fold, unfold, toggle block |
| Mod + Shift + Z | Redo, including on Windows |

Emacs mode layers familiar bindings over these. Ctrl+B/F, P/N and A/E move by character, line and line boundary. Ctrl+Left/Right moves by word. Ctrl+Space toggles the mark, Ctrl+G cancels, and movement extends while marking. Ctrl+D/H delete a character, Ctrl+K kills to end of line, Ctrl+O splits, Ctrl+T transposes grapheme clusters within block boundaries, Ctrl+V pages down, Ctrl+Y/W paste/cut and configured Meta+W copies. Ctrl+Shift+minus and Ctrl+period undo and redo.

The executable detection adapter in `src/public/langdetect-worker.js` also has a Heynote counterpart. Replace it along with the client. Preserve the separate bundled GuessLang dependency. Requests contain content and idx. Object/array JSON gets a certain JSON result. For model guesses accept a supported first candidate above 0.15 confidence or the first supported alternative above 0.5. The reply echoes content and idx and includes the guessed language ID and confidence.

The relocated `src/format-code.ts` also corresponds to Heynote’s block formatter. Replace `formatBlockContent(editor): Promise<boolean>`. Format only the active editable block. Go posts raw source to /api/goplay/fmt and reads Body/Error. Other supported tokens use standalone Prettier with the editor tab width, preserving the cursor at either boundary or mapping it through formatting inside the text. A failed, stale, or read-only operation leaves the document alone. A successful replacement scrolls to the caret and can be undone. The app-level format tests exercise both the status bar and the shortcut.

## Implementation and verification record

The UI baseline at 989e640 passed 184 Chromium tests before the implementation was removed. Commits 9cb5b39 and de254b8 removed the 34 runtime files. Separate GPT-6.2 Sol Medium implementation agents started with fresh contexts and a source snapshot with no Git history, old runtime files or application bundles. Their handoff included this plan, declarations, catalog data, UI screenshots, tests, dependencies and Edna callers. Commit 373f962 integrates their work.

Two integration changes extend the original plan. The existing nested-language adapter asks the registry for a parser so a saved token such as `constructor` safely falls back to plain content. NoteLoader now waits for pending writes and checks for edits and superseded loads before changing the save destination. Both cases have regression tests.

The replacement passed 186 Chromium tests and 44 Node tests with `bun run test`. Type checking (`bun run check`), the production build (`bun run build`) and Go tests (`go test ./...`) also passed. Fourteen additional production-browser sequences produced identical saved note text and block counts in the original and replacement editors. They covered splitting, adding, moving, deleting via selection, paragraph navigation, indentation and undo. Representative light and dark views were compared visually.

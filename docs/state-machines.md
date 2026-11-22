# Edna state machines

This document describes the explicit and implicit state machines in Edna: their
states (and how each state is represented in code), the invariants that must hold,
and transition tables. It ends with the list of invalid states / transitions that
the code could actually reach, grouped into issues, with their status.

File references are to `src/` unless stated otherwise. "LS" = localStorage,
"FS" = notes stored in a directory via the File System Access API.

Keep this document updated when changing any of the flows below.

## Shared facts

- **One editor view for all notes.** `MultiBlockEditor.svelte` keeps one CodeMirror
  `EditorView` and switches notes with `editor.setContent()`. Anything that captured
  the view and awaits can resume against a different note.
- **The "busy" modal (`ModalMessage.svelte`) does not block input** (`pointer-events-none`,
  shown after a delay). During loads, runs, encryption and migration the UI stays usable.
- **Auto-save is debounced 2 s** (`editor/save.ts`); the pending save is flushed when
  the editor is destroyed.
- **Keyboard shortcuts are handled in the capture phase on `window`** (`App.svelte`
  `onKeyDown`), before dialogs see them.
- **Nothing is shared between browser tabs** except storage (LS, IndexedDB, the directory).

---

## M1. Storage mode

Representation: module var `storageFS` (`notes.ts`), IndexedDB `edna/keyval["storageDirHandle"]`,
the mounted root component (`appSvelte` in `main.ts`: `App` or `AskFSPermissions`).

| State | Representation |
|---|---|
| `LS` | no dir handle in IndexedDB; `storageFS` undefined |
| `DIR_OK` | handle stored, read-write permission granted, `storageFS` = handle |
| `DIR_NOPERM` | handle stored, permission not granted; `AskFSPermissions` mounted |
| `DIR_ERROR` | handle stored but directory can't be read (deleted, unmounted) |
| `MIGRATING` | LS → FS migration in progress (`switchToStoringNotesOnDisk`) |

Invariants:
- **S-I1** while `App` is mounted, `storageFS` is the store `App` loaded its notes from.
- **S-I2** a note lives in exactly one store; migration never loses or overwrites a note.
- **S-I3** at most one storage operation (migration, encrypt-all, decrypt-all, switch) runs at a time.
- **S-I4** pending edits of the open note are written to the store they were loaded from.

| From | Event | Guard | To | Code |
|---|---|---|---|---|
| boot | handle in IndexedDB | permission granted | `DIR_OK` | `main.ts boot` |
| boot | handle in IndexedDB | not granted | `DIR_NOPERM` | `main.ts boot` |
| boot | handle, dir unreadable | – | `DIR_ERROR` | `main.ts boot` |
| boot | no handle | – | `LS` | `main.ts boot` |
| `DIR_NOPERM` | Allow | granted | `DIR_OK` (re-boot) | `AskFSPermissions` |
| `DIR_NOPERM`/`DIR_ERROR` | Pick another directory | picked | re-boot | `AskFSPermissions`, `pickAnotherDirectory` |
| `DIR_*` | Switch to browser storage | – | `LS` (re-boot) | `App switchToBrowserStorage` |
| `LS` | Move notes to directory | picked, no other op | `MIGRATING` → `DIR_OK` | `App storeNotesOnDisk`, `notes.ts switchToStoringNotesOnDisk` |
| any | Switch to notes in directory | picked | `DIR_OK` (re-boot) | `App pickAnotherDirectory2` |

## M2. Workspace encryption (FS only)

Representation: file suffix `.edna.txt` vs `.encr.edna.txt`; in-memory `encryptedNoteNames`
(`notes.ts`, refreshed by `loadNoteNames`).

| State | Meaning |
|---|---|
| `PLAIN` | no `.encr` files |
| `ENCRYPTED` | all notes `.encr` |
| `MIXED` | both (only as a result of an interrupted encrypt/decrypt) |
| `ENCRYPTING` / `DECRYPTING` | encrypt-all / decrypt-all in progress |

Invariants:
- **E-I1** no note exists as both `X.edna.txt` and `X.encr.edna.txt`.
- **E-I2** all `.encr` files decrypt with the same key.
- **E-I3** `encryptedNoteNames` matches the directory.
- **E-I4** `MIXED` can be completed by running encrypt-all again.
- **E-I5** "using encryption" is a property of the directory (it has `.encr` notes), not of
  a password remembered from another directory.

| From | Event | Guard | To | Code |
|---|---|---|---|---|
| `PLAIN`/`MIXED` | Encrypt all notes | FS, has plain notes, password verifies against existing `.encr` notes, no other op | `ENCRYPTING` → `ENCRYPTED` (or `MIXED` on failure) | `encryptAllNotes` |
| `ENCRYPTED`/`MIXED` | Decrypt all notes | FS, has `.encr` notes, no other op | `DECRYPTING` → `PLAIN` (or `MIXED` on failure) | `decryptAllNotes` |
| any | create note | `isUsingEncryption()` | new note `.encr` or plain | `writeNoteFS` |
| any | save note | `isEncryptedNote(name)` | same format as before | `writeMaybeEncryptedFS` |

## M3. Password

Representation: localStorage `edna-password` (plaintext); key = `hash(password, salt)`.
Prompt: `getPasswordFromUser` (`App.svelte`) shows `EnterDecryptPassword`.

| State | Meaning |
|---|---|
| `NONE` | nothing remembered |
| `PROMPTING` | password dialog open, one shared pending request |
| `VERIFIED` | remembered; decrypts the directory's `.encr` notes |

Invariants:
- **P-I1** a password is remembered / used for encryption only after it decrypted an
  existing `.encr` note (or there are none to check against).
- **P-I2** cancelling the prompt aborts the operation; it never yields a password.
- **P-I3** at most one prompt at a time; concurrent requests share it.

| From | Event | To | Code |
|---|---|---|---|
| `NONE` | read/write encrypted note | `PROMPTING` | `getPasswordHashMust` |
| `PROMPTING` | password entered, verifies | `VERIFIED` | `getPasswordHashMust` |
| `PROMPTING` | password entered, doesn't verify | `PROMPTING` ("not correct") | `getPasswordHashMust` |
| `PROMPTING` | cancel (Esc, click outside) | `NONE`, operation fails with `PasswordCancelledError` | `getPasswordHashMust` |
| `VERIFIED` | decrypt of a note fails | `PROMPTING` | `readEncryptedFS` |
| any | encrypt-all with new password | `VERIFIED` | `encryptAllNotes` |
| any | decrypt-all completes | `NONE` | `decryptAllNotes` |

## M4. Note lifecycle

Representation: `appState.allNotes`, LS key `note:<name>` or file `<name>.edna.txt` /
`.encr.edna.txt`, metadata entry (`metadata.ts`), `openedNotes` for notes opened from disk.

| From | Event | Guard | To | Code |
|---|---|---|---|---|
| none | create (dialog, note selector, scratch) | no note with that name, case-insensitive, incl. archived | exists | `createNoteWithName` |
| none/exists | move block to note | target ≠ current note | exists, block appended | `App onMoveBlockToNote`, `appendToNote` |
| exists | rename | new name free (case-insensitive) | exists under new name | `renameNote` |
| exists | delete | not scratch / system / opened | none | `deleteNote` |
| exists | archive / unarchive | – | metadata flag | `metadata.ts` |

Invariants:
- **N-I1** creating a note never overwrites an existing note.
- **N-I2** a deleted / renamed-away note has no file, metadata, history entry or tab.

## M5. Open note: editor vs app state

Five pieces of state must agree:
- **E** `currentNoteName` in `MultiBlockEditor.svelte` — the note saves go to
- **C** the text in the editor
- **T** `settings.currentTab` (and derived `appState.currentNoteName`)
- **U** URL hash / browser history entry
- `document.title`

| State | Meaning |
|---|---|
| `HOME` | `T` = home tab, editor unmounted |
| `SHOWING(A)` | E = T = A, C = content of A |
| `LOADING(A→B)` | editor still shows A (E = A), load of B in flight |

Invariants:
- **O-I1** E is always the note whose content is in the editor (C). E changes only together
  with `setContent()`.
- **O-I2** only the most recently requested load is applied; earlier loads that finish
  later are discarded.
- **O-I3** a failed load leaves the editor on the previous note (E, C, T unchanged).
- **O-I4** selection / folds are saved to E only after they were restored for E.

| From | Event | To | Code |
|---|---|---|---|
| `HOME` | open note B | T = B, editor mounts, `LOADING(-→B)` | `App openNote`, `MultiBlockEditor didMount` |
| `SHOWING(A)` | open note B | save A, save view state of A, `LOADING(A→B)` | `MultiBlockEditor openNote` |
| `LOADING(A→B)` | load done, still latest | `SHOWING(B)`; restore view state; T, U, title = B | `MultiBlockEditor openNote`, `App didLoadNote` |
| `LOADING(A→B)` | open note C | `LOADING(A→C)`; B's result discarded | `MultiBlockEditor openNote` |
| `LOADING(A→B)` | load failed | `SHOWING(A)`, error shown | `MultiBlockEditor openNote` |
| `SHOWING(A)` | Home tab | editor destroyed (pending save flushed to A) → `HOME` | `TopNav`, `MultiBlockEditor` cleanup |
| any | popstate (Back) | open note from history entry (if no dialog) | `App onPopState` |

## M6. Dirty / auto-save

Representation: `appState.isDirty`, `editor.diskContent`, pending debounce in `editor/save.ts`.

Invariants:
- **D-I1** `diskContent` is what was last successfully written for E.
- **D-I2** `isDirty` ⇔ editor content ≠ `diskContent`.
- **D-I3** a failed save keeps `isDirty` and is retried by the next save.

| From | Event | To | Code |
|---|---|---|---|
| clean | user edit | dirty, debounce armed | `save.ts` |
| dirty | debounce fires / Ctrl+S / switch note / close tab / destroy | saving | `editor.save` |
| saving | write ok | `diskContent` = written content; dirty iff content changed meanwhile | `editor.save` |
| saving | write failed | dirty (retried by next save) | `editor.save` |

## M7. Tabs

Representation: `settings.tabs` (contains the home tab), `settings.currentTab`.

Invariants:
- **T-I1** `currentTab` is home or in `tabs`.
- **T-I2** no duplicates; home is in `tabs`.
- **T-I3** every non-home tab names an existing note.

| Event | Effect | Code |
|---|---|---|
| boot | validate, drop tabs of missing notes | `main.ts boot` |
| open note | replace current tab (unless new tab requested) | `App onOpenNote` |
| note loaded | `currentTab` = note, add tab | `App didLoadNote` |
| close tab | remove; open neighbor | `App closeTab` |
| rename | rename tab | `renameNote` |
| delete | remove tab; open scratch if current | `App deleteNotePermanently` |

## M8. Dialogs

Representation: independent booleans `appState.showing*` (+ `showingBlockSelector` in
`App.svelte`); `isShowingDialog` is their OR.

Invariants:
- **G-I1** at most one dialog (password / file-permission prompts may stack on top).
- **G-I2** while a dialog is open, the current note doesn't change (dialogs capture the
  note / active block when opened).
- **G-I3** `appState.forceNewTab` is true only while a note selector opened for "open in
  new tab" is showing.

| From | Event | To | Code |
|---|---|---|---|
| none | open X (shortcut, menu, command) | X | `App open*` |
| X | Esc / click outside | none, editor focused | `Overlay`, `App closeDialogs` |
| X | command executed | none (+ target dialog) | `App executeCommand` |
| any | Alt+1..9 | open note only if no dialog | `App onKeyDown` |
| any | popstate | open note; dialogs closed first | `App onPopState` |

## M9. Code / function run

States: `IDLE`, `RUNNING(note, block)`. Representation: `runInProgress` flag in `App.svelte`
(plus a modal message).

Invariants:
- **R-I1** at most one run at a time.
- **R-I2** output goes to the note the run was started from; if that note is no longer
  open, it's appended to that note via storage.
- **R-I3** a run always ends (`IDLE`, modal cleared) even on errors.

## M10. Async dialogs

- **Find in notes**: `IDLE` → `SEARCHING(run id)` → `DONE`. Invariants: only the latest search
  writes results (**F-I1**); closing the dialog stops the search (**F-I2**).
- **Ask AI**: `IDLE` → `REQUESTING` → `FINISHED` / `ERROR`. Invariants: closing aborts the
  request (**A-I1**); the inserted header names the model that produced the response (**A-I2**).
- **Language auto-detection**: request posted per block; reply applied only if still
  relevant (Levenshtein check).
- **Currency rates**: `NOT_LOADED` → `LOADED`; refreshed every 4 h.

---

## Reachable invalid states / transitions

Found by code review and traced end to end unless marked *suspected*. Grouped into
issues, ordered by impact. Status: **fixed** (with regression test where testable),
**open**.

### Issue 1 — Note switching can save one note's content into another note (data loss)
Breaks O-I1..O-I4.
- 1a. `openNote` set E before `await loadNote`; a failed load left E = B while showing A →
  edits of A saved into B.
- 1b. Overlapping `openNote` calls (slow FS / encrypted load, password prompt): the earlier
  load finishing last showed B while E = C → B's text saved into C.
- 1c. Mount race: mount load in flight + another `openNote` → tab/URL say C, editor shows B.
- 1d. Text typed during a load discarded, or (load > 2 s) saved into the target note.
- 1e. `saveEditorState` before restore wrote the shown note's selection/folds into another
  note's metadata.
- 1f. Going Home during a load: `didLoadNote` called on an unmounted editor (TypeError).

### Issue 2 — Save bookkeeping loses edits
Breaks D-I1..D-I3.
- 2a. `editor.save()` set `diskContent` before the write; a failed write was never retried.
- 2b. `isDirty` cleared when any save finished, even if the user typed meanwhile → no
  unload warning, edits lost.
- 2c. Opened file without write permission: save returned silently and `isDirty` was cleared.

### Issue 3 — Creating or moving to a note can overwrite / delete content
Breaks N-I1.
- 3a. Note selector "create" checked only the visible (filtered, non-archived) list:
  creating an archived note's name (or a case variant) overwrote it with an empty note.
- 3b. `appendToNote` used exact-case `noteExists`: case variant overwrote the note.
- 3c. Moving a block to the current note appended to disk, then deleted it from the
  editor; the next save removed it everywhere.

### Issue 4 — Dialog invariants
Breaks G-I1..G-I3.
- 4a. Alt+1..9 switched notes behind any dialog except the note selector: move-block moved
  a block out of the wrong note, rename renamed the wrong note, Ask AI inserted into the
  wrong note, run-with-block crashed. On Mac Option+digit typed in dialogs was swallowed.
- 4b. Browser Back (popstate) did the same.
- 4c. "Encrypt all notes" from the Home tab threw before encrypting (focus on missing view).
- 4d. `forceNewTab` leaked when switching from note selector to command palette.
- 4e. *(suspected)* function selector opened after an await, on top of another dialog.

### Issue 5 — Password handling
Breaks P-I1..P-I3.
- 5a. Cancelling the prompt resolved `""`, which was remembered and used as key: notes
  written with `hash("")` became unreadable and reading looped forever.
- 5b. A password typed for a write was remembered and used without verification: a typo
  encrypted notes with a different key.
- 5c. A second prompt overwrote the first resolver; the first operation hung forever.

### Issue 6 — Encrypt / decrypt all
Breaks S-I3, E-I1, E-I3, E-I4.
- 6a. No lock: running twice concurrently, or together with migration.
- 6b. Auto-save during the operation wrote a plaintext copy next to the encrypted file or
  lost the edit (stale `encryptedNoteNames`, editor editable).
- 6c. Interrupted encrypt-all left `MIXED` and "Encrypt all" disabled; plain notes stayed
  plain forever; names stale; modal stuck; errors unhandled.

### Issue 7 — Moving notes from browser to directory
Breaks S-I2, S-I3.
- 7a. Running twice concurrently wrote empty content over migrated notes.
- 7b. Edits typed during migration were lost.
- 7c. Directory with encrypted notes: migration threw after writing some notes in plaintext.
- 7d. Unique-name collisions: two notes written to the same `foo-1`; case-insensitive
  file systems: `Foo` overwrote `foo`.
- 7e. Metadata failure after LS notes were deleted left the app in LS mode with notes
  only on disk.
- 7f. In-memory metadata not reloaded after migration; next save overwrote merged metadata.

### Issue 8 — Switching storage / boot
Breaks S-I1, S-I4, E-I5.
- 8a. Storage changed before the old `App` was unmounted: pending save and selection/folds
  of the open note were written into the new store.
- 8b. Unreadable directory at boot: `boot()` rejected, nothing mounted, blank app on every
  reload with no way to switch storage.
- 8c. The remembered password is global: in a plain directory new notes were encrypted
  (because a password from another directory was remembered) → `MIXED`.

### Issue 9 — Code runs
Breaks R-I1..R-I3.
- 9a. Output inserted into whatever note was open when the run finished; a system note
  could become writable (`didLoadNote` reset the read-only lock used as run lock).
- 9b. Concurrent runs (lock reset by note switch); console capture restored in wrong order.
- 9c. Boop function "replace" used block offsets from before the await (wrong range / RangeError,
  modal stuck).
- 9d. *(suspected)* Go run: `rsp.json()` outside try, `Events` may be null → editor stuck read-only.

### Issue 10 — Tabs and navigation
Breaks T-I1.
- 10a. `closeTab` when current tab isn't in `tabs` → `openNote(undefined)`.
- 10b. `openNoteFromFind` jumped to the position with a fixed 200 ms timer (RangeError or
  wrong position when the load is slower / from Home).

### Issue 11 — Find in notes
Breaks F-I1, F-I2.
- 11a. A new search while one is running: both loops push into the same results; stale
  "No results" message; duplicate results for the same term.
- 11b. Closing the dialog didn't stop the search.
- 11c. Each result pushed reset the list selection to the first row.

### Issue 12 — Ask AI
Breaks A-I1, A-I2.
- 12a. Closing the dialog didn't abort the request.
- 12b. Inserted header used the model selected at insert time, not the one that answered.
- 12c. On read-only notes the response was discarded silently.

### Issue 13 — Multiple browser tabs
Breaks S-I1..S-I4 across tabs (stale `encryptedNoteNames`, metadata overwritten, edits to
old store). Mitigation: detect other Edna tabs and warn; refuse storage operations while
other tabs are open.

### Issue 14 — Low impact
- 14a. Currency rates: no retry after a failed first fetch; *(suspected)* sticky failure after a
  partial `createUnit` error.
- 14b. Auto-detect "content cleared" branch could change the language of a different block
  *(suspected, idle-callback timing)*.
- 14c. Editor find panel's mouse-tracking suppression overwritten by dialog close.
- 14d. Concurrent metadata writes can complete out of order *(suspected)*.

## Status

| Issue | Status |
|---|---|
| 1 Note switching | fixed (1a–1f): `NoteLoader` (`editor/note-loader.ts`), `tests/browser/note-loader.test.ts` |
| 2 Save bookkeeping | fixed (2a–2c), `tests/browser/save.test.ts` |
| 3 Create / move overwrites | fixed (3a–3c), `tests/browser/notes.test.ts` |
| 4 Dialog invariants | fixed (4a–4e), `tests/browser/app.test.ts` (4a, 4b, 4d) |
| 5 Password handling | open |
| 6 Encrypt / decrypt all | open |
| 7 Migration | open |
| 8 Storage switch / boot | open |
| 9 Code runs | open |
| 10 Tabs / navigation | open |
| 11 Find in notes | open |
| 12 Ask AI | open |
| 13 Multiple browser tabs | open |
| 14 Low impact | open |

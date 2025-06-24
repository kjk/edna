import { redo, undo } from "@codemirror/commands";
import { markdown, markdownKeymap } from "@codemirror/lang-markdown";
import {
  ensureSyntaxTree,
  foldEffect,
  foldGutter,
  foldState,
} from "@codemirror/language";
import {
  Annotation,
  Compartment,
  EditorSelection,
  EditorState,
  Facet,
  Prec,
  RangeSet,
  Transaction,
} from "@codemirror/state";
import {
  keymap as cmKeymap,
  drawSelection,
  EditorView,
  lineNumbers,
  ViewPlugin,
} from "@codemirror/view";
import {
  getNoteMeta,
  setNoteCursors,
  setNoteFoldedRanges,
} from "../metadata.js";
import { loadNote, saveCurrentNote, saveNote } from "../notes.js";
import { findEditorByView } from "../state.js";
import { useErrorStore } from "../stores/error-store.svelte.js";
import { useHeynoteStore } from "../stores/heynote-store.svelte.js";
import { throwIf } from "../util.js";
import { APPEND_BLOCK, heynoteEvent, SET_CONTENT } from "./annotation.js";
import {
  blockLineNumbers,
  blockState,
  getActiveNoteBlock,
  noteBlockExtension,
  triggerCursorChange,
} from "./block/block.js";
import {
  changeCurrentBlockLanguage,
  deleteBlock,
  triggerCurrenciesLoaded,
} from "./block/commands.js";
import { selectAll } from "./block/select-all.js";
import { getCloseBracketsExtensions } from "./close-brackets.js";
import { focusEditorView, isReadOnly } from "./cmutils.js";
import { HEYNOTE_COMMANDS } from "./commands.js";
import { heynoteCopyCut } from "./copy-paste";
import { foldGutterExtension } from "./fold-gutter.js";
import { indentation } from "./indentation.js";
import { getKeymapExtensions } from "./keymap.js";
import { heynoteLang } from "./lang-heynote/heynote.js";
import { languageDetection } from "./language-detection/autodetect.js";
import { links } from "./links.js";
import { autoSaveContent } from "./save.js";
import { customSetup } from "./setup.js";
import { heynoteBase } from "./theme/base.js";
import { heynoteDark } from "./theme/dark.js";
import { getFontTheme } from "./theme/font-theme.js";
import { heynoteLight } from "./theme/light.js";
import { todoCheckboxPlugin } from "./todo-checkbox";

export class HeynoteEditor {
  constructor({
    element,
    path,
    focus = true,
    theme = "light",
    keymap = "default",
    emacsMetaKey,
    showLineNumberGutter = true,
    showFoldGutter = true,
    bracketClosing = false,
    fontFamily,
    fontSize,
    indentType = "space",
    tabSize = 4,
    defaultBlockToken,
    defaultBlockAutoDetect,
    keyBindings,
  }) {
    this.path = path;
    this.element = element;
    this.themeCompartment = new Compartment();
    this.keymapCompartment = new Compartment();
    this.lineNumberCompartmentPre = new Compartment();
    this.lineNumberCompartment = new Compartment();
    this.foldGutterCompartment = new Compartment();
    this.readOnlyCompartment = new Compartment();
    this.closeBracketsCompartment = new Compartment();
    this.indentUnitCompartment = new Compartment();
    this.deselectOnCopy = keymap === "emacs";
    this.emacsMetaKey = emacsMetaKey;
    this.fontTheme = new Compartment();
    this.setDefaultBlockLanguage(defaultBlockToken, defaultBlockAutoDetect);
    this.contentLoaded = false;
    this.notesStore = useHeynoteStore();
    this.errorStore = useErrorStore();
    this.note = {};
    this.selectionMarkMode = false;
    this.name = path;

    throwIf(!this.path);

    let updateListenerExtension = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        // console.log("docChanged:", update)
        this.element.dispatchEvent(new Event("docChanged"));
      }
    });
    this.createState = () => {
      const state = EditorState.create({
        doc: "",
        extensions: [
          this.keymapCompartment.of(
            getKeymapExtensions(this, keymap, keyBindings),
          ),
          updateListenerExtension,
          heynoteCopyCut(this),

          //minimalSetup,
          this.lineNumberCompartment.of(
            showLineNumberGutter ? blockLineNumbers : [],
          ),
          customSetup,
          this.foldGutterCompartment.of(
            showFoldGutter ? [foldGutterExtension()] : [],
          ),

          this.closeBracketsCompartment.of(
            bracketClosing ? [getCloseBracketsExtensions()] : [],
          ),
          // this.closeBracketsCompartment.of(
          //   bracketClosing ? createDynamicCloseBracketsExtension() : [],
          // ),

          this.readOnlyCompartment.of([]),

          this.themeCompartment.of(
            theme === "dark" ? heynoteDark : heynoteLight,
          ),
          heynoteBase,
          this.fontTheme.of(getFontTheme(fontFamily, fontSize)),
          this.indentUnitCompartment.of(indentation(indentType, tabSize)),

          //makeTabState(true, tabSize),
          EditorView.scrollMargins.of((f) => {
            return { top: 80, bottom: 80 };
          }),
          heynoteLang(),
          noteBlockExtension(this),
          languageDetection(() => this),

          // set cursor blink rate to 1 second
          drawSelection({ cursorBlinkRate: 1000 }),

          // add CSS class depending on dark/light theme
          EditorView.editorAttributes.of((view) => {
            return {
              class: view.state.facet(EditorView.darkTheme)
                ? "dark-theme"
                : "light-theme",
            };
          }),

          autoSaveContent(this, 2000),

          todoCheckboxPlugin,
          markdown({ addKeymap: false }),
          Prec.highest(cmKeymap.of(markdownKeymap)),
          links,
        ],
      });
      return state;
    };
    const state = this.createState();
    this.view = new EditorView({
      state: state,
      parent: element,
    });

    //this.setContent(content)
    this.setReadOnly(true);
    this.contentLoadedPromise = this.loadContent();
    this.contentLoadedPromise.then(() => {
      this.setReadOnly(false);
    });

    if (focus) {
      this.view.focus();
    }
  }

  async save() {
    if (!this.contentLoaded) {
      return;
    }
    const content = this.getContent();
    if (content === this.diskContent) {
      return;
    }
    //console.log("saving:", this.path)
    this.diskContent = content;

    await saveNote(this.path, content);
    // await window.heynote.buffer.save(this.path, content);
  }

  getContent() {
    this.note.content = this.view.state.sliceDoc();
    this.note.cursors = this.view.state.selection.toJSON();
    setNoteCursors(this.path, this.note.cursors);

    // fold state
    const foldedRanges = [];
    this.view.state
      .field(foldState, false)
      ?.between(0, this.view.state.doc.length, (from, to) => {
        foldedRanges.push({ from, to });
      });
    this.note.foldedRanges = foldedRanges;
    setNoteFoldedRanges(this.path, foldedRanges);

    const ranges = this.note.cursors.ranges;
    if (ranges.length == 1 && ranges[0].anchor == 0 && ranges[0].head == 0) {
      console.log("DEBUG!! Cursor is at 0,0");
      console.trace();
    }
    return this.note.content;
  }

  async loadContent() {
    console.log("loading content", this.path);
    //const content = await window.heynote.buffer.load(this.path);
    const content = await loadNote(this.path);
    let meta = getNoteMeta(this.path);
    this.note.cursors = meta?.cursors || null;
    this.note.foldedRanges = meta?.foldedRanges || [];

    this.diskContent = content;

    // set up content change listener
    this.onChange = (content) => {
      this.diskContent = content;
      this.setContent(content);
    };
    window.heynote.buffer.addOnChangeCallback(this.path, this.onChange);

    await this.setContent(content);
    this.contentLoaded = true;
  }

  setContent(content) {
    return new Promise((resolve) => {
      // set buffer content
      this.view.dispatch({
        changes: {
          from: 0,
          to: this.view.state.doc.length,
          insert: content,
        },
        annotations: [
          heynoteEvent.of(SET_CONTENT),
          Transaction.addToHistory.of(false),
        ],
      });

      // Ensure we have a parsed syntax tree when buffer is loaded. This prevents errors for large buffers
      // when moving the cursor to the end of the buffer when the program starts
      ensureSyntaxTree(this.view.state, this.view.state.doc.length, 5000);

      // Set cursor positions
      // We use requestAnimationFrame to avoid a race condition causing the scrollIntoView to sometimes not work
      requestAnimationFrame(() => {
        if (this.note.cursors) {
          this.view.dispatch({
            selection: EditorSelection.fromJSON(this.note.cursors),
            scrollIntoView: true,
          });
        } else {
          // if metadata doesn't contain cursor position, we set the cursor to the end of the buffer
          this.view.dispatch({
            selection: {
              anchor: this.view.state.doc.length,
              head: this.view.state.doc.length,
            },
            scrollIntoView: true,
          });
        }
        // set folded ranges
        this.view.dispatch({
          effects: this.note.foldedRanges.map((range) => foldEffect.of(range)),
        });
        resolve();
      });
    });
  }

  setName(name) {
    //this.note.metadata.name = name;
    this.name = name;
    triggerCursorChange(this.view);
  }

  getBlocks() {
    return this.view.state.facet(blockState);
  }

  getCursorPosition() {
    return this.view.state.selection.main.head;
  }

  setCursorPosition(position) {
    this.view.dispatch({
      selection: { anchor: position, head: position },
      scrollIntoView: true,
    });
  }

  focus() {
    focusEditorView(this.view);
  }

  isReadOnly() {
    return isReadOnly(this.view);
  }

  setReadOnly(readOnly) {
    this.view.dispatch({
      effects: this.readOnlyCompartment.reconfigure(
        readOnly ? [EditorState.readOnly.of(true)] : [],
      ),
    });
  }

  setFont(fontFamily, fontSize) {
    let ff = getFontTheme(fontFamily, fontSize);
    this.view.dispatch({
      effects: this.fontTheme.reconfigure(ff),
    });
  }

  setTheme(theme) {
    this.view.dispatch({
      effects: this.themeCompartment.reconfigure(
        theme === "dark" ? heynoteDark : heynoteLight,
      ),
    });
  }

  setKeymap(keymap, emacsMetaKey) {
    this.deselectOnCopy = keymap === "emacs";
    this.emacsMetaKey = emacsMetaKey;
    this.view.dispatch({
      effects: this.keymapCompartment.reconfigure(
        getKeymapExtensions(this, keymap),
      ),
    });
  }

  openLanguageSelector() {
    this.notesStore.openLanguageSelector();
  }

  openBufferSelector() {
    this.notesStore.openBufferSelector();
  }

  openCommandPalette() {
    this.notesStore.openCommandPalette();
  }

  openHistorySelector() {
    this.notesStore.openHistorySelector();
  }

  openCreateBuffer(createMode) {
    this.notesStore.openCreateBuffer(createMode);
  }

  createScratchNote() {
    this.notesStore.createScratchNote();
  }
  smartRun() {
    this.notesStore.smartRun();
  }

  openMoveToBufferSelector() {
    this.notesStore.openMoveToBufferSelector();
  }

  openBlockSelector() {
    this.notesStore.openBlockSelector();
  }

  openFunctionSelector() {
    this.notesStore.openFunctionSelector();
  }

  getActiveBlockContent() {
    const block = getActiveNoteBlock(this.view.state);
    if (!block) {
      return;
    }
    return this.view.state.sliceDoc(block.range.from, block.range.to);
  }

  deleteActiveBlock() {
    deleteBlock(this)(this.view);
  }

  appendBlockContent(content) {
    this.view.dispatch({
      changes: {
        from: this.view.state.doc.length,
        to: this.view.state.doc.length,
        insert: content,
      },
      annotations: [heynoteEvent.of(APPEND_BLOCK)],
    });
  }

  setCurrentLanguage(lang, auto = false) {
    changeCurrentBlockLanguage(this.view.state, this.view.dispatch, lang, auto);
  }

  setLineNumberGutter(show) {
    this.view.dispatch({
      effects: this.lineNumberCompartment.reconfigure(
        show ? blockLineNumbers : [],
      ),
    });
  }

  setFoldGutter(show) {
    this.view.dispatch({
      effects: this.foldGutterCompartment.reconfigure(
        show ? [foldGutterExtension()] : [],
      ),
    });
  }

  // setBracketClosing(value) {
  //   this.view.dispatch({
  //     effects: this.closeBracketsCompartment.reconfigure(
  //       value ? createDynamicCloseBracketsExtension() : [],
  //     ),
  //   });
  // }

  setBracketClosing(value) {
    this.view.dispatch({
      effects: this.closeBracketsCompartment.reconfigure(
        value ? [getCloseBracketsExtensions()] : [],
      ),
    });
  }

  setDefaultBlockLanguage(token, autoDetect) {
    this.defaultBlockToken = token || "text";
    this.defaultBlockAutoDetect = autoDetect === undefined ? true : autoDetect;
  }

  currenciesLoaded() {
    triggerCurrenciesLoaded(this.view.state, this.view.dispatch);
  }

  destroy(save = true) {
    if (this.onChange) {
      window.heynote.buffer.removeOnChangeCallback(this.path, this.onChange);
    }
    if (save) {
      this.save();
    }
    this.view.destroy();
    // window.heynote.buffer.close(this.path);
  }

  hide() {
    //console.log("hiding element", this.view.dom)
    this.view.dom.style.setProperty("display", "none", "important");
  }
  show() {
    //console.log("showing element", this.view.dom)
    this.view.dom.style.setProperty("display", "");
    triggerCursorChange(this.view);
  }

  undo() {
    undo(this.view);
  }

  redo() {
    redo(this.view);
  }

  selectAll() {
    selectAll(this.view);
  }

  setIndentSettings(indentType, tabSize) {
    this.view.dispatch({
      effects: this.indentUnitCompartment.reconfigure(
        indentation(indentType, tabSize),
      ),
    });
  }

  executeCommand(command) {
    const cmd = HEYNOTE_COMMANDS[command];
    if (!cmd) {
      console.error(`Command not found: ${command}`);
      return;
    }
    cmd.run(this)(this.view);
  }
}

/*// set initial data
editor.update([
    editor.state.update({
        changes:{
            from: 0,
            to: editor.state.doc.length,
            insert: initialData,
        },
        annotations: heynoteEvent.of(INITIAL_DATA),
    })
])*/

/**
 * @param {EditorView} view
 * @param {boolean} ro
 */
export function setReadOnly(view, ro) {
  let editor = findEditorByView(view);
  if (editor) {
    editor.setReadOnly(ro);
  }
}

/**
 *
 * @param {EditorView} view
 * @return {string}
 */
export function getContent(view) {
  return view.state.sliceDoc();
}

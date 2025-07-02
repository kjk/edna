import { markdown, markdownKeymap } from "@codemirror/lang-markdown";
import { ensureSyntaxTree, foldEffect, indentUnit } from "@codemirror/language";
import {
  Compartment,
  EditorSelection,
  EditorState,
  Prec,
  Transaction,
} from "@codemirror/state";
import {
  keymap as cmKeymap,
  drawSelection,
  EditorView,
  lineNumbers,
} from "@codemirror/view";
import { getNoteMeta, saveNotesMetadata } from "../metadata.js";
import { loadNote, saveNote } from "../notes.js";
import { findEditorByView } from "../state.js";
import { len, objectEqualDeep } from "../util.js";
import { heynoteEvent, SET_CONTENT, SET_FONT } from "./annotation.js";
import {
  blockLineNumbers,
  blockState,
  noteBlockExtension,
} from "./block/block.js";
import { triggerCurrenciesLoaded } from "./block/commands.js";
import { focusEditorView, getFoldedRanges, isReadOnly } from "./cmutils.js";
import { heynoteCopyCut } from "./copy-paste";
import { emacsKeymap } from "./emacs.js";
import { createDynamicCloseBracketsExtension } from "./extensions.js";
import { foldGutterExtension, unfoldEverything } from "./fold-gutter.js";
import { ednaKeymap } from "./keymap.js";
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

function getKeymapExtensions(editor, keymap) {
  if (keymap === "emacs") {
    return emacsKeymap(editor);
  } else {
    return ednaKeymap(editor);
  }
}

export class EdnaEditor {
  constructor({
    element,
    noteName,
    focus = true,
    theme = "light",
    keymap = "default",
    emacsMetaKey,
    showLineNumberGutter = true,
    showFoldGutter = true,
    bracketClosing = false,
    tabSize = 2,
    defaultBlockToken,
    defaultBlockAutoDetect,
    fontFamily,
    fontSize,
  }) {
    this.element = element;
    this.themeCompartment = new Compartment();
    this.keymapCompartment = new Compartment();
    this.lineNumberCompartmentPre = new Compartment();
    this.lineNumberCompartment = new Compartment();
    this.foldGutterCompartment = new Compartment();
    this.readOnlyCompartment = new Compartment();
    this.closeBracketsCompartment = new Compartment();
    this.deselectOnCopy = keymap === "emacs";
    this.emacsMetaKey = emacsMetaKey;
    this.fontTheme = new Compartment();
    this.setDefaultBlockLanguage(defaultBlockToken, defaultBlockAutoDetect);
    this.tabsCompartment = new Compartment();
    this.noteName = noteName;
    this.contentLoaded = false;

    const makeTabState = (tabsAsSpaces, tabSpaces) => {
      const indentChar = tabsAsSpaces ? " ".repeat(tabSpaces) : "\t";
      const v = indentUnit.of(indentChar);
      return this.tabsCompartment.of(v);
    };

    let updateListenerExtension = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        // console.log("docChanged:", update)
        this.element.dispatchEvent(new Event("docChanged"));
      }
    });

    const state = EditorState.create({
      doc: "",
      extensions: [
        updateListenerExtension,
        this.keymapCompartment.of(getKeymapExtensions(this, keymap)),
        heynoteCopyCut(this),

        //minimalSetup,
        this.lineNumberCompartment.of(
          showLineNumberGutter ? [lineNumbers(), blockLineNumbers] : [],
        ),
        customSetup,
        this.foldGutterCompartment.of(
          showFoldGutter ? [foldGutterExtension()] : [],
        ),

        this.closeBracketsCompartment.of(
          bracketClosing ? createDynamicCloseBracketsExtension() : [],
        ),

        this.readOnlyCompartment.of([]),

        this.themeCompartment.of(theme === "dark" ? heynoteDark : heynoteLight),
        heynoteBase,
        this.fontTheme.of(getFontTheme(fontFamily, fontSize)),
        makeTabState(true, tabSize),
        EditorView.scrollMargins.of((f) => {
          return { top: 80, bottom: 80 };
        }),
        heynoteLang(),
        noteBlockExtension(this),
        languageDetection(() => this.view),

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
        // foldNotifications(this),
        markdown({ addKeymap: false }),
        Prec.highest(cmKeymap.of(markdownKeymap)),
        links,
      ],
    });

    this.view = new EditorView({
      state: state,
      parent: element,
    });

    // this is async so runs in background
    this.loadNotePromise = this.loadNote(this.noteName);

    // TODO: move into loadNote?
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
      await this.saveFoldedState();
      return;
    }
    //console.log("saving:", this.path)
    this.diskContent = content;
    await saveNote(this.noteName, content);
    await this.saveFoldedState();
  }

  getContent() {
    return this.view.state.sliceDoc();
  }

  async loadNote(noteName) {
    //console.log("loadNote:", noteName)
    this.noteName = noteName;
    this.setReadOnly(true);
    // TODO: show a message
    const content = await loadNote(noteName);
    this.diskContent = content;
    await this.setContent(content);
    this.contentLoaded = true;
    this.setReadOnly(false);
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
        let noteMeta = getNoteMeta(this.noteName, false);
        let savedSelection = noteMeta?.selection;
        // TODO: validate selection?
        if (savedSelection) {
          // console.log("setContent: restoring selection:", savedSelection);
          try {
            this.view.dispatch({
              selection: EditorSelection.fromJSON(savedSelection),
              scrollIntoView: true,
            });
          } catch (e) {
            // console.error("setContent: error restoring selection:", e);
            // if we fail to restore selection, just put cursor at the beginning
            this.view.dispatch({
              selection: EditorSelection.single(0),
              scrollIntoView: true,
            });
          }
        } else {
          let pos = 0;
          // not sure if this magic is a good idea: for all notes we
          // put initial cursor at the beginning except for scratch notes
          // where we put it at the end
          // this could be confusing for users
          if (this.noteName.startsWith("scratch")) {
            pos = this.view.state.doc.length;
          }
          // console.log("setContent: setting pos:", pos);
          this.view.dispatch({
            selection: EditorSelection.single(pos),
            scrollIntoView: true,
          });
        }

        let ranges = noteMeta?.foldedRanges || [];
        if (len(ranges) > 0) {
          // console.log("setContent: restoring folded ranges:", ranges);
          try {
            this.view.dispatch({
              effects: ranges.map((range) => foldEffect.of(range)),
            });
          } catch (e) {
            console.error("setContent: error restoring folded ranges:", e);
            // if we fail to restore folded ranges, just clear them
            unfoldEverything(this)(this.view);
          }
        }
        resolve();
      });
    });
  }

  async saveFoldedState() {
    let meta = getNoteMeta(this.noteName, true);
    let didChange = false;
    let foldedRanges = getFoldedRanges(this.view);
    if (!objectEqualDeep(meta.foldedRanges, foldedRanges)) {
      didChange = true;
      meta.foldedRanges = foldedRanges;
    }
    let selection = this.view.state.selection.toJSON();
    if (!objectEqualDeep(meta.selection, selection)) {
      didChange = true;
      meta.selection = selection;
    }
    if (!didChange) {
      // console.log("saveFoldedState: skipping save, no changes");
      return;
    }
    // console.log(
    //   "saveFoldedState: saving selection:",
    //   meta.selection,
    //   "folededState:",
    //   foldedRanges,
    // );
    await saveNotesMetadata();
  }

  getBlocks() {
    // @ts-ignore
    return this.view.state.facet(blockState);
  }

  getCursorPosition() {
    return this.view.state.selection.main.head;
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
      annotations: [
        heynoteEvent.of(SET_FONT),
        Transaction.addToHistory.of(false),
      ],
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

  setLineNumberGutter(show) {
    this.view.dispatch({
      effects: this.lineNumberCompartment.reconfigure(
        show ? [lineNumbers(), blockLineNumbers] : [],
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

  setDefaultBlockLanguage(token, autoDetect) {
    this.defaultBlockToken = token || "text";
    this.defaultBlockAutoDetect = autoDetect === undefined ? true : autoDetect;
  }

  didLoadCurrencies() {
    triggerCurrenciesLoaded(this.view);
  }

  setBracketClosing(value) {
    this.view.dispatch({
      effects: this.closeBracketsCompartment.reconfigure(
        value ? createDynamicCloseBracketsExtension() : [],
      ),
    });
  }

  setTabsState(tabsAsSpaces, tabSpaces) {
    if (!this.view) return;
    const indentChar = tabsAsSpaces ? " ".repeat(tabSpaces) : "\t";
    const v = indentUnit.of(indentChar);
    this.view.dispatch({
      effects: this.tabsCompartment.reconfigure(v),
    });
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

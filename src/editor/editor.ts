import { markdown, markdownKeymap } from "@codemirror/lang-markdown";
import { ensureSyntaxTree, foldEffect, indentUnit } from "@codemirror/language";
import { Compartment, EditorSelection, EditorState, Prec, Transaction } from "@codemirror/state";
import { keymap as cmKeymap, drawSelection, EditorView, lineNumbers } from "@codemirror/view";
import { getNoteMeta, saveNotesMetadata } from "../metadata";
import { loadNote, saveNote } from "../notes";
import { findEditorByView } from "../state";
import { len, objectEqualDeep } from "../util";
import { heynoteEvent, SET_CONTENT, SET_FONT } from "./annotation";
import { blockLineNumbers, blockState, noteBlockExtension } from "./block/block";
import { triggerCurrenciesLoaded } from "./block/commands";
import { focusEditorView, getFoldedRanges, isReadOnly } from "./cmutils";
import { heynoteCopyCut } from "./copy-paste";
import { emacsKeymap } from "./emacs";
import { createDynamicCloseBracketsExtension } from "./extensions";
import { foldGutterExtension, unfoldEverything } from "./fold-gutter";
import { ednaKeymap } from "./keymap";
import { heynoteLang } from "./lang-heynote/heynote";
import { languageDetection } from "./language-detection/autodetect";
import { links } from "./links";
import { autoSaveContent } from "./save";
import { customSetup } from "./setup";
import { heynoteBase } from "./theme/base";
import { heynoteDark } from "./theme/dark";
import { getFontTheme } from "./theme/font-theme";
import { heynoteLight } from "./theme/light";
import { todoCheckboxPlugin } from "./todo-checkbox";

function getKeymapExtensions(editor: EdnaEditor, keymap: string) {
  if (keymap === "emacs") {
    return emacsKeymap(editor);
  } else {
    return ednaKeymap(editor);
  }
}

interface EdnaEditorConfig {
  element: HTMLElement;
  noteName: string;
  focus?: boolean;
  theme?: "light" | "dark";
  keymap?: "default" | "emacs";
  emacsMetaKey?: "alt" | "meta" | "ctrl";
  showLineNumberGutter?: boolean;
  showFoldGutter?: boolean;
  bracketClosing?: boolean;
  useTabs: boolean;
  tabSize: number;
  defaultBlockToken?: string;
  defaultBlockAutoDetect?: boolean;
  fontFamily?: string;
  fontSize?: number;
}

export class EdnaEditor {
  element: HTMLElement;
  themeCompartment: Compartment;
  keymapCompartment: Compartment;
  lineNumberCompartmentPre: Compartment;
  lineNumberCompartment: Compartment;
  foldGutterCompartment: Compartment;
  readOnlyCompartment: Compartment;
  closeBracketsCompartment: Compartment;
  tabsCompartment: Compartment;
  deselectOnCopy: boolean;
  emacsMetaKey: string;
  fontTheme: Compartment;
  noteName: string;
  contentLoaded: boolean;
  view: EditorView;
  loadNotePromise: Promise<void>;
  diskContent: string = "";
  defaultBlockToken: string = "";
  defaultBlockAutoDetect: boolean = false;
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
    useTabs,
    tabSize,
    defaultBlockToken,
    defaultBlockAutoDetect,
    fontFamily,
    fontSize,
  }: EdnaEditorConfig) {
    this.element = element;
    this.themeCompartment = new Compartment();
    this.keymapCompartment = new Compartment();
    this.lineNumberCompartmentPre = new Compartment();
    this.lineNumberCompartment = new Compartment();
    this.foldGutterCompartment = new Compartment();
    this.readOnlyCompartment = new Compartment();
    this.closeBracketsCompartment = new Compartment();
    this.tabsCompartment = new Compartment();
    this.deselectOnCopy = keymap === "emacs";
    this.emacsMetaKey = emacsMetaKey;
    this.fontTheme = new Compartment();
    this.setDefaultBlockLanguage(defaultBlockToken, defaultBlockAutoDetect);
    this.noteName = noteName;
    this.contentLoaded = false;

    const makeTabState = (useTabs: boolean, tabSize: number) => {
      const indentChar = useTabs ? "\t" : " ".repeat(tabSize);
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
        this.lineNumberCompartment.of(showLineNumberGutter ? [lineNumbers(), blockLineNumbers] : []),
        customSetup,
        this.foldGutterCompartment.of(showFoldGutter ? [foldGutterExtension()] : []),

        this.closeBracketsCompartment.of(bracketClosing ? createDynamicCloseBracketsExtension() : []),

        this.readOnlyCompartment.of([]),

        this.themeCompartment.of(theme === "dark" ? heynoteDark : heynoteLight),
        heynoteBase,
        this.fontTheme.of(getFontTheme(fontFamily, fontSize)),
        makeTabState(useTabs, tabSize),
        EditorView.scrollMargins.of((f) => {
          return { top: 80, bottom: 80 };
        }),
        heynoteLang(),
        noteBlockExtension(this),
        languageDetection(() => this.view),

        // set cursor blink rate to 1 second
        drawSelection({ cursorBlinkRate: 1000 }),

        // add CSS class depending on dark/light theme
        EditorView.editorAttributes.of((view: EditorView) => {
          return {
            class: view.state.facet(EditorView.darkTheme) ? "dark-theme" : "light-theme",
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

  async loadNote(noteName: string) {
    //console.log("loadNote:", noteName)
    this.noteName = noteName;
    this.setReadOnly(true);
    // TODO: show a message
    const content = (await loadNote(noteName)) || "";
    this.diskContent = content;
    await this.setContent(content);
    this.contentLoaded = true;
    this.setReadOnly(false);
  }

  setContent(content: string) {
    return new Promise<void>((resolve) => {
      // set buffer content
      this.view.dispatch({
        changes: {
          from: 0,
          to: this.view.state.doc.length,
          insert: content,
        },
        annotations: [heynoteEvent.of(SET_CONTENT), Transaction.addToHistory.of(false)],
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
    return this.view.state.field(blockState);
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

  setReadOnly(readOnly: boolean) {
    this.view.dispatch({
      effects: this.readOnlyCompartment.reconfigure(readOnly ? [EditorState.readOnly.of(true)] : []),
    });
  }

  setFont(fontFamily: string, fontSize: number) {
    let ff = getFontTheme(fontFamily, fontSize);
    this.view.dispatch({
      effects: this.fontTheme.reconfigure(ff),
      annotations: [heynoteEvent.of(SET_FONT), Transaction.addToHistory.of(false)],
    });
  }

  setTheme(theme: string) {
    this.view.dispatch({
      effects: this.themeCompartment.reconfigure(theme === "dark" ? heynoteDark : heynoteLight),
    });
  }

  setKeymap(keymap: string, emacsMetaKey: string) {
    this.deselectOnCopy = keymap === "emacs";
    this.emacsMetaKey = emacsMetaKey;
    this.view.dispatch({
      effects: this.keymapCompartment.reconfigure(getKeymapExtensions(this, keymap)),
    });
  }

  setLineNumberGutter(show: boolean) {
    this.view.dispatch({
      effects: this.lineNumberCompartment.reconfigure(show ? [lineNumbers(), blockLineNumbers] : []),
    });
  }

  setFoldGutter(show: boolean) {
    this.view.dispatch({
      effects: this.foldGutterCompartment.reconfigure(show ? [foldGutterExtension()] : []),
    });
  }

  setDefaultBlockLanguage(token: string, autoDetect?: boolean) {
    this.defaultBlockToken = token || "text";
    this.defaultBlockAutoDetect = autoDetect === undefined ? true : autoDetect;
  }

  didLoadCurrencies() {
    triggerCurrenciesLoaded(this.view);
  }

  setBracketClosing(value: boolean) {
    this.view.dispatch({
      effects: this.closeBracketsCompartment.reconfigure(value ? createDynamicCloseBracketsExtension() : []),
    });
  }

  setTabsState(useTabs: boolean, tabSpaces: number) {
    if (!this.view) return;
    const indentChar = useTabs ? "\t" : " ".repeat(tabSpaces);
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

export function setReadOnly(view: EditorView, ro: boolean) {
  let editor = findEditorByView(view);
  if (editor) {
    editor.setReadOnly(ro);
  }
}

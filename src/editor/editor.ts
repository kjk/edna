import { markdown, markdownKeymap } from "@codemirror/lang-markdown";
import { ensureSyntaxTree, foldEffect, indentUnit } from "@codemirror/language";
import { Compartment, EditorSelection, EditorState, Prec, Transaction } from "@codemirror/state";
import { keymap as cmKeymap, drawSelection, EditorView, lineNumbers } from "@codemirror/view";
import { len } from "../util";
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
  save: (content: string) => Promise<void>;
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
  saveCallback: (content: string) => Promise<void>;
  view: EditorView;
  diskContent: string = "";
  defaultBlockToken: string = "";
  defaultBlockAutoDetect: boolean = false;
  constructor({
    element,
    save,
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
    this.saveCallback = save;
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

    if (focus) {
      this.view.focus();
    }
  }

  async save() {
    const content = this.getContent();
    if (content === this.diskContent) {
      return;
    }
    this.diskContent = content;
    await this.saveCallback(content);
  }

  getContent() {
    return this.view.state.sliceDoc();
  }

  setContent(content: string) {
    this.diskContent = content;
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
  }

  getSelectionJSON() {
    return this.view.state.selection.toJSON();
  }

  setSelection(savedSelection: unknown, defaultPos: number = 0) {
    if (savedSelection) {
      try {
        this.view.dispatch({
          selection: EditorSelection.fromJSON(savedSelection),
          scrollIntoView: true,
        });
        return;
      } catch (e) {
        // if we fail to restore selection, fall through to default
      }
    }
    this.view.dispatch({
      selection: EditorSelection.single(defaultPos),
      scrollIntoView: true,
    });
  }

  getFoldedRanges() {
    return getFoldedRanges(this.view);
  }

  setFoldedRanges(ranges: Array<{ from: number; to: number }>) {
    if (len(ranges) === 0) {
      return;
    }
    try {
      this.view.dispatch({
        effects: ranges.map((range) => foldEffect.of(range)),
      });
    } catch (e) {
      console.error("setFoldedRanges: error restoring folded ranges:", e);
      unfoldEverything(this)(this.view);
    }
  }

  getBlocks() {
    return this.view.state.field(blockState);
  }

  getCursorPosition() {
    return this.view.state.selection.main.head;
  }

  setCursorPosition(position: number) {
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

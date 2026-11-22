import { markdown, markdownKeymap } from "@codemirror/lang-markdown";
import { ensureSyntaxTree, foldEffect } from "@codemirror/language";
import { Compartment, EditorSelection, EditorState, Prec, Transaction } from "@codemirror/state";
import { keymap as cmKeymap, drawSelection, EditorView, lineNumbers } from "@codemirror/view";
import { heynoteEvent, SET_CONTENT, SET_FONT } from "./annotation";
import { blockLineNumbers, blockState, noteBlockExtension } from "./block/block";
import { defaultBlockDelimiter, getBlockDelimiter, triggerCurrenciesLoaded } from "./block/commands";
import { focusEditorView, getFoldedRanges, isReadOnly } from "./cmutils";
import { colorPreviewExtension } from "./color-preview";
import { scrollMargin } from "./scroll-margin";
import { heynoteCopyCut } from "./copy-paste";
import { emacsKeymap } from "./emacs";
import { createDynamicCloseBracketsExtension } from "./extensions";
import { indentationExtension } from "./indentation";
import { foldGutterExtension, moveSelectionOutOfNewFolds, unfoldEverything } from "./fold-gutter";
import { ednaKeymap, keymapFromSpec } from "./keymap";
import { multiBlock } from "./new-parser/language";
import { languageDetection } from "./language-detection/autodetect";
import { links } from "./links";
import { autoSaveContent } from "./save";
import { customSetup, type CreateFindPanelFn } from "./setup";
import { heynoteBase } from "./theme/base";
import { heynoteDark } from "./theme/dark";
import { getFontTheme } from "./theme/font-theme";
import { heynoteLight } from "./theme/light";
import { todoCheckboxPlugin } from "./todo-checkbox";
import type { SimpleRange } from "./types";

// Keymap spec type for external keybindings
export type KeymapSpec = Array<[string, () => void] | { key: string; run: () => void; shift?: () => void }>;

function getKeymapExtensions(editor: MultiBlockEditor, keymap: string, extraKeymap?: KeymapSpec) {
  const baseKeymap = keymap === "emacs" ? emacsKeymap(editor) : ednaKeymap(editor);
  if (extraKeymap && extraKeymap.length > 0) {
    return [baseKeymap, keymapFromSpec(extraKeymap)];
  }
  return baseKeymap;
}

interface MultiBlockEditorConfig {
  element: HTMLElement;
  save: (content: string) => Promise<void>;
  setIsDirty: (dirty: boolean) => void;
  createFindPanel: CreateFindPanelFn;
  extraKeymap?: KeymapSpec;
  focus?: boolean;
  theme?: "light" | "dark";
  keymap?: "default" | "emacs";
  emacsMetaKey?: "alt" | "meta" | "ctrl";
  showLineNumberGutter?: boolean;
  showFoldGutter?: boolean;
  bracketClosing?: boolean;
  showColorPreview?: boolean;
  useTabs: boolean;
  tabSize: number;
  defaultBlockToken?: string;
  defaultBlockAutoDetect?: boolean;
  fontFamily?: string;
  fontSize?: number;
}

export class MultiBlockEditor {
  element: HTMLElement;
  themeCompartment: Compartment;
  keymapCompartment: Compartment;
  lineNumberCompartmentPre: Compartment;
  lineNumberCompartment: Compartment;
  foldGutterCompartment: Compartment;
  readOnlyCompartment: Compartment;
  defaultBlockCompartment: Compartment;
  colorPreviewCompartment: Compartment;
  closeBracketsCompartment: Compartment;
  tabsCompartment: Compartment;
  deselectOnCopy: boolean;
  emacsMetaKey: string;
  fontTheme: Compartment;
  saveCallback: (content: string) => Promise<void>;
  setIsDirtyCallback: (dirty: boolean) => void;
  extraKeymapSpec: KeymapSpec;
  view: EditorView;
  // content last successfully saved (or loaded) for the current document
  diskContent: string = "";
  // incremented by setContent(); a save started for an earlier document must
  // not update diskContent / dirty state of the current one
  contentGen: number = 0;
  defaultBlockToken: string = "";
  defaultBlockAutoDetect: boolean = false;
  constructor({
    element,
    save,
    setIsDirty,
    createFindPanel,
    extraKeymap,
    focus = true,
    theme = "light",
    keymap = "default",
    emacsMetaKey,
    showLineNumberGutter = true,
    showFoldGutter = true,
    bracketClosing = false,
    showColorPreview = true,
    useTabs,
    tabSize,
    defaultBlockToken,
    defaultBlockAutoDetect,
    fontFamily,
    fontSize,
  }: MultiBlockEditorConfig) {
    this.element = element;
    this.saveCallback = save;
    this.setIsDirtyCallback = setIsDirty;
    this.themeCompartment = new Compartment();
    this.keymapCompartment = new Compartment();
    this.lineNumberCompartmentPre = new Compartment();
    this.lineNumberCompartment = new Compartment();
    this.foldGutterCompartment = new Compartment();
    this.readOnlyCompartment = new Compartment();
    this.defaultBlockCompartment = new Compartment();
    this.colorPreviewCompartment = new Compartment();
    this.closeBracketsCompartment = new Compartment();
    this.tabsCompartment = new Compartment();
    this.deselectOnCopy = keymap === "emacs";
    this.emacsMetaKey = emacsMetaKey || "alt";
    this.fontTheme = new Compartment();
    this.extraKeymapSpec = extraKeymap || [];
    this.setDefaultBlockLanguage(defaultBlockToken || "text", defaultBlockAutoDetect);

    const makeTabState = (useTabs: boolean, tabSize: number) => {
      return this.tabsCompartment.of(indentationExtension(useTabs, tabSize));
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
        this.keymapCompartment.of(getKeymapExtensions(this, keymap, this.extraKeymapSpec)),
        heynoteCopyCut(this),

        //minimalSetup,
        this.lineNumberCompartment.of(showLineNumberGutter ? [blockLineNumbers] : []),
        customSetup(createFindPanel),
        this.foldGutterCompartment.of(showFoldGutter ? [foldGutterExtension()] : []),
        moveSelectionOutOfNewFolds,

        this.closeBracketsCompartment.of(bracketClosing ? createDynamicCloseBracketsExtension() : []),
        this.colorPreviewCompartment.of(showColorPreview ? colorPreviewExtension : []),

        this.readOnlyCompartment.of([]),
        this.defaultBlockCompartment.of(
          defaultBlockDelimiter.of(getBlockDelimiter(this.defaultBlockToken, this.defaultBlockAutoDetect)),
        ),

        this.themeCompartment.of(theme === "dark" ? heynoteDark : heynoteLight),
        heynoteBase,
        this.fontTheme.of(getFontTheme(fontFamily || "", fontSize || 14)),
        makeTabState(useTabs, tabSize),
        scrollMargin(),
        multiBlock(),
        noteBlockExtension(this),
        languageDetection,

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

  // destroys the view and its plugins (saves pending changes,
  // terminates language detection worker)
  destroy() {
    this.view.destroy();
  }

  // Saves current content if it changed. Note: saveCallback() is called
  // synchronously so it can capture which note is being saved.
  // On failure diskContent is not updated so the next save() retries.
  async save() {
    const content = this.getContent();
    if (content === this.diskContent) {
      return;
    }
    const gen = this.contentGen;
    await this.saveCallback(content);
    if (gen !== this.contentGen) {
      // a different document was loaded in the meantime
      return;
    }
    this.diskContent = content;
    // the user might have typed while we were saving
    this.setIsDirtyCallback(this.getContent() !== this.diskContent);
  }

  getContent() {
    return this.view.state.sliceDoc();
  }

  setContent(content: string) {
    this.contentGen++;
    this.diskContent = content;
    this.setIsDirtyCallback(false);
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

  setFoldedRanges(ranges: SimpleRange[]) {
    if (ranges.length === 0) {
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
      effects: this.keymapCompartment.reconfigure(getKeymapExtensions(this, keymap, this.extraKeymapSpec)),
    });
  }

  setLineNumberGutter(show: boolean) {
    this.view.dispatch({
      effects: this.lineNumberCompartment.reconfigure(show ? [blockLineNumbers] : []),
    });
  }

  setColorPreview(show: boolean) {
    this.view.dispatch({
      effects: this.colorPreviewCompartment.reconfigure(show ? colorPreviewExtension : []),
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
    // view doesn't exist yet when called from the constructor
    this.view?.dispatch({
      effects: this.defaultBlockCompartment.reconfigure(
        defaultBlockDelimiter.of(getBlockDelimiter(this.defaultBlockToken, this.defaultBlockAutoDetect)),
      ),
    });
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
    this.view.dispatch({
      effects: this.tabsCompartment.reconfigure(indentationExtension(useTabs, tabSpaces)),
    });
  }
}

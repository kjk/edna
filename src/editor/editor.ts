import { history } from "@codemirror/commands";
import { foldEffect, unfoldEffect } from "@codemirror/language";
import { Compartment, EditorSelection, EditorState, Prec, Transaction, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { heynoteEvent, SET_CONTENT, SET_FONT } from "./annotation";
import { blockLineNumbers, getBlocks, getNoteBlockFromPos, noteBlockExtension } from "./block/block";
import { defaultBlockDelimiter, getBlockDelimiter, triggerCurrenciesLoaded } from "./block/commands";
import { focusEditorView, getFoldedRanges, isReadOnly } from "./cmutils";
import { colorPreviewExtension } from "./color-preview";
import { heynoteCopyCut } from "./copy-paste";
import { emacsKeymap, setEmacsMarkMode } from "./emacs";
import { createDynamicCloseBracketsExtension, markdownSelectionWrapping } from "./extensions";
import { foldGutterExtension, moveSelectionOutOfNewFolds } from "./fold-gutter";
import { indentationExtension } from "./indentation";
import { ednaKeymap, keymapFromSpec } from "./keymap";
import { languageDetection } from "./language-detection/autodetect";
import { links } from "./links";
import { multiBlock } from "./new-parser/language";
import { autoSaveContent } from "./save";
import { scrollMargin } from "./scroll-margin";
import { customSetup, type CreateFindPanelFn } from "./setup";
import { heynoteBase } from "./theme/base";
import { heynoteDark } from "./theme/dark";
import { getFontTheme } from "./theme/font-theme";
import { heynoteLight } from "./theme/light";
import { todoCheckboxPlugin } from "./todo-checkbox";
import type { SimpleRange } from "./types";

export type KeymapSpec = Array<
  | [string, () => void]
  | {
      key: string;
      run: () => void;
      shift?: () => void;
    }
>;

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
  themeCompartment = new Compartment();
  keymapCompartment = new Compartment();
  lineNumberCompartment = new Compartment();
  foldGutterCompartment = new Compartment();
  readOnlyCompartment = new Compartment();
  defaultBlockCompartment = new Compartment();
  colorPreviewCompartment = new Compartment();
  closeBracketsCompartment = new Compartment();
  tabsCompartment = new Compartment();
  fontTheme = new Compartment();
  deselectOnCopy: boolean;
  emacsMetaKey: string;
  saveCallback: (content: string) => Promise<void>;
  setIsDirtyCallback: (dirty: boolean) => void;
  extraKeymapSpec: KeymapSpec;
  view: EditorView;
  diskContent: string;
  contentGen = 0;
  defaultBlockToken: string;
  defaultBlockAutoDetect: boolean;
  private historyCompartment = new Compartment();
  private pendingSave: { generation: number; content: string; promise: Promise<void> } | undefined;
  private autosave: ReturnType<typeof autoSaveContent>;
  private destroyed = false;

  constructor({
    element,
    save,
    setIsDirty,
    createFindPanel,
    extraKeymap = [],
    focus = true,
    theme = "light",
    keymap = "default",
    emacsMetaKey = "alt",
    showLineNumberGutter = true,
    showFoldGutter = true,
    bracketClosing = false,
    showColorPreview = true,
    useTabs,
    tabSize,
    defaultBlockToken = "text",
    defaultBlockAutoDetect = true,
    fontFamily = "",
    fontSize = 0,
  }: MultiBlockEditorConfig) {
    this.element = element;
    this.saveCallback = save;
    this.setIsDirtyCallback = setIsDirty;
    this.extraKeymapSpec = extraKeymap;
    this.emacsMetaKey = emacsMetaKey;
    this.deselectOnCopy = keymap === "emacs";
    this.defaultBlockToken = defaultBlockToken || "text";
    this.defaultBlockAutoDetect = defaultBlockAutoDetect;
    this.diskContent = "";
    this.autosave = autoSaveContent(this, 2000);
    const state = EditorState.create({
      doc: this.diskContent,
      extensions: [
        multiBlock(),
        noteBlockExtension(this),
        customSetup(createFindPanel),
        this.historyCompartment.of(history()),
        moveSelectionOutOfNewFolds,
        this.lineNumberCompartment.of(showLineNumberGutter ? blockLineNumbers : []),
        this.foldGutterCompartment.of(showFoldGutter ? foldGutterExtension() : []),
        heynoteBase,
        this.themeCompartment.of(theme === "dark" ? heynoteDark : heynoteLight),
        this.fontTheme.of(getFontTheme(fontFamily, fontSize)),
        this.keymapCompartment.of(this.bindings(keymap)),
        this.readOnlyCompartment.of([]),
        this.defaultBlockCompartment.of(
          defaultBlockDelimiter.of(getBlockDelimiter(this.defaultBlockToken, defaultBlockAutoDetect)),
        ),
        this.closeBracketsCompartment.of(bracketClosing ? createDynamicCloseBracketsExtension() : []),
        this.colorPreviewCompartment.of(showColorPreview ? colorPreviewExtension : []),
        this.tabsCompartment.of(indentationExtension(useTabs, tabSize)),
        markdownSelectionWrapping,
        heynoteCopyCut(this),
        scrollMargin(),
        languageDetection,
        links,
        todoCheckboxPlugin,
        this.autosave,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            this.element.dispatchEvent(new Event("docChanged"));
          }
        }),
      ],
    });
    this.view = new EditorView({ state, parent: element });
    if (focus) {
      this.focus();
    }
  }

  private bindings(name: string): Extension {
    return [
      name === "emacs" ? emacsKeymap(this) : [],
      Prec.high(keymapFromSpec(this.extraKeymapSpec)),
      ednaKeymap(this),
    ];
  }

  destroy(): void {
    if (!this.destroyed) {
      this.destroyed = true;
      this.view.destroy();
    }
  }

  async save(): Promise<void> {
    const generation = this.contentGen;
    const content = this.getContent();
    const pending = this.pendingSave;
    if (pending?.generation === generation) {
      await pending.promise;
      if (pending.content !== content && generation === this.contentGen) {
        await this.save();
      }
      return;
    }
    if (content === this.diskContent) {
      return;
    }

    // Invoke before yielding. The app callback captures the currently loaded
    // note and the disk version that it should compare before writing.
    const promise = this.saveCallback(content).then(() => {
      if (generation === this.contentGen) {
        this.diskContent = content;
        const dirty = this.getContent() !== content;
        this.setIsDirtyCallback(dirty);
        if (dirty && !this.destroyed) {
          this.view.plugin(this.autosave)?.scheduleIfDirty();
        }
      }
    });
    this.pendingSave = { generation, content, promise };
    try {
      await promise;
    } finally {
      if (this.pendingSave?.promise === promise) {
        this.pendingSave = undefined;
      }
    }
  }

  getContent(): string {
    return this.view.state.doc.toString();
  }

  setContent(content: string): void {
    const text = this.view.state.toText(content);
    this.contentGen++;
    this.diskContent = text.toString();
    setEmacsMarkMode(false);
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: text },
      selection: { anchor: 0 },
      effects: [
        ...this.getFoldedRanges().map((range) => unfoldEffect.of(range)),
        this.historyCompartment.reconfigure([]),
      ],
      annotations: [heynoteEvent.of(SET_CONTENT), Transaction.addToHistory.of(false)],
    });
    this.view.dispatch({ effects: this.historyCompartment.reconfigure(history()) });
    this.setIsDirtyCallback(false);
  }

  getSelectionJSON() {
    return this.view.state.selection.toJSON();
  }

  setSelection(savedSelection: unknown, defaultPos = 0): void {
    let selection: EditorSelection;
    try {
      selection = EditorSelection.fromJSON(savedSelection);
      if (
        !Number.isInteger(selection.mainIndex) ||
        selection.mainIndex < 0 ||
        selection.mainIndex >= selection.ranges.length ||
        selection.ranges.some(({ from, to }) => !this.validPosition(from) || !this.validPosition(to))
      ) {
        throw new RangeError("Invalid saved selection");
      }
      selection = EditorSelection.create(selection.ranges, selection.mainIndex);
    } catch {
      selection = EditorSelection.create([EditorSelection.cursor(this.validPosition(defaultPos) ? defaultPos : 0)]);
    }
    this.view.dispatch({ selection, scrollIntoView: true, annotations: Transaction.addToHistory.of(false) });
  }

  getFoldedRanges(): SimpleRange[] {
    return getFoldedRanges(this.view);
  }

  setFoldedRanges(ranges: SimpleRange[]): void {
    const { state } = this.view;
    const valid = ranges.filter((range) => {
      if (!range || !this.validPosition(range.from) || !this.validPosition(range.to) || range.from >= range.to) {
        return false;
      }
      const block = getNoteBlockFromPos(state, range.from);
      return block && range.from >= block.contentFrom && range.to <= block.to;
    });
    this.view.dispatch({
      effects: [
        ...this.getFoldedRanges().map((range) => unfoldEffect.of(range)),
        ...valid.map((range) => foldEffect.of(range)),
      ],
      annotations: Transaction.addToHistory.of(false),
    });
  }

  getBlocks() {
    return getBlocks(this.view.state);
  }

  getCursorPosition(): number {
    return this.view.state.selection.main.head;
  }

  setCursorPosition(position: number): void {
    this.setSelection({ ranges: [{ head: position, anchor: position }], main: 0 });
  }

  private validPosition(position: number): boolean {
    return Number.isInteger(position) && position >= 0 && position <= this.view.state.doc.length;
  }

  focus(): void {
    focusEditorView(this.view);
  }

  isReadOnly(): boolean {
    return isReadOnly(this.view);
  }

  setReadOnly(readOnly: boolean): void {
    this.reconfigure(this.readOnlyCompartment, EditorState.readOnly.of(readOnly));
  }

  setFont(fontFamily: string, fontSize: number): void {
    this.view.dispatch({
      effects: this.fontTheme.reconfigure(getFontTheme(fontFamily, fontSize)),
      annotations: heynoteEvent.of(SET_FONT),
    });
  }

  setTheme(theme: string): void {
    this.reconfigure(this.themeCompartment, theme === "dark" ? heynoteDark : heynoteLight);
  }

  setKeymap(keymap: string, emacsMetaKey: string): void {
    setEmacsMarkMode(false);
    this.emacsMetaKey = emacsMetaKey;
    this.deselectOnCopy = keymap === "emacs";
    this.reconfigure(this.keymapCompartment, this.bindings(keymap));
  }

  setLineNumberGutter(show: boolean): void {
    this.reconfigure(this.lineNumberCompartment, show ? blockLineNumbers : []);
  }

  setColorPreview(show: boolean): void {
    this.reconfigure(this.colorPreviewCompartment, show ? colorPreviewExtension : []);
  }

  setFoldGutter(show: boolean): void {
    this.reconfigure(this.foldGutterCompartment, show ? foldGutterExtension() : []);
  }

  setDefaultBlockLanguage(token: string, autoDetect = true): void {
    this.defaultBlockToken = token || "text";
    this.defaultBlockAutoDetect = autoDetect;
    this.reconfigure(
      this.defaultBlockCompartment,
      defaultBlockDelimiter.of(getBlockDelimiter(this.defaultBlockToken, autoDetect)),
    );
  }

  didLoadCurrencies(): void {
    triggerCurrenciesLoaded(this.view);
  }

  setBracketClosing(value: boolean): void {
    this.reconfigure(this.closeBracketsCompartment, value ? createDynamicCloseBracketsExtension() : []);
  }

  setTabsState(useTabs: boolean, tabSpaces: number): void {
    this.reconfigure(this.tabsCompartment, indentationExtension(useTabs, tabSpaces));
  }

  private reconfigure(compartment: Compartment, extension: Extension): void {
    this.view.dispatch({ effects: compartment.reconfigure(extension) });
  }
}

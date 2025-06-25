import { markdown } from "@codemirror/lang-markdown";
import { indentUnit } from "@codemirror/language";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import { drawSelection, EditorView, lineNumbers } from "@codemirror/view";
import { findEditorByView } from "../state.js";
import { heynoteEvent, SET_CONTENT, SET_FONT } from "./annotation.js";
import {
  blockLineNumbers,
  blockState,
  noteBlockExtension,
} from "./block/block.js";
import { focusEditorView, isReadOnly } from "./cmutils.js";
import { heynoteCopyCut } from "./copy-paste";
import { emacsKeymap } from "./emacs.js";
import { createDynamicCloseBracketsExtension } from "./extensions.js";
import { foldGutterExtension } from "./fold-gutter.js";
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
    content,
    focus = true,
    theme = "light",
    saveFunction = null,
    keymap = "default",
    emacsMetaKey,
    showLineNumberGutter = true,
    showFoldGutter = true,
    bracketClosing = false,
    spacesPerTab = 2,
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
    this.saveFunction = saveFunction;
    this.tabsCompartment = new Compartment();

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
    this.createState = (content) => {
      const state = EditorState.create({
        doc: content || "",
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

          this.themeCompartment.of(
            theme === "dark" ? heynoteDark : heynoteLight,
          ),
          heynoteBase,
          this.fontTheme.of(getFontTheme(fontFamily, fontSize)),
          makeTabState(true, spacesPerTab),
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

          saveFunction ? autoSaveContent(saveFunction, 2000) : [],

          todoCheckboxPlugin,
          markdown(),
          links,
        ],
      });
      return state;
    };
    const state = this.createState(content);

    this.view = new EditorView({
      state: state,
      parent: element,
    });

    if (focus) {
      this.view.dispatch({
        selection: {
          anchor: this.view.state.doc.length,
          head: this.view.state.doc.length,
        },
        scrollIntoView: true,
      });
      this.view.focus();
    }
  }

  setTabsState(tabsAsSpaces, tabSpaces) {
    if (!this.view) return;
    const indentChar = tabsAsSpaces ? " ".repeat(tabSpaces) : "\t";
    const v = indentUnit.of(indentChar);
    this.view.dispatch({
      effects: this.tabsCompartment.reconfigure(v),
    });
  }

  getContent() {
    return getContent(this.view);
  }

  setContent(content) {
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
    this.view.dispatch({
      selection: {
        anchor: this.view.state.doc.length,
        head: this.view.state.doc.length,
      },
      scrollIntoView: true,
    });
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

  setBracketClosing(value) {
    this.view.dispatch({
      effects: this.closeBracketsCompartment.reconfigure(
        value ? createDynamicCloseBracketsExtension() : [],
      ),
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

/**
 * @param {EditorView} view
 * @return {string}
 */
export function getContent(view) {
  return view.state.sliceDoc();
}

import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { findEditorByView } from "../../state.js";
import {
  getLanguage,
  langGetPrettierInfo,
  langSupportsFormat,
} from "../languages.js";
import { getActiveNoteBlock } from "./block.js";

/**
 * @param {string} s
 * @returns {Promise<string>}
 */
async function formatGo(s) {
  // setProcessingMessage("Formatting code...");
  // const uri = "play.golang.org/fmt";
  const uri = "/api/goplay/fmt";
  const rsp = await fetch(uri, {
    method: "POST",
    body: s,
  });
  // clearProcessingMessage();
  if (!rsp.ok) {
    //   setErrorMessage("Error:" + (await rsp.text()));
    return null;
  }
  const res = await rsp.json();
  if (res.Error) {
    //   setErrorMessage("Error:" + res.Error);
    return null;
  }
  if (res.Body === s) {
    return null;
  }
  return res.Body;
}

/**
 * @param {EditorView} view
 * @returns {Promise<boolean>}
 */
export async function formatBlockContent(view) {
  const { state } = view;
  if (state.readOnly) return false;
  const block = getActiveNoteBlock(state);
  console.log("formatBlockContent:", block);
  const language = getLanguage(block.language.name);
  if (!langSupportsFormat(language)) {
    return false;
  }

  const cursorPos = state.selection.asSingle().ranges[0].head;
  const content = state.sliceDoc(block.content.from, block.content.to);

  // console.log("prettier supports:", getSupportInfo());
  let editor = findEditorByView(view);
  if (language.token == "golang") {
    // formatGo() is async so we need to prevent changes to the state of the editor
    // we make it read-only
    // TODO: maybe show some indication that we're doing an operation
    let s;
    try {
      editor.setReadOnly(true);
      s = await formatGo(content);
    } catch (e) {
      console.log("error formatting go:", e);
      return false;
    } finally {
      editor.setReadOnly(false);
    }

    if (!s) {
      console.log("failed to format go");
      return false;
    }
    // console.log("formatted go:", s)
    // console.log("block:", block)
    let cursorOffset = cursorPos - block.content.from;
    // console.log("cursorOffset:", cursorOffset)
    // TODO: this probably might fail. For some reason during formatGo()
    // view.state is changed so we might be updating incorrect part
    // would have to disable
    const tr = view.state.update(
      {
        changes: {
          from: block.content.from,
          to: block.content.to,
          insert: s,
        },
        selection: EditorSelection.cursor(
          block.content.from + Math.min(cursorOffset, s.length),
        ),
      },
      {
        userEvent: "input",
        scrollIntoView: true,
      },
    );
    console.log("state == view.state:", state == view.state);
    console.log("state == tr.startState:", state == tr.startState);
    view.dispatch(tr);
    return true;
  }

  console.log("formatting with prettier");
  // There is a performance bug in prettier causing formatWithCursor() to be extremely slow in some cases (https://github.com/prettier/prettier/issues/4801)
  // To work around this we use format() when the cursor is in the beginning or the end of the block.
  // This is not a perfect solution, and once the following PR is merged and released, we should be abe to remove this workaround:
  // https://github.com/prettier/prettier/pull/15709
  let useFormat = false;
  if (cursorPos == block.content.from || cursorPos == block.content.to) {
    useFormat = true;
  }

  let prettier = await import("prettier/standalone");
  console.log("prettier:", prettier);
  const { parser, plugins } = await langGetPrettierInfo(language);

  let formattedContent;
  try {
    if (useFormat) {
      formattedContent = {
        formatted: await prettier.format(content, {
          parser: parser,
          plugins: plugins,
          tabWidth: state.tabSize,
        }),
        cursorOffset: 0,
      };
      formattedContent.cursorOffset =
        cursorPos == block.content.from ? 0 : formattedContent.formatted.length;
    } else {
      formattedContent = await prettier.formatWithCursor(content, {
        cursorOffset: cursorPos - block.content.from,
        parser: parser,
        plugins: plugins,
        tabWidth: state.tabSize,
      });
    }
  } catch (e) {
    const hyphens =
      "----------------------------------------------------------------------------";
    console.log(
      `Error when trying to format block:\n${hyphens}\n${e.message}\n${hyphens}`,
    );
    return false;
  }
  // console.log("formattedContent.formatted:", formattedContent.formatted);
  const tr = view.state.update(
    {
      changes: {
        from: block.content.from,
        to: block.content.to,
        insert: formattedContent.formatted,
      },
      selection: EditorSelection.cursor(
        block.content.from +
          Math.min(
            formattedContent.cursorOffset,
            formattedContent.formatted.length,
          ),
      ),
    },
    {
      userEvent: "input",
      scrollIntoView: true,
    },
  );
  view.dispatch(tr);
  return true;
}

/**
 * @param {EditorView} view
 * @param {string} text
 * @returns {boolean}
 */
export function insertAfterActiveBlock(view, text) {
  const { state } = view;
  if (state.readOnly) {
    return false;
  }
  const block = getActiveNoteBlock(state);
  let tr = view.state.update(
    {
      changes: {
        from: block.content.to,
        insert: text,
      },
      selection: EditorSelection.cursor(block.content.to + text.length),
    },
    {
      scrollIntoView: true,
      userEvent: "input",
    },
  );
  view.dispatch(tr);
}

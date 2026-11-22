import { EditorSelection } from "@codemirror/state";
import { getActiveNoteBlock } from "./editor/block/block";
import type { MultiBlockEditor } from "./editor/editor";
import { getLanguage, langGetPrettierInfo, langSupportsFormat } from "./editor/languages";

async function formatGo(s: string): Promise<string | null> {
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

export async function formatBlockContent(editor: MultiBlockEditor): Promise<boolean> {
  const view = editor.view;
  const { state } = view;
  if (state.readOnly) return false;
  const block = getActiveNoteBlock(state);
  if (!block) return false;
  const language = getLanguage(block.language);
  if (!language || !langSupportsFormat(language)) {
    return false;
  }

  const cursorPos = state.selection.asSingle().main.head;
  const content = state.sliceDoc(block.contentFrom, block.to);
  // block offsets are only valid for this document: the user can keep typing
  // or switch notes while we await the formatter (U11). Doc is immutable, so
  // the same object means no changes (and the same note)
  const docUnchanged = () => {
    if (view.state.doc === state.doc) {
      return true;
    }
    console.log("formatBlockContent: document changed while formatting, not applying");
    return false;
  };

  // console.log("prettier supports:", getSupportInfo());
  if (language.token == "golang") {
    // TODO: maybe show some indication that we're doing an operation
    let s;
    try {
      s = await formatGo(content);
    } catch (e) {
      console.log("error formatting go:", e);
      return false;
    }

    if (!s) {
      console.log("failed to format go");
      return false;
    }
    if (!docUnchanged()) {
      return false;
    }
    // console.log("formatted go:", s)
    // console.log("block:", block)
    let cursorOffset = cursorPos - block.contentFrom;
    // console.log("cursorOffset:", cursorOffset)
    const tr = view.state.update(
      {
        changes: {
          from: block.contentFrom,
          to: block.to,
          insert: s,
        },
        selection: EditorSelection.cursor(block.contentFrom + Math.min(cursorOffset, s.length)),
      },
      {
        userEvent: "input",
        scrollIntoView: true,
      },
    );
    view.dispatch(tr);
    return true;
  }

  // There is a performance bug in prettier causing formatWithCursor() to be extremely slow in some cases (https://github.com/prettier/prettier/issues/4801)
  // To work around this we use format() when the cursor is in the beginning or the end of the block.
  // This is not a perfect solution, and once the following PR is merged and released, we should be abe to remove this workaround:
  // https://github.com/prettier/prettier/pull/15709
  let useFormat = false;
  if (cursorPos == block.contentFrom || cursorPos == block.to) {
    useFormat = true;
  }

  let prettier = await import("prettier/standalone");
  const prettierInfo = await langGetPrettierInfo(language);
  if (!prettierInfo) return false;
  const { parser, plugins } = prettierInfo;

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
      formattedContent.cursorOffset = cursorPos == block.contentFrom ? 0 : formattedContent.formatted.length;
    } else {
      formattedContent = await prettier.formatWithCursor(content, {
        cursorOffset: cursorPos - block.contentFrom,
        parser: parser,
        plugins: plugins,
        tabWidth: state.tabSize,
      });
    }
  } catch (e: unknown) {
    const hyphens = "----------------------------------------------------------------------------";
    const message = e instanceof Error ? e.message : String(e);
    console.log(`Error when trying to format block:\n${hyphens}\n${message}\n${hyphens}`);
    return false;
  }
  if (!docUnchanged()) {
    return false;
  }
  // console.log("formattedContent.formatted:", formattedContent.formatted);
  const tr = view.state.update(
    {
      changes: {
        from: block.contentFrom,
        to: block.to,
        insert: formattedContent.formatted,
      },
      selection: EditorSelection.cursor(
        block.contentFrom + Math.min(formattedContent.cursorOffset, formattedContent.formatted.length),
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

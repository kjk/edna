import type { EditorView } from "@codemirror/view";

function insertFormattedDate({ state, dispatch }: EditorView, options: Intl.DateTimeFormatOptions): boolean {
  if (state.readOnly) {
    return false;
  }
  const text = new Intl.DateTimeFormat(undefined, options).format(new Date());
  dispatch(state.replaceSelection(text + " "), { scrollIntoView: true, userEvent: "input" });
  return true;
}

export const insertDateAndTime = (view: EditorView): boolean =>
  insertFormattedDate(view, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const insertTime = (view: EditorView): boolean =>
  insertFormattedDate(view, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

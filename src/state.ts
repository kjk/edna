let sessionStart = performance.now();

export function getSessionDurationInMs() {
  return Math.round(performance.now() - sessionStart);
}

let editors = [];

export function rememberEditor(editor) {
  editors = []; // TODO: for now we only have one editor
  editors.push(editor);
  // TODO: this is for tests
  // @ts-ignore
  window.elarisCurrentEditor = editor;
}

export function findEditorByView(view) {
  for (let e of editors) {
    if (e.view === view) {
      return e;
    }
  }
  return null;
}

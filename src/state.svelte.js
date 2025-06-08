class AppState {
  /** @type {string[]} */
  noteNames = $state([]);
  noteSelectorInfoCollapsed = $state(false);
  isDirty = $state(false);
  isDirtyFast = $state(false);
  /** @type {string[]} */
  history = $state([]); // history of opened files
}

export const appState = new AppState();

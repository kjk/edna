class AppState {
  /** @type {string[]} */
  noteNames = $state([]);
  noteSelectorInfoCollapsed = $state(false);
  isDirty = $state(false);
  isDirtyFast = $state(false);
}

export const appState = new AppState();

/** @type {string[]} */
export const openedHistory = $state([]);

/**
 * @returns {string[]}
 */
export function getHistory() {
  return openedHistory;
}

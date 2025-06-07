class DocDirtyState {
  isDirty = $state(false);
  isDirtyFast = $state(false);
}

export const dirtyState = new DocDirtyState();

class AppState {
  noteSelectorInfoCollapsed = $state(false);
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

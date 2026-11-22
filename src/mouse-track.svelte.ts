class MouseMoveTracker {
  moving = $state(false);
  // tracking is disabled while a dialog or the editor's find panel is open.
  // Separate flags so that closing a dialog doesn't re-enable tracking while
  // the find panel is still open
  dialogOpen = false;
  findPanelOpen = false;
  get disableMoveTracking(): boolean {
    return this.dialogOpen || this.findPanelOpen;
  }
}

export const isMoving = new MouseMoveTracker();

let timeoutId = 0;
function onMouseMove() {
  if (isMoving.disableMoveTracking) {
    isMoving.moving = false;
    return;
  }

  clearTimeout(timeoutId);
  timeoutId = window.setTimeout(() => {
    isMoving.moving = false;
  }, 500);
  isMoving.moving = true;
}

document.addEventListener("mousemove", onMouseMove);

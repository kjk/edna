class MouseMoveTracker {
  isMoving = $state(false);
  x;
  y;
}

export const mouseMoveTracker = new MouseMoveTracker();
export let mouseMoveTimeout = 500;

let timeoutId;
/**
 * @param {MouseEvent} e
 */
function onMouseMove(e) {
  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    mouseMoveTracker.isMoving = false;
  }, mouseMoveTimeout);
  mouseMoveTracker.isMoving = true;
  mouseMoveTracker.x = e.clientX;
  mouseMoveTracker.y = e.clientY;
}

document.addEventListener("mousemove", onMouseMove);

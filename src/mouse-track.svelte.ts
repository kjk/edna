class MouseMoveTracker {
  moving = $state(false);
  disableMoveTracking = false;
}

export const isMoving = new MouseMoveTracker();

let timeoutId;
function onMouseMove() {
  if (isMoving.disableMoveTracking) {
    isMoving.moving = false;
    return;
  }

  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    isMoving.moving = false;
  }, 500);
  isMoving.moving = true;
}

document.addEventListener("mousemove", onMouseMove);

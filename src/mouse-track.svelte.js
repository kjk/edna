class MouseMoveTracker {
  moving = $state(false);
}

export const isMoving = new MouseMoveTracker();

let timeoutId;
function onMouseMove() {
  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    isMoving.moving = false;
  }, 500);
  isMoving.moving = true;
}

document.addEventListener("mousemove", onMouseMove);

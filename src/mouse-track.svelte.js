import { len } from "./util";

class MouseOverElement {
  /** @type {HTMLElement} */
  element;
  isMoving = $state(false);
  isOver = $state(false);
  /**
   * @param {HTMLElement} el
   */
  constructor(el) {
    this.element = el;
  }
}

/**
 * @param {MouseEvent} e
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function isMouseOverElement(e, el) {
  if (!el) {
    return;
  }
  const rect = el.getBoundingClientRect();
  let x = e.clientX;
  let y = e.clientY;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** @type {MouseOverElement[]} */
let registered = [];

let timeoutId;
/**
 * @param {MouseEvent} e
 */
function onMouseMove(e) {
  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    for (let moe of registered) {
      moe.isMoving = false;
    }
  }, 1000);
  for (let moe of registered) {
    let el = moe.element;
    moe.isMoving = true;
    moe.isOver = isMouseOverElement(e, el);
  }
}

let didRegister;
/**
 * @param {HTMLElement} el
 * @returns {MouseOverElement}
 */
export function registerMuseOverElement(el) {
  if (!didRegister) {
    document.addEventListener("mousemove", onMouseMove);
    didRegister = true;
  }
  let res = new MouseOverElement(el);
  registered.push(res);
  return res;
}

/**
 * @param {HTMLElement} el
 */
export function unregisterMouseOverElement(el) {
  let n = registered.length;
  for (let i = 0; i < n; i++) {
    if (registered[i].element != el) {
      continue;
    }
    registered.splice(i, 1);
    if (len(registered) == 0) {
      document.removeEventListener("mousemove", onMouseMove);
      didRegister = null;
    }
    return;
  }
}

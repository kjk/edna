import tippy from "tippy.js";

/**
 * @param {HTMLElement} node
 */
export function focus(node, delay = 50) {
  // note: not sure why I need this but e.g. if I have CodeMirror,
  // the codemirror element regains focus if I set my focus
  // immediately on mount. Delay of 100 seems to fix it (50 was too low)
  // is it just with codemirror or more general?
  setTimeout(() => {
    node.focus();
  }, delay);
}

/**
 * @param {HTMLElement} element
 */
export function hasFocusedChild(element) {
  // Get the currently focused element
  const activeElement = document.activeElement;
  // console.log("activeElement:", activeElement);

  // Check if the active element is a child of the given element
  return element.contains(activeElement);
}

/**
 * focus but only if doesn't have focused children
 * @param {HTMLElement} node
 */
export function smartfocus(node) {
  setTimeout(() => {
    if (hasFocusedChild(node)) {
      return;
    }
    node.focus();
  }, 150);
}

// return {x, y} position that ensures that rect is visible inside window
/**
 * @param {DOMRect} rect
 */
export function ensureRectVisibleInWindow(rect) {
  let x = rect.x;
  const winDx = window.innerWidth;
  const rEndX = x + rect.width;
  if (rEndX > winDx) {
    x = winDx - rect.width - 15;
  }
  if (x < 4) {
    x = 4;
  }

  let y = rect.y;
  const winDy = window.innerHeight;
  const rEndY = y + rect.height;
  if (rEndY > winDy) {
    y = winDy - rect.height - 15;
  }
  if (y < 4) {
    y = 4;
  }
  return { x: x, y: y };
}

/**
/* action that ensures that the node is fully visible in the window
 * @param {HTMLElement} node
 */
export function ensurevisible(node, makeFixed = false) {
  const r = node.getBoundingClientRect();
  const { x, y } = ensureRectVisibleInWindow(r);
  Object.assign(node.style, {
    left: `${x}px`,
    top: `${y}px`,
  });
  if (makeFixed) {
    node.style.position = "fixed";
  }
  // console.log(`ensureVisible: x: ${x}, y: ${y}, r:`, r);
  // console.log(
  //   `ensurevisible: top: ${st.top}, left: ${st.left}, bottom: ${st.bottom}, right: ${st.right}`,
  // );
}

/**
 * @param {HTMLElement} node
 * @param {KeyboardEvent} ev
 */
export function trapFocusEvent(node, ev) {
  const focusable = node.querySelectorAll(
    'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]',
  );
  let active = document.activeElement;
  // console.log("node:", node);
  // console.log("active:", active);

  const first = /** @type {HTMLElement} */ (focusable[0]);
  const last = /** @type {HTMLElement} */ (focusable[focusable.length - 1]);

  // let isInList = false;
  // focusable.forEach((el) => {
  //   if (el === active) {
  //     isInList = true;
  //   }
  // });
  // console.log(
  //   "active in list:",
  //   isInList,
  //   "first:",
  //   active === first,
  //   "last:",
  //   active === last,
  // );

  if (ev.shiftKey && active === first) {
    ev.preventDefault();
    last.focus();
  } else if (!ev.shiftKey && active === last) {
    ev.preventDefault();
    first.focus();
  }
}

/**
 * @param {HTMLElement} node
 */
export function trapfocus(node) {
  /**
   * @param {KeyboardEvent} ev
   */
  function handleKeydown(ev) {
    if (ev.key === "Tab") {
      trapFocusEvent(node, ev);
    }
  }

  node.addEventListener("keydown", handleKeydown);
  return {
    destroy() {
      node.removeEventListener("keydown", handleKeydown);
    },
  };
}

/**
 * @param {HTMLFormElement} node
 * @param {() => void} callback
 */
export function clickOutside(node, callback) {
  function handleClick(event) {
    if (!node.contains(event.target) && !event.defaultPrevented) {
      callback();
      event.stopPropagation();
      event.preventDefault();
    }
  }

  document.addEventListener("click", handleClick, true);

  return {
    destroy() {
      document.removeEventListener("click", handleClick, true);
    },
  };
}

/**
 * @param {HTMLElement} element
 */
export function tooltip(element) {
  let content = element.getAttribute("title");
  if (!content) {
    content = element.getAttribute("aria-label");
  }
  if (!content) {
    content = element.dataset.tooltip;
  }
  const tooltip = tippy(element, {
    theme: "light",
    content,
    duration: [0, 0],
    delay: [0, 0],
    animation: false,
  });
  return tooltip.destroy;
}

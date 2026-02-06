export function focus(node: HTMLElement, delay = 50) {
  // Focus immediately, then re-focus after a delay to fight CodeMirror
  // stealing focus back. The immediate focus works when there's no
  // CodeMirror (e.g. Home tab), the delayed one is needed when there is.
  node.focus();
  setTimeout(() => {
    node.focus();
  }, delay);
}

export function hasFocusedChild(element: HTMLElement): boolean {
  // Get the currently focused element
  const activeElement = document.activeElement;
  // console.log("activeElement:", activeElement);

  // Check if the active element is a child of the given element
  return element.contains(activeElement);
}

// focus but only if doesn't have focused children
export function smartfocus(node: HTMLElement) {
  setTimeout(() => {
    if (hasFocusedChild(node)) {
      return;
    }
    node.focus();
  }, 150);
}

// return {x, y} position that ensures that rect is visible inside window
export function ensureRectVisibleInWindow(rect: DOMRect): { x: number; y: number } {
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

// action that ensures that the node is fully visible in the window
export function ensurevisible(node: HTMLElement, makeFixed = false) {
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

export function trapFocusEvent(node: HTMLElement, ev: KeyboardEvent) {
  const focusable = node.querySelectorAll(
    'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]',
  );
  let active = document.activeElement;
  // console.log("node:", node);
  // console.log("active:", active);

  const first = focusable[0] as HTMLElement;
  const last = focusable[focusable.length - 1] as HTMLElement;

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

export function trapfocus(node: HTMLElement) {
  function handleKeydown(ev: KeyboardEvent) {
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

export function clickOutside(node: HTMLElement, callback: () => void) {
  let handleClick = (event: MouseEvent) => {
    if (!node.contains(event.target as Node) && !event.defaultPrevented) {
      callback();
      event.stopPropagation();
      event.preventDefault();
    }
  };

  document.addEventListener("click", handleClick, true);

  return {
    destroy() {
      document.removeEventListener("click", handleClick, true);
    },
  };
}

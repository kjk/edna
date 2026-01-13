// -------------- toc generation
function getAllHeaders() {
  return Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
}

/**
 * @param {string} str
 * @returns {string}
 */
function removeHash(str) {
  return str.replace(/#$/, "");
}

class TocItem {
  text = "";
  hLevel = 0;
  nesting = 0;
  /** @type {HTMLElement} */
  element;
}

function buildTocItems() {
  let allHdrs = getAllHeaders();
  let res = [];
  for (let el of allHdrs) {
    let hel = /** @type {HTMLElement} */ (el);
    /** @type {string} */
    let text = hel.innerText.trim();
    text = removeHash(text);
    text = text.trim();
    let hLevel = parseInt(hel.tagName[1]);
    let h = new TocItem();
    h.text = text;
    h.hLevel = hLevel;
    h.nesting = 0;
    h.element = hel;
    res.push(h);
  }
  return res;
}

function fixNesting(hdrs) {
  let n = hdrs.length;
  for (let i = 0; i < n; i++) {
    let h = hdrs[i];
    if (i == 0) {
      h.nesting = 0;
    } else {
      h.nesting = h.hLevel - 1;
    }
    // console.log(`${h.hLevel} => ${h.nesting}`);
  }
}

function genTocMini(items) {
  let tmp = "";
  let t = `<div class="toc-item-mini toc-light">▃</div>`;
  for (let i = 0; i < items.length; i++) {
    tmp += t;
  }
  return `<div class="toc-mini">` + tmp + `</div>`;
}

function genTocList(items) {
  let tmp = "";
  let t = `<div title="{title}" class="toc-item toc-trunc {ind}" onclick=tocGoTo({n})>{text}</div>`;
  let n = 0;
  for (let h of items) {
    let s = t;
    s = s.replace("{n}", `${n}`);
    let ind = "toc-ind-" + h.nesting;
    s = s.replace("{ind}", ind);
    s = s.replace("{text}", h.text);
    s = s.replace("{title}", h.text);
    tmp += s;
    n++;
  }
  return `<div class="toc-list">` + tmp + `</div>`;
}

/**
 * @param {HTMLElement} el
 */
function highlightElement(el) {
  let tempBgColor = "yellow";
  let origCol = el.style.backgroundColor;
  if (origCol === tempBgColor) {
    return;
  }
  el.style.backgroundColor = tempBgColor;
  setTimeout(() => {
    el.style.backgroundColor = origCol;
  }, 1000);
}

let tocItems = [];
function tocGoTo(n) {
  let el = tocItems[n].element;
  let y = el.getBoundingClientRect().top + window.scrollY;
  let offY = 12;
  y -= offY;
  window.scrollTo({
    top: y,
  });
  highlightElement(el);
  // the above scrollTo() triggers updateClosestToc() which might
  // not be accurate so we set the exact selected after a small delay
  setTimeout(() => {
    showSelectedTocItem(n);
  }, 100);
}

function genToc() {
  tocItems = buildTocItems();
  fixNesting(tocItems);
  const container = document.createElement("div");
  container.className = "toc-wrapper";
  let s = genTocMini(tocItems);
  let s2 = genTocList(tocItems);
  container.innerHTML = s + s2;
  document.body.appendChild(container);
}

function showSelectedTocItem(elIdx) {
  // make toc-mini-item black for closest element
  let els = document.querySelectorAll(".toc-item-mini");
  let cls = "toc-light";
  for (let i = 0; i < els.length; i++) {
    let el = els[i];
    if (i == elIdx) {
      el.classList.remove(cls);
    } else {
      el.classList.add(cls);
    }
  }

  // make toc-item bold for closest element
  els = document.querySelectorAll(".toc-item");
  cls = "toc-bold";
  for (let i = 0; i < els.length; i++) {
    let el = els[i];
    if (i == elIdx) {
      el.classList.add(cls);
    } else {
      el.classList.remove(cls);
    }
  }
}
function updateClosestToc() {
  let closestIdx = -1;
  let closestDistance = Infinity;

  for (let i = 0; i < tocItems.length; i++) {
    let tocItem = tocItems[i];
    const rect = tocItem.element.getBoundingClientRect();
    const distanceFromTop = Math.abs(rect.top);
    if (
      distanceFromTop < closestDistance &&
      rect.bottom > 0 &&
      rect.top < window.innerHeight
    ) {
      closestDistance = distanceFromTop;
      closestIdx = i;
    }
  }
  if (closestIdx >= 0) {
    showSelectedTocItem(closestIdx);
  }
}

function makeImagesZoomable() {
  const images = Array.from(document.getElementsByTagName("img"));
  for (let img of images) {
    img.style.cursor = "pointer";
    img.addEventListener("click", () => {
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
      overlay.style.display = "flex";
      overlay.style.justifyContent = "center";
      overlay.style.alignItems = "center";
      overlay.style.zIndex = "9999";

      const zoomImg = document.createElement("img");
      zoomImg.src = img.src;
      zoomImg.alt = img.alt || "";
      zoomImg.style.cursor = "pointer";
      zoomImg.style.maxWidth = "97%";
      zoomImg.style.maxHeight = "97%";
      zoomImg.style.width = "auto";
      zoomImg.style.height = "auto";
      zoomImg.style.left = "0";
      zoomImg.style.right = "0";
      overlay.appendChild(zoomImg);
      document.body.appendChild(overlay);

      overlay.addEventListener("click", () => {
        overlay.remove();
      });
    });
  }
}

window.addEventListener("scroll", updateClosestToc);
window.addEventListener("DOMContentLoaded", () => {
  genToc();
  updateClosestToc();
  makeImagesZoomable();
});

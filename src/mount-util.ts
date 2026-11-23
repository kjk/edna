import { mount, tick, unmount } from "svelte";

// mounts component into a new <div> added to the page (style: css of the div)
// selects the text of input once pending changes are rendered
export function selectAfterTick(getInput: () => HTMLInputElement | undefined) {
  tick().then(() => getInput()?.select());
}

export function mountInNewDiv(
  component: any,
  props: object = {},
  style = "",
): { target: HTMLDivElement; comp: ReturnType<typeof mount> } {
  const target = document.createElement("div");
  target.style.cssText = style;
  document.body.appendChild(target);
  return { target, comp: mount(component, { target, props }) };
}

// undoes mountInNewDiv(); either can be undefined (e.g. already unmounted)
export async function unmountAndRemove(target?: HTMLElement, comp?: ReturnType<typeof mount>) {
  if (comp) {
    await unmount(comp);
  }
  target?.remove();
}

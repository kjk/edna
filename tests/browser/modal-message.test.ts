import { flushSync, mount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import ModalMessage, { clearModalMessage, modalMessageState, showModalMessageHTML } from "../../src/components/ModalMessage.svelte";
import { mountInNewDiv, unmountAndRemove } from "./utils";

// overlapping busy messages (docs/state-machines.md issue 15c)
describe("ModalMessage", () => {
  let comp: ReturnType<typeof mount> | undefined;
  let target: HTMLElement;

  afterEach(() => {
    clearModalMessage("run");
    clearModalMessage("load");
    unmountAndRemove(target, comp);
  });

  it("clearing one operation's message keeps another operation's message", async () => {
    ({ target, comp } = mountInNewDiv(ModalMessage));
    showModalMessageHTML("running code", 0, "run");
    showModalMessageHTML("Loading note", 0, "load");
    flushSync();
    expect(target.textContent).toContain("Loading note");
    clearModalMessage("load");
    flushSync();
    expect(modalMessageState.isShowing).toBe(true);
    expect(target.textContent).toContain("running code");
    clearModalMessage("run");
    expect(modalMessageState.isShowing).toBe(false);
  });

  it("delayed message is not shown if cleared before the delay", async () => {
    showModalMessageHTML("Loading note", 50, "load");
    expect(modalMessageState.isShowing).toBe(false);
    clearModalMessage("load");
    await new Promise((r) => setTimeout(r, 100));
    expect(modalMessageState.isShowing).toBe(false);
    showModalMessageHTML("Loading note", 30, "load");
    await expect.poll(() => modalMessageState.isShowing).toBe(true);
  });
});

import "../../src/main.css";
import { mount } from "svelte";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { page, userEvent } from "vitest/browser";
import App from "../../src/components/App.svelte";
import { createNoteWithName, deleteNote } from "../../src/notes";
import { getSettings, settingsAddTab, settingsRemoveTab } from "../../src/settings.svelte";
import { mountInNewDiv, setEditorHeight, unmountAndRemove } from "./utils";
import { editorLines, modKey, press, visibleBlocks } from "./editor-ui";

describe("Delete block (browser tests)", () => {
  let app: ReturnType<typeof mount> | undefined;
  let container: HTMLDivElement;
  let noteName: string;
  let previousTab: string;

  const threeBlockContent =
    "\n∞∞∞text\nBlock A" +
    "\n∞∞∞markdown\nBlock B" +
    "\n∞∞∞text\nBlock C";

  beforeEach(async () => {
    noteName = `delete-block-test-${crypto.randomUUID()}`;
    await createNoteWithName(noteName, threeBlockContent);
    const settings = getSettings();
    previousTab = settings.currentTab;
    settings.currentTab = noteName;
    settingsAddTab(settings, noteName);
    ({ target: container, comp: app } = mountInNewDiv(App, {}, "height: 300px"));
    await expect.poll(() => container.querySelector(".cm-editor")).not.toBeNull();
    setEditorHeight(container, 260);
    await expect.poll(() => visibleBlocks(container)).toEqual(["Block A", "Block B", "Block C"]);
  });

  afterEach(async () => {
    await unmountAndRemove(container, app);
    app = undefined;
    const settings = getSettings();
    settings.currentTab = previousTab;
    settingsRemoveTab(settings, noteName);
    await deleteNote(noteName);
  });

  it.each([
    ["first", 0, ["Block B", "Block C"], ["XBlock B", "Block C"]],
    ["middle", 1, ["Block A", "Block C"], ["Block A", "XBlock C"]],
    ["last", 2, ["Block A", "Block B"], ["Block A", "Block BX"]],
  ] as const)("delete the %s block", async (_, index, remaining, afterTyping) => {
    await userEvent.click(editorLines(container)[index], { position: { x: 20, y: 5 } });
    await press("k", modKey, "Shift");
    await userEvent.keyboard("Block: Delete");
    await page.getByRole("option", { name: "Block: Delete", exact: true }).click();
    await expect.poll(() => visibleBlocks(container)).toEqual(remaining);

    await userEvent.keyboard("X");
    expect(visibleBlocks(container)).toEqual(afterTyping);
  });
});

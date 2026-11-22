import { beforeAll, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { editorInput, editorText, mountApp, openNoteShortcut } from "./app-ui";
import { modKey, press, visibleBlocks } from "./editor-ui";

beforeAll(async () => {
  await mountApp({
    scratch: "\n∞∞∞javascript\nlet   x=1",
    inbox: "\n∞∞∞golang\npackage   main",
  });
});

it("formats a block with the status bar button", async () => {
  await openNoteShortcut(1, "scratch");
  await expect.poll(editorText).toContain("let   x=1");

  await page.getByRole("button", { name: /^Format Block/ }).click();

  await expect.poll(() => visibleBlocks(editorInput().parentElement!)).toEqual(["let x = 1;\n"]);
});

it("ignores a formatter result if the document changed while formatting", async () => {
  await openNoteShortcut(3, "inbox");
  await expect.poll(editorText).toContain("package   main");
  const reply = Promise.withResolvers<Response>();
  const originalFetch = window.fetch;
  const fetch = vi
    .spyOn(window, "fetch")
    .mockImplementation((input, init) => (input === "/api/goplay/fmt" ? reply.promise : originalFetch(input, init)));
  try {
    editorInput().focus();
    await press("ArrowRight");
    await press("ArrowDown", modKey);
    await press("f", "Alt", "Shift");
    await expect
      .poll(() => fetch.mock.calls.find(([url]) => url === "/api/goplay/fmt")?.[1]?.body)
      .toBe("package   main");

    await userEvent.keyboard("{Enter}var y int");
    const response = Response.json({ Body: "package main\n" });
    const json = vi.spyOn(response, "json");
    reply.resolve(response);
    await expect.poll(() => json).toHaveBeenCalled();
    await json.mock.results[0]?.value;
    expect(editorText()).toContain("var y int");
    expect(editorText()).toContain("package   main");
  } finally {
    fetch.mockRestore();
  }
});

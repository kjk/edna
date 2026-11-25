import { expect, it } from "vitest";
import { createSettings, defaultSettings } from "../../src/settings.svelte";

// stored data with an unexpected shape (docs/state-machines.md U8)
it("createSettings ignores values of the wrong type", () => {
  let s = createSettings({ tabs: "scratch", tabSize: "4", theme: "dark", fontSize: 14, showSidebar: 1 });
  expect(s.tabs).toEqual([]);
  expect(s.tabSize).toBe(defaultSettings.tabSize);
  expect(s.theme).toBe("dark");
  expect(s.fontSize).toBe(14);
  expect(s.showSidebar).toBe(defaultSettings.showSidebar);
  expect(createSettings({ tabs: ["a", 5, null, "b"] }).tabs).toEqual(["a", "b"]);
  expect(createSettings(null).tabs).toEqual([]);
  expect(createSettings("garbage").theme).toBe(defaultSettings.theme);
});

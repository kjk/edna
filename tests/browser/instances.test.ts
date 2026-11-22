import { describe, expect, it } from "vitest";
import { hasOtherInstances, startInstanceDetection } from "../../src/instances";

// detecting other Edna tabs (docs/state-machines.md issue 13)
describe("instances", () => {
  it("detects another instance only while it's open", async () => {
    startInstanceDetection();
    expect(await hasOtherInstances(100)).toBe(false);

    // simulate another tab
    const other = new BroadcastChannel("edna-instances");
    other.onmessage = (ev) => {
      if (ev.data.type === "ping") {
        other.postMessage({ type: "pong", from: "other-tab", to: ev.data.from });
      }
    };
    expect(await hasOtherInstances(300)).toBe(true);
    other.close();
    expect(await hasOtherInstances(100)).toBe(false);
  });
});

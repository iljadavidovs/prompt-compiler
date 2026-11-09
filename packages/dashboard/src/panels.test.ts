import { describe, expect, it } from "vitest";
import { inspectPanel, mountPanel, sourcePanel } from "./App/assets/workspace/panels.js";

describe("trusted inspection module seam", () => {
  it("supports two built-ins and a replacement module, with cleanup and contained failure", () => {
    expect([sourcePanel.id, inspectPanel.id]).toEqual(["sources", "inspect"]);
    const events: string[] = [];
    const host = { replaceChildren: () => events.push("clear") } as unknown as Parameters<typeof mountPanel>[0];
    const context = { rawText: "synthetic request", result: { prompt: "synthetic result", promptIr: {}, contextPack: {}, metadata: { warnings: [] } } };
    const fixture = { id: "fixture", title: "Synthetic extension", mount: () => { events.push("fixture mounted"); return () => events.push("fixture disposed"); } };
    const dispose = mountPanel(host, fixture, context, error => { throw error; });
    dispose();
    expect(events).toEqual(["clear", "fixture mounted", "fixture disposed"]);
    const failed = { ...fixture, mount: () => { throw new Error("synthetic panel failure"); } };
    // Error fallback uses the DOM; verify via a minimal inert element constructor.
    const previous = globalThis.document;
    globalThis.document = { createElement: () => ({ className: "", textContent: "" }) } as any;
    try {
      const errors: Error[] = [];
      mountPanel(host, failed, context, error => errors.push(error));
      expect(errors[0].message).toBe("synthetic panel failure");
      expect(context.result.prompt).toBe("synthetic result");
    } finally { globalThis.document = previous; }
  });
});

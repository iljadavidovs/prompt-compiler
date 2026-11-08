import { afterEach, describe, expect, it, vi } from "vitest";
const modulePath = "./App/assets/workspace/api.js";
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("local browser transport", () => {
  it("renews an expired process session once and preserves the original mutation body", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "synthetic-first" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "expired" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "synthetic-second" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 2 })));
    vi.stubGlobal("fetch", request);
    const { api } = await import(modulePath);
    const body = { draft: { content: "SYNTHETIC_UNSAVED_TEXT" }, expectedRevision: 1 };
    expect(await api("/drafts", body)).toEqual({ revision: 2 });
    expect(request.mock.calls.map(call => call[0])).toEqual(["/v1/session", "/v1/drafts", "/v1/session", "/v1/drafts"]);
    expect(request.mock.calls[1][1].body).toBe(request.mock.calls[3][1].body);
    expect(body.draft.content).toBe("SYNTHETIC_UNSAVED_TEXT");
  });
  it("reports an interrupted save without changing caller-owned text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ token: "synthetic" }))).mockRejectedValueOnce(new TypeError("Failed to fetch")));
    const { api } = await import(modulePath);
    const body = { draft: { content: "SYNTHETIC_DRAFT" } };
    await expect(api("/drafts", body)).rejects.toThrow("draft is preserved");
    expect(body.draft.content).toBe("SYNTHETIC_DRAFT");
  });
});

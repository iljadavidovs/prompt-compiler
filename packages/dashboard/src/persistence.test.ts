import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const modulePath = "./App/assets/workspace/persistence.js";
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
});
afterEach(() => vi.unstubAllGlobals());

describe("workspace-scoped browser recovery", () => {
  it("keeps draft recovery and active document separate for two workspaces", async () => {
    const { remember, recover, rememberActive, activeDraft } = await import(modulePath);
    const draft = { id: "synthetic-draft", revision: 1, title: "Synthetic", content: "LOCAL_A", bindings: [] };
    remember("A", draft); remember("B", { ...draft, content: "LOCAL_B" });
    rememberActive("A", "a-document"); rememberActive("B", "b-document");
    expect(recover("A").content).toBe("LOCAL_A"); expect(recover("B").content).toBe("LOCAL_B");
    expect(activeDraft("A")).toBe("a-document"); expect(activeDraft("B")).toBe("b-document");
  });
  it("does not retain credential-shaped recovery and persists only a valid effective budget", async () => {
    const { remember, recover, readBudget, saveBudget } = await import(modulePath);
    const draft = { id: "synthetic", revision: 0, title: "Synthetic", content: "safe", bindings: [] };
    remember("A", draft); remember("A", { ...draft, content: "api_key=synthetic_credential" });
    expect(recover("A")).toBeNull();
    saveBudget(256); expect(readBudget()).toBe(256);
    expect(() => saveBudget(0)).toThrow("256"); expect(readBudget()).toBe(256);
  });
});

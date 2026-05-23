import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { startServer } from "./index.js";

describe("pcrd", () => {
  it("serves health and compile routes on loopback", async () => {
    const temp = await mkdtemp(join(tmpdir(), "pcrd-"));
    process.env.PCR_USER_DIR = join(temp, "user-pcr");
    process.env.PCR_DB_PATH = join(temp, "pcr.sqlite");
    await mkdir(process.env.PCR_USER_DIR, { recursive: true });
    await writeFile(join(process.env.PCR_USER_DIR, "config.yaml"), "tools:\n  enabled:\n    - progress-assessment\n");

    const server = await startServer({ port: 0 });
    try {
      const health = await fetch(`${server.url}/health`);
      expect(await health.json()).toMatchObject({ ok: true });

      const compile = await fetch(`${server.url}/v1/compile`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rawText: "compile a research prompt for assessment of my progress",
          contextBlocks: [
            {
              id: "goal",
              label: "Goal",
              kind: "goal",
              content: "- Finish PCR V0",
            },
          ],
        }),
      });
      const body = await compile.json() as { prompt: string; metadata: { skipped?: boolean } };
      expect(body.metadata.skipped).not.toBe(true);
      expect(body.prompt).toContain("Finish PCR V0");

      const settings = await fetch(`${server.url}/v1/settings`);
      const settingsBody = await settings.json() as { tools: Array<{ id: string; enabled: boolean }> };
      expect(settingsBody.tools.some((tool) => tool.id === "progress-assessment" && tool.enabled)).toBe(true);

      const update = await fetch(`${server.url}/v1/tools/grammar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          config: { keywords: ["grammar fix", "copyedit"] },
        }),
      });
      const updateBody = await update.json() as { tool: { id: string; config: { keywords: string[] } } };
      expect(updateBody.tool.id).toBe("grammar");
      expect(updateBody.tool.config.keywords).toContain("copyedit");
    } finally {
      await server.close();
      delete process.env.PCR_USER_DIR;
      delete process.env.PCR_DB_PATH;
    }
  });
});

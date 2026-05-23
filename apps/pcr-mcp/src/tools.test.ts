import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { pcrCompileTool } from "./index.js";

describe("pcr-mcp tools", () => {
  it("runs pcr_compile", async () => {
    const temp = await mkdtemp(join(tmpdir(), "pcr-mcp-"));
    process.env.PCR_USER_DIR = join(temp, "user-pcr");
    process.env.PCR_DB_PATH = join(temp, "pcr.sqlite");
    await mkdir(process.env.PCR_USER_DIR, { recursive: true });
    await writeFile(join(process.env.PCR_USER_DIR, "config.yaml"), "tools:\n  enabled:\n    - progress-assessment\n");
    const result = await pcrCompileTool({
      rawText: "compile a research prompt for assessment of my progress",
      contextBlocks: [
        {
          id: "goal",
          label: "Goal",
          kind: "goal",
          content: "- Finish PCR V0",
        },
      ],
    });

    expect(result.prompt).toContain("Finish PCR V0");
    expect(result.metadata.source).toBe("mcp");
    delete process.env.PCR_USER_DIR;
    delete process.env.PCR_DB_PATH;
  });
});

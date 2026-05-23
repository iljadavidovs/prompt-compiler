import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createPcrStore } from "@pcr/store";
import { searchContext } from "@pcr/retrieval";
import { buildContextPack, indexLocalContext } from "./index.js";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "pcr-context-"));
  const userDir = join(root, "user-pcr");
  await mkdir(join(userDir, "context"), { recursive: true });
  await writeFile(join(userDir, "context", "goals.md"), "- Finish PCR V0\n- Improve execution consistency\n");
  await writeFile(join(userDir, "context", "schedule.md"), "- Friday: review architecture\n");
  await writeFile(join(userDir, "context", "preferences.md"), "- Direct tone\n- Include risks\n");
  return { root, userDir, dbPath: join(root, "pcr.sqlite") };
}

describe("pcr-context", () => {
  it("indexes local context files", async () => {
    const { root, userDir, dbPath } = await fixture();
    const result = await indexLocalContext({ cwd: root, userDir, dbPath });
    expect(result.indexedFiles).toBe(3);

    const store = createPcrStore({ dbPath });
    const search = searchContext(store, "goals schedule progress", { kinds: ["goal", "schedule"] });
    expect(search.map((block) => block.kind)).toContain("goal");
    expect(search.map((block) => block.kind)).toContain("schedule");
    store.close();
  });

  it("builds a budgeted context pack", async () => {
    const { root, userDir, dbPath } = await fixture();
    const pack = await buildContextPack({
      cwd: root,
      userDir,
      dbPath,
      rawText: "according to my current goals and nearest schedule, compile a research prompt for assessment of my progress",
      mode: "research",
      options: { maxContextTokens: 1000 },
    });

    expect(pack.goals[0]?.content).toContain("Finish PCR V0");
    expect(pack.schedule[0]?.content).toContain("Friday");
    expect(pack.preferences[0]?.content).toContain("Direct tone");
    expect(pack.summary).toContain("goal");
  });
});

